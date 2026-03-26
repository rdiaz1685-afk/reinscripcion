/**
 * INNOVAT AGENT - Agente de automatización para el sistema Innovat
 *
 * Estrategia confirmada por inspección visual:
 * - El botón GENERAR hace una petición XHR/fetch que devuelve el Excel como binario
 * - NO dispara evento 'download' ni abre nueva pestaña
 * - Se intercepta la respuesta de red antes de hacer click
 * - El selector de campus/ciclo es el botón en la esquina superior derecha "CUMBRES 2025-2026 ▼"
 */

import { chromium, Browser, Page } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { db } from './db';

// ─── Configuración ─────────────────────────────────────────────────────────
const INNOVAT_URL = 'https://innovat1.mx/Gaia/login';
const INNOVAT_USER = process.env.INNOVAT_USER || 'prueba.diaz';
const INNOVAT_PASS = process.env.INNOVAT_PASS || '123456';
const INNOVAT_SCHOOL = process.env.INNOVAT_SCHOOL || 'Colegio Cambridge de Monterrey';

export const CAMPUS_LIST = ['DOMINIO', 'MITRAS', 'NORTE', 'CUMBRES', 'ANAHUAC'];

// Nota: Innovat muestra "ANÁHUAC" con acento — la búsqueda normaliza acentos automáticamente
const CICLOS = ['2025-2026', '2026-2027'] as const;

// ─── Mapeo de IDs de unidades por campus y ciclo ──────────────────────────
// Estos IDs se obtienen de la sección "Control" de Innovat donde se dan de alta los ciclos escolares
const UNIT_IDS: Record<string, Record<string, string>> = {
    '2025-2026': {
        'ANAHUAC': '49',
        'CUMBRES': '50',
        'DOMINIO': '51',
        'MITRAS': '52',
        'NORTE': '53',
    },
    '2026-2027': {
        'NORTE': '54',
        'CUMBRES': '55',
        'DOMINIO': '56',
        'MITRAS': '57',
        'ANAHUAC': '58',
    },
};

// ─── Función de clasificación de alumnos ──────────────────────────────────
function clasificarAlumno(estatus: string | null, comentario: string | null, esNuevoDesde26: boolean): string {
    const s = (estatus || '').toLowerCase().trim();
    const c = (comentario || '').toLowerCase().trim();

    if (esNuevoDesde26) {
        if (s.includes('inscrito') || s.includes('reinscrito') || s.includes('nuevo')) {
            return 'Nuevo';
        }
        return 'Candidato';
    }

    if (s === 'reinscrito') {
        return 'Reinscrito';
    }

    if (s.includes('baja') || s.includes('retirado')) {
        if (c.includes('transferencia') || c.includes('plantel') || c.includes('unidad')) {
            return 'Baja Transferencia';
        }
        return 'Baja Real';
    }

    return 'Por Reinscribir';
}

// ─── Función para procesar y guardar datos directamente ───────────────────
async function procesarYGuardarDatos(
    jsonData: any[],
    campus: string,
    ciclo: string,
    onStep?: SyncCallback
): Promise<number> {
    try {
        const esNuevoDesde26 = ciclo === '2026-2027';
        const unidadNormalizada = campus.charAt(0).toUpperCase() + campus.slice(1).toLowerCase();
        
        onStep?.({ type: 'processing', campus, ciclo, count: jsonData.length });

        // Normalizar nombres de columnas (case-insensitive)
        const normalizeKey = (obj: any) => {
            const normalized: any = {};
            for (const key in obj) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('matrícula') || lowerKey.includes('matricula')) {
                    normalized.matricula = obj[key];
                } else if (lowerKey.includes('nombre')) {
                    normalized.nombre = obj[key];
                } else if (lowerKey.includes('unidad')) {
                    normalized.unidad = obj[key];
                } else if (lowerKey.includes('grado')) {
                    normalized.grado = obj[key];
                } else if (lowerKey.includes('grupo')) {
                    normalized.grupo = obj[key];
                } else if (lowerKey.includes('estatus') || lowerKey.includes('status')) {
                    normalized.estatus = obj[key];
                } else if (lowerKey.includes('fecha')) {
                    normalized.fecha = obj[key];
                } else if (lowerKey.includes('comentario')) {
                    normalized.comentario = obj[key];
                }
            }
            return normalized;
        };

        // Procesar y preparar datos
        const datosParaGuardar: any[] = [];
        let procesados = 0;
        
        for (const rawAlumno of jsonData) {
            const alumno = normalizeKey(rawAlumno);
            
            if (!alumno.matricula || !alumno.nombre) continue;

            const matricula = String(alumno.matricula).trim();
            const nombre = String(alumno.nombre).trim();
            const grado = String(alumno.grado || '').trim();
            const grupo = String(alumno.grupo || '').trim();
            const estatus = String(alumno.estatus || '').trim();
            const comentario = String(alumno.comentario || '').trim();
            
            // Parsear fecha
            let fechaEstatus: Date | null = null;
            if (alumno.fecha) {
                const fechaStr = String(alumno.fecha);
                const parsed = new Date(fechaStr);
                if (!isNaN(parsed.getTime())) {
                    fechaEstatus = parsed;
                }
            }

            if (ciclo === '2025-2026') {
                datosParaGuardar.push({
                    matricula,
                    unidad: unidadNormalizada,
                    nombre,
                    grado,
                    grupo
                });
            } else {
                datosParaGuardar.push({
                    matricula,
                    unidad: unidadNormalizada,
                    nombre,
                    grado,
                    estatus,
                    fechaEstatus,
                    comentario
                });
            }
            procesados++;
        }

        onStep?.({ type: 'debug', message: `📝 Preparados ${procesados} registros para guardar` });

        // Guardar en lote (más eficiente)
        if (datosParaGuardar.length > 0) {
            // Primero borrar registros existentes de este campus/ciclo
            if (ciclo === '2025-2026') {
                await db.alumno25_26.deleteMany({
                    where: { unidad: unidadNormalizada }
                });
                await db.alumno25_26.createMany({
                    data: datosParaGuardar
                });
            } else {
                await db.alumno26_27.deleteMany({
                    where: { unidad: unidadNormalizada }
                });
                await db.alumno26_27.createMany({
                    data: datosParaGuardar
                });
            }
        }

        onStep?.({ type: 'saved', campus, ciclo, count: datosParaGuardar.length });
        return datosParaGuardar.length;
    } catch (error) {
        onStep?.({ type: 'error', message: `Error procesando ${campus} ${ciclo}: ${error}` });
        return 0;
    }
}

// ─── Tipos ─────────────────────────────────────────────────────────────────
export type SyncStep =
    | { type: 'login' }
    | { type: 'campus'; campus: string; ciclo: string }
    | { type: 'downloaded'; campus: string; ciclo: string; path: string }
    | { type: 'processing'; campus: string; ciclo: string; count: number }
    | { type: 'saved'; campus: string; ciclo: string; count: number }
    | { type: 'error'; message: string }
    | { type: 'done'; files: string[] }
    | { type: 'debug'; message: string };

export type SyncCallback = (step: SyncStep) => void;

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getUploadDir(): Promise<string> {
    const dir = (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER_ENVIRONMENT)
        ? '/app/upload'
        : join(process.cwd(), 'upload');
    await mkdir(dir, { recursive: true });
    return dir;
}

async function getDebugDir(): Promise<string> {
    const dir = (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER_ENVIRONMENT)
        ? '/app/upload/debug'
        : join(process.cwd(), 'upload', 'debug');
    await mkdir(dir, { recursive: true });
    return dir;
}

async function screenshot(page: Page, nombre: string, onStep?: SyncCallback) {
    try {
        const debugDir = await getDebugDir();
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const path = join(debugDir, `${ts}_${nombre}.png`);
        await page.screenshot({ path, fullPage: false });
        onStep?.({ type: 'debug', message: `📸 Screenshot: ${nombre}` });
    } catch { /* No romper el flujo */ }
}

async function saveHtml(page: Page, nombre: string) {
    try {
        const debugDir = await getDebugDir();
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const path = join(debugDir, `${ts}_${nombre}.html`);
        const html = await page.content();
        await writeFile(path, html, 'utf-8');
    } catch { }
}

function cicloCorto(ciclo: string): string {
    return ciclo.replace('20', '').replace('-20', '-'); // "2025-2026" → "25-26"
}

function campusNombreArchivo(campus: string, ciclo: string): string {
    return `${campus}_${cicloCorto(ciclo)}.xlsx`;
}

// ─── Cambiar Campus y Ciclo desde el selector del header ───────────────────
// El header muestra "CUMBRES 2025-2026 ▼" — hay que hacer click EXACTAMENTE
// en ese botón para abrir el dropdown con todas las combinaciones campus+ciclo
async function cambiarCampusCiclo(
    page: Page,
    campus: string,
    ciclo: string,
    onStep?: SyncCallback
): Promise<void> {
    const cicloC = cicloCorto(ciclo); // "25-26"

    // ── Leer solo el texto del botón del header (no el dropdown expandido)
    // Estrategia: buscar el elemento que contenga EXACTAMENTE "CAMPUS CICLO" sin hijos adicionales
    // El botón del header es un elemento específico visible en la barra superior
    // Su texto es algo como "CUMBRES 2025-2026" o "CUMBRES 25-26"

    // Selector específico: el dropdown trigger del header
    // En AngularJS/UIKit suele ser un <a> o <span> con ng-click dentro de un <div class="...dropdown...">
    const dropdownTrigger = page.locator([
        'a[ng-click*="Unidad"], a[ng-click*="Campus"], a[ng-click*="ciclo"]',
        '.uk-navbar-nav a:has-text("2025"), .uk-navbar-nav a:has-text("2026")',
        'a.dropdown-toggle:has-text("CUMBRES"), a.dropdown-toggle:has-text("DOMINIO")',
        'a.dropdown-toggle:has-text("MITRAS"), a.dropdown-toggle:has-text("NORTE")',
        // Selector de texto: el botón visible del header con el año
        'nav a:has-text("2025-2026"), nav a:has-text("2026-2027")',
        // Buscar dentro del navbar específicamente
        '.md-navbar a:has-text("2025"), .md-navbar a:has-text("2026")',
    ].join(', ')).first();

    // Fallback: el botón más específico que solo contiene campus+año (texto corto)
    const dropdownFallback = page.locator('a, button, span')
        .filter({ hasText: /(?:CUMBRES|DOMINIO|MITRAS|NORTE|AN[AÁ]HUAC)\s+\d{4}/i })
        // Excluir elementos con demasiado texto (los que contienen todo el navbar)
        .first();

    onStep?.({ type: 'debug', message: `🔄 Buscando selector de campus/ciclo...` });

    // Intentar leer el texto del trigger para verificar campus actual
    let textoHeader = '';
    try {
        textoHeader = await dropdownTrigger.textContent({ timeout: 2000 }) ?? '';
    } catch {
        try {
            textoHeader = await dropdownFallback.textContent({ timeout: 2000 }) ?? '';
        } catch { }
    }
    onStep?.({ type: 'debug', message: `📍 Texto del selector: "${textoHeader.trim().substring(0, 50)}"` });

    // ── Hacer click en el trigger del dropdown
    let clicExitoso = false;
    try {
        await dropdownTrigger.click({ timeout: 4000 });
        clicExitoso = true;
    } catch {
        try {
            await dropdownFallback.click({ timeout: 4000 });
            clicExitoso = true;
        } catch {
            onStep?.({ type: 'debug', message: '⚠️ No se encontró el trigger del dropdown (reintentando...)' });
            // Forzar navegación a un estado limpio
            await page.goto('https://innovat1.mx/Gaia/32.2.2/#/Inicio', { waitUntil: 'domcontentloaded' }).catch(() => { });
            await page.waitForTimeout(2000);
            await dropdownFallback.click({ timeout: 4000 }).then(() => clicExitoso = true).catch(() => { });
        }
    }

    if (!clicExitoso) return;

    await page.waitForTimeout(800);
    onStep?.({ type: 'debug', message: '✅ Dropdown de campus abierto' });
    await screenshot(page, `dropdown_${campus}_${cicloC}`, onStep);

    // ── Leer y mostrar TODAS las opciones del dropdown para debug
    const opciones = page.locator('ul li, li[ng-repeat], .uk-dropdown li, [role="option"]');
    const count = await opciones.count().catch(() => 0);
    onStep?.({ type: 'debug', message: `📋 ${count} opciones en dropdown:` });
    for (let i = 0; i < Math.min(count, 20); i++) {
        const t = (await opciones.nth(i).textContent().catch(() => ''))?.trim();
        onStep?.({ type: 'debug', message: `  [${i}] "${t}"` });
    }

    // Función para normalizar acentos en la comparación
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

    // ── Seleccionar la opción que contenga CAMPUS + CICLO
    // IMPORTANTE: Ignorar opciones con texto largo (son contenedores con todos los campus juntos)
    const MAX_LONGITUD_OPCION = 60;
    let seleccionado = false;
    let seleccionadoConCiclo = false; // true si ya elegimos combo campus+ciclo juntos

    // Estrategia 1: Combo exacto "CAMPUS CICLO" en un texto corto (incluyendo normalización de acentos)
    for (let i = 0; i < count; i++) {
        const raw = (await opciones.nth(i).textContent().catch(() => '')) ?? '';
        const texto = norm(raw);
        if (texto.length > MAX_LONGITUD_OPCION) continue;
        const campusNorm = norm(campus); // ANAHUAC (sin acento)
        const tieneCampus = texto.includes(campusNorm);
        const tieneCiclo = texto.includes(ciclo.toUpperCase()) || texto.includes(cicloC.toUpperCase());
        if (tieneCampus && tieneCiclo) {
            try {
                await opciones.nth(i).click({ noWaitAfter: true, force: true, timeout: 5000 });
            } catch (e) {
                onStep?.({ type: 'debug', message: `⚠️ Click suave en combo campus/ciclo: ${e}` });
            }
            await page.waitForTimeout(2500);
            onStep?.({ type: 'debug', message: `✅ Seleccionado: "${raw.trim()}" (idx ${i})` });
            seleccionado = true;
            seleccionadoConCiclo = true;
            break;
        }
    }

    // Estrategia 2: Solo campus (dropdown de dos niveles) — fallback
    if (!seleccionado) {
        for (let i = 0; i < count; i++) {
            const raw = (await opciones.nth(i).textContent().catch(() => '')) ?? '';
            const texto = norm(raw);
            if (texto.length > MAX_LONGITUD_OPCION && texto.includes(norm(campus))) {
                try {
                    await opciones.nth(i).click({ noWaitAfter: true, force: true, timeout: 5000 });
                } catch (e) {
                    onStep?.({ type: 'debug', message: `⚠️ Click suave en fallback campus: ${e}` });
                }
                await page.waitForTimeout(2000);
                onStep?.({ type: 'debug', message: `✅ Campus (fallback): "${raw.trim()}"` });
                seleccionado = true;
                break;
            }
        }
    }

    if (!seleccionado) {
        onStep?.({ type: 'debug', message: `⚠️ No se encontró opción para ${campus} ${ciclo}` });
        await page.keyboard.press('Escape');
        return;
    }

    await screenshot(page, `contexto_${campus}_${cicloC}`, onStep);

    // Si NO seleccionamos la combo completa (solo campus), buscar ciclo en segundo nivel
    if (!seleccionadoConCiclo) {
        await page.waitForTimeout(500);
        const opcionesCiclo = page.locator('ul li, li[ng-repeat], .uk-dropdown li, [role="option"]');
        const countC = await opcionesCiclo.count().catch(() => 0);
        if (countC > 0) {
            for (let i = 0; i < countC; i++) {
                const raw = await opcionesCiclo.nth(i).textContent().catch(() => '');
                const texto = norm(raw ?? '');
                if (texto.length < MAX_LONGITUD_OPCION && (texto.includes(ciclo) || texto.includes(cicloC))) {
                    try {
                        await opcionesCiclo.nth(i).click({ noWaitAfter: true, force: true, timeout: 5000 });
                    } catch (e) {
                        onStep?.({ type: 'debug', message: `⚠️ Click suave en ciclo 2º nivel: ${e}` });
                    }
                    await page.waitForTimeout(2500);
                    onStep?.({ type: 'debug', message: `✅ Ciclo ${cicloC} seleccionado en 2º nivel` });
                    break;
                }
            }
        }
    }

    // Verificar resultado
    await page.waitForTimeout(500);
    const headerFinal = await dropdownFallback.textContent({ timeout: 2000 }).catch(() => '???');
    onStep?.({ type: 'debug', message: `📍 Header después del cambio: "${headerFinal?.trim().substring(0, 50)}"` });
}

// ─── Navegar a General de Alumnos ──────────────────────────────────────────
async function navegarAGeneralDeAlumnos(page: Page, onStep?: SyncCallback): Promise<boolean> {
    try {
        onStep?.({ type: 'debug', message: '===== NAVEGACIÓN A GENERAL DE ALUMNOS (BRUTE FORCE) =====' });

        // 1. Cerrar cualquier menú abierto (act_section)
        await page.evaluate(() => {
            const activeMenus = document.querySelectorAll('li.act_section');
            activeMenus.forEach(m => (m as HTMLElement).click());
        }).catch(() => {});
        await page.waitForTimeout(400);

        // 2. Click en Escolar
        onStep?.({ type: 'debug', message: 'Paso 1: Click en Escolar...' });
        const clickedEscolar = await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('span, a'));
            const target = spans.find(s => s.textContent?.trim().toLowerCase() === 'escolar');
            if (target) { (target as HTMLElement).click(); return true; }
            return false;
        }).catch(() => false);
        if (!clickedEscolar) onStep?.({ type: 'debug', message: '⚠️ No se encontró el botón de Escolar' });
        await page.waitForTimeout(600);

        // 3. Click en Información Alumnos
        onStep?.({ type: 'debug', message: 'Paso 2: Click en Información Alumnos...' });
        const clickedInfo = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => {
                const txt = a.textContent?.trim().toLowerCase();
                const isVisible = (a as HTMLElement).offsetParent !== null;
                return isVisible && (txt.includes('información alumnos') || txt.includes('informacion alumnos'));
            });
            if (target) { (target as HTMLElement).click(); return true; }
            return false;
        }).catch(() => false);
        if (!clickedInfo) onStep?.({ type: 'debug', message: '⚠️ No se encontró el submenú Información Alumnos' });
        await page.waitForTimeout(600);

        // 4. Click en General de alumnos
        onStep?.({ type: 'debug', message: 'Paso 3: Click en General de alumnos...' });
        const clickedGral = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => {
                const txt = a.textContent?.trim().toLowerCase();
                return txt.includes('general de alumnos');
            });
            if (target) { (target as HTMLElement).click(); return true; }
            return false;
        }).catch(() => false);
        if (!clickedGral) onStep?.({ type: 'debug', message: '⚠️ No se encontró el link General de alumnos' });
        
        await page.waitForTimeout(1000); // Dar tiempo a que cargue la vista inicial

        // Verificar que el botón GENERAR está visible en el DOM (aunque falte cargar la tabla completa)
        const genBtn = page.locator('button, a').filter({ hasText: /^GENERAR$/i }).first();
        const genVisible = await genBtn.isVisible().catch(() => false);
        
        // Retornar true si la navegación pareció exitosa y el botón se asoma
        if (genVisible) {
            onStep?.({ type: 'debug', message: '✅ Navegación Exitosa: Botón GENERAR encontrado' });
            return true;
        } else {
            // Intentar un recargo duro de la URL que Innovat usa para "General de Alumnos"
            try {
                const url = page.url();
                if (!url.includes('/gralalumnos') && !url.toLowerCase().includes('general')) {
                    onStep?.({ type: 'debug', message: '⚠️ Falló navegación UI, forzando URL directa...' });
                    const menuUrl = await page.evaluate(() => {
                        const target = Array.from(document.querySelectorAll('a')).find(a => a.textContent?.trim().toLowerCase().includes('general de alumnos'));
                        return target ? target.getAttribute('href') : null;
                    });
                    if (menuUrl) {
                        await page.goto(new URL(menuUrl, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await page.waitForTimeout(2000);
                        return await genBtn.isVisible().catch(() => false);
                    }
                }
            } catch (e) { }
            return false;
        }
    } catch (e) {
        onStep?.({ type: 'debug', message: `❌ Excepción en navegación: ${e}` });
        return false;
    }
}

let gralalumnosReqBody: string | null = null;
let gralalumnosReqUrl: string | null = null;
let gralalumnosReqHeaders: Record<string, string> = {};

// ─── Fallback Directo (Producción) ────────────────────────────────────────
async function ejecutarFallbackDirecto(
    page: Page,
    botonGenerar: ReturnType<Page['locator']>,
    filePath: string,
    campus: string,
    ciclo: string,
    onStep?: SyncCallback
): Promise<boolean> {
    try {
        onStep?.({ type: 'debug', message: '🔄 Ejecutando fetch directo al API de Innovat' });
        
        // Detectar URL de la API dinámicamente
        const currentUrl = page.url();
        const match = currentUrl.match(/Gaia\/([\d\.]+)/);
        const version = match ? match[1] : '32.3.1';
        const apiUrl = `https://innovat1.mx/Gaia/${version}/api/gralalumnos`;
        onStep?.({ type: 'debug', message: `📡 API: ${apiUrl}` });

        const templateBody = {
            Filtro: 'Unidad', Ids: [], Estatus: 1, OptHermanos: 'TODOS',
            Campos: [
                { Alias: 'Matrícula', Codigo: 'A1', Seccion: 1, Columna: 1, Selected: true },
                { Alias: 'Nombre corto', Codigo: 'A5', Seccion: 1, Columna: 2, Selected: true },
                { Alias: 'Unidad', Codigo: 'A16', Seccion: 1, Columna: 3, Selected: true },
                { Alias: 'Grado', Codigo: 'A8', Seccion: 1, Columna: 4, Selected: true },
                { Alias: 'Grupo', Codigo: 'A9', Seccion: 1, Columna: 5, Selected: true },
                { Alias: 'Estatus', Codigo: 'A10', Seccion: 1, Columna: 6, Selected: true },
                { Alias: 'Fecha estatus', Codigo: 'A11', Seccion: 1, Columna: 7, Selected: true },
                { Alias: 'Comentario estatus', Codigo: 'A12', Seccion: 1, Columna: 8, Selected: true }
            ], Tipo: 'xlsx', Hermanos: 'TODOS',
        };

        const unitId = UNIT_IDS[ciclo]?.[campus];
        if (!unitId) {
            onStep?.({ type: 'debug', message: `❌ No se encontró unit ID para ${campus} ${ciclo}` });
            return false;
        }

        onStep?.({ type: 'debug', message: `🔍 Unit ID ${unitId} para ${campus} ${ciclo}` });

        const estatusValues = ciclo === '2026-2027' ? [-1, 1, 0, 2] : [1];

        for (const estatusValue of estatusValues) {
            if (estatusValues.length > 1) {
                onStep?.({ type: 'debug', message: `🔍 Probando Estatus: ${estatusValue}` });
            }

            const scanBody = JSON.stringify({
                ...templateBody,
                Filtro: 'Unidad',
                Ids: [unitId],
                Estatus: estatusValue
            });

            let result: { status: number; text: string; method: string };
            try {
                result = await page.evaluate(
                    async ({ url, body }: { url: string; body: string }) => {
                        for (const method of ['PUT', 'POST']) {
                            try {
                                const res = await fetch(url, {
                                    method,
                                    credentials: 'include',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json, text/plain, */*'
                                    },
                                    body,
                                });
                                const text = await res.text();
                                return { status: res.status, text, method };
                            } catch (e) {
                                return { status: -1, text: String(e), method };
                            }
                        }
                        return { status: 500, text: 'No se intentó ningún método', method: '' };
                    },
                    { url: apiUrl, body: scanBody }
                );
            } catch (evalError) {
                onStep?.({ type: 'debug', message: `❌ Error en fetch: ${evalError}` });
                continue;
            }

            if (result.status !== 200 || result.text.length < 5) {
                const errorBody = result.text?.substring(0, 200) || '(vacío)';
                onStep?.({ type: 'debug', message: `  Estatus ${estatusValue}: HTTP ${result.status} → ${errorBody}` });
                continue;
            }

            let json: Record<string, unknown>[];
            try { 
                json = JSON.parse(result.text); 
            } catch {
                onStep?.({ type: 'debug', message: `  Estatus ${estatusValue}: JSON inválido` });
                continue;
            }

            if (!Array.isArray(json) || json.length === 0) {
                onStep?.({ type: 'debug', message: `  Estatus ${estatusValue}: respuesta vacía` });
                continue;
            }

            onStep?.({ type: 'debug', message: `✅ ${json.length} alumnos obtenidos con Estatus ${estatusValue}` });
            
            // Procesar directamente en BD
            try {
                const guardados = await procesarYGuardarDatos(json, campus, ciclo, onStep);
                if (guardados > 0) {
                    onStep?.({ type: 'debug', message: `✅ ${guardados} alumnos guardados en BD` });
                    await writeFile(filePath, Buffer.from('Procesado directamente en BD'));
                    return true;
                } else {
                    onStep?.({ type: 'debug', message: `⚠️ No se guardaron registros` });
                }
            } catch (error) {
                onStep?.({ type: 'debug', message: `❌ Error guardando: ${error}` });
                onStep?.({ type: 'debug', message: `❌ Stack: ${error instanceof Error ? error.stack : 'N/A'}` });
            }
        }

        onStep?.({ type: 'debug', message: `❌ No se encontraron datos para ${campus}` });
        return false;
    } catch (error) {
        onStep?.({ type: 'debug', message: `❌ Error crítico en fallback: ${error}` });
        onStep?.({ type: 'debug', message: `❌ Stack: ${error instanceof Error ? error.stack : 'N/A'}` });
        return false;
    }
}

// ─── Descarga con Interceptor ─────────────────────────────────────────────
// Estrategia:
// 1. Escuchar el REQUEST para capturar el body (que contiene los filtros)
// 2. Escuchar el RESPONSE para convertir JSON → Excel
// 3. Si el interceptor falla (rate limit), hacer fetch directo con el mismo body pero
//    modificando el parámetro de unidad para el campus correcto
async function descargarConInterceptor(
    page: Page,
    botonGenerar: ReturnType<Page['locator']>,
    filePath: string,
    campus: string,
    ciclo: string,
    onStep?: SyncCallback
): Promise<boolean> {
    // En producción, ejecutar fallback directo (sin interceptor)
    const isCloudEnv = process.env.RENDER_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
    if (isCloudEnv) {
        onStep?.({ type: 'debug', message: '⏭️ Modo producción - ejecutando fetch directo sin interceptor' });
        return await ejecutarFallbackDirecto(page, botonGenerar, filePath, campus, ciclo, onStep);
    }
    
    // ── Intento 1: Interceptar via page.on('response') ──────────────────────
    const exito = await new Promise<boolean>(async (resolve) => {
        let capturado = false;
        let yaSalido = false; // FIX: evita que el executor siga corriendo tras resolve()
        let timeoutId: ReturnType<typeof setTimeout>;

        // Capturar el REQUEST body antes de que llegue la respuesta
        const requestHandler = async (request: import('playwright').Request) => {
            if (!request.url().includes('gralalumnos')) return;
            try {
                gralalumnosReqUrl = request.url();
                gralalumnosReqHeaders = request.headers();
                const body = request.postData();
                if (body) {
                    gralalumnosReqBody = body;
                    onStep?.({ type: 'debug', message: `📤 Request capturado: ${body.substring(0, 150)}` });
                }
            } catch { }
        };
        page.on('request', requestHandler);

        // Handler de respuesta
        const responseHandler = async (response: import('playwright').Response) => {
            if (capturado) return;
            try {
                const url = response.url();
                const status = response.status();
                const contentType = response.headers()['content-type'] ?? '';
                const method = response.request().method();

                // LOG de respuestas no-triviales
                const esHtmlOJs = contentType.includes('html') || contentType.includes('javascript')
                    || contentType.includes('css') || contentType.includes('image') || contentType.includes('font');
                if (!esHtmlOJs && !url.includes('google') && !url.includes('fonts')) {
                    onStep?.({ type: 'debug', message: `📡 [${method}] ${status} ${contentType || 'sin-type'} — ${url.substring(0, 100)}` });
                }

                if (url.includes('gralalumnos')) {
                    onStep?.({ type: 'debug', message: `📄 gralalumnos status: ${status}` });
                    if (status !== 200) {
                        const errBody = await response.text().catch(() => '');
                        onStep?.({ type: 'debug', message: `❌ Error ${status}: ${errBody.substring(0, 200)}` });
                        return;
                    }
                    
                    // RENDER/RAILWAY FIX: En entornos cloud, el interceptor tradicional causa OOM
                    // El motor interno (page.evaluate fetch) es mucho más eficiente
                    const isCloudEnv = process.env.RENDER_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
                    onStep?.({ type: 'debug', message: `🔍 Env check: RENDER=${process.env.RENDER_ENVIRONMENT} NODE_ENV=${process.env.NODE_ENV} isCloud=${isCloudEnv}` });
                    
                    if (isCloudEnv) {
                        onStep?.({ type: 'debug', message: `✅ Respuesta detectada - motor interno se encargará del procesamiento` });
                        return; // Dejar que el motor interno maneje todo
                    }
                    
                    onStep?.({ type: 'debug', message: `📡 Capturando cuerpo masivo...` });
                    const bodyBuffer = await response.body().catch(() => Buffer.from(''));
                    onStep?.({ type: 'debug', message: `📡 Datos recibidos: ${(bodyBuffer.length / 1024).toFixed(1)} KB` });

                    if (bodyBuffer.length < 10) return;

                    // Pequeña pausa para permitir que el event loop de NodeJS procese logs y no muera por OOM
                    await new Promise(r => setTimeout(r, 200));
                    
                    const bodyString = bodyBuffer.toString('utf-8');
                    const json = JSON.parse(bodyString);
                    const result = Array.isArray(json) ? json : (json.data || json.items || []);

                    if (Array.isArray(result) && result.length > 0) {
                        onStep?.({ type: 'debug', message: `📊 Procesando ${result.length} alumnos para Excel...` });
                        
                        await new Promise(r => setTimeout(r, 200));

                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.json_to_sheet(result);
                        XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
                        const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                        
                        capturado = true;
                        yaSalido = true;
                        clearTimeout(timeoutId);
                        page.off('response', responseHandler);
                        page.off('request', requestHandler);
                        await writeFile(filePath, buffer);
                        onStep?.({ type: 'debug', message: `💾 Excel: ${result.length} alumnos → ${buffer.length} bytes` });
                        resolve(true);
                    } else {
                        onStep?.({ type: 'debug', message: `ℹ️ JSON recibido pero no contiene una lista válida: ${JSON.stringify(json || {}).substring(0, 100)}` });
                    }
                }
            } catch (e) {
                onStep?.({ type: 'debug', message: `[response handler] Error: ${e}` });
            }
        };

        page.on('response', responseHandler);

        // FIX 3.1: En producción, timeout corto para activar fallback rápido
        const isCloudEnv = process.env.RENDER_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
        const esCampusGrande = campus === 'CUMBRES' || campus === 'ANAHUAC';
        const timeoutDuration = isCloudEnv 
            ? 15_000  // 15 segundos en producción - activar fallback rápido
            : (ciclo === '2026-2027'
                ? (esCampusGrande ? 180_000 : 120_000)
                : (esCampusGrande ? 120_000 : 60_000));

        timeoutId = setTimeout(async () => {
            try {
                page.off('response', responseHandler);
                page.off('request', requestHandler);
            } catch {
                // Página ya cerrada, ignorar
            }
            if (!capturado) {
                const timeoutSeconds = timeoutDuration / 1000;
                yaSalido = true;
                onStep?.({ type: 'debug', message: `⏱️ Timeout del interceptor (${timeoutSeconds}s) — intentando fetch directo...` });
                resolve(false);
            }
        }, timeoutDuration);

        // FIX 3.5: Segundo motor (Internal Fetch) - DESHABILITADO en producción
        // En producción, usamos el fallback de fetch directo que es más confiable
        const internalFetchTimeout = setTimeout(async () => {
            // Motor interno deshabilitado en producción - usar fallback
            const isCloudEnv = process.env.RENDER_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
            if (isCloudEnv) {
                onStep?.({ type: 'debug', message: '⏭️ Motor interno deshabilitado en producción - usando fallback' });
                return;
            }
            if (capturado || yaSalido) return;
            
            // Esperar hasta 5 segundos más si el request aún no se capturó
            let intentos = 0;
            while (!gralalumnosReqUrl && intentos < 10) {
                await new Promise(r => setTimeout(r, 500));
                intentos++;
            }
            
            if (capturado || yaSalido) return;
            
            onStep?.({ type: 'debug', message: `🚀 Disparando extracción interna para ${campus}...` });
            
            // Construir URL de API si no se capturó
            let apiUrlFallback = gralalumnosReqUrl;
            if (!apiUrlFallback) {
                const currentUrl = page.url();
                const match = currentUrl.match(/Gaia\/([\d\.]+)/);
                const version = match ? match[1] : '32.3.1';
                apiUrlFallback = `https://innovat1.mx/Gaia/${version}/api/gralalumnos`;
                onStep?.({ type: 'debug', message: `📡 URL no capturada, usando fallback: ${apiUrlFallback}` });
            }
            
            // Construir body con unit ID correcto
            const unitId = UNIT_IDS[ciclo]?.[campus];
            if (!unitId) {
                onStep?.({ type: 'debug', message: `❌ No se encontró unit ID para ${campus} ${ciclo}` });
                return;
            }
            
            const templateBody = {
                Filtro: 'Unidad', Ids: [unitId], Estatus: ciclo === '2026-2027' ? -1 : 1, OptHermanos: 'TODOS',
                Campos: [
                    { Alias: 'Matrícula', Codigo: 'A1', Seccion: 1, Columna: 1, Selected: true },
                    { Alias: 'Nombre corto', Codigo: 'A5', Seccion: 1, Columna: 2, Selected: true },
                    { Alias: 'Unidad', Codigo: 'A16', Seccion: 1, Columna: 3, Selected: true },
                    { Alias: 'Grado', Codigo: 'A8', Seccion: 1, Columna: 4, Selected: true },
                    { Alias: 'Grupo', Codigo: 'A9', Seccion: 1, Columna: 5, Selected: true },
                    { Alias: 'Estatus', Codigo: 'A10', Seccion: 1, Columna: 6, Selected: true },
                    { Alias: 'Fecha estatus', Codigo: 'A11', Seccion: 1, Columna: 7, Selected: true },
                    { Alias: 'Comentario estatus', Codigo: 'A12', Seccion: 1, Columna: 8, Selected: true }
                ], Tipo: 'xlsx', Hermanos: 'TODOS',
            };
            
            const bodyToUse = gralalumnosReqBody || JSON.stringify(templateBody);
            
            onStep?.({ type: 'debug', message: `📤 Fetch URL: ${apiUrlFallback}` });
            onStep?.({ type: 'debug', message: `📤 Body preview: ${bodyToUse.substring(0, 100)}...` });
            
            try {
                // Estrategia simplificada: guardar JSON en window y extraerlo por chunks
                const result = await page.evaluate(async (req) => {
                    try {
                        console.log('[Motor Interno] Iniciando fetch a:', req.url);
                        const res = await fetch(req.url, {
                            method: 'PUT',
                            body: req.body,
                            credentials: 'include',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Accept': 'application/json, text/plain, */*'
                            }
                        });
                        console.log('[Motor Interno] Status:', res.status);
                        
                        if (res.status !== 200) {
                            const errorText = await res.text().catch(() => 'no body');
                            return { error: `HTTP ${res.status}: ${errorText.substring(0, 200)}` };
                        }
                        
                        console.log('[Motor Interno] Parseando JSON...');
                        const json = await res.json();
                        const count = Array.isArray(json) ? json.length : 0;
                        console.log('[Motor Interno] JSON recibido, length:', count);
                        
                        if (!Array.isArray(json) || count === 0) {
                            return { error: 'No es array o está vacío' };
                        }
                        
                        // Guardar en window para extraer por chunks
                        (window as any).__innovatData = json;
                        console.log('[Motor Interno] Datos guardados en window');
                        
                        return { success: true, count };
                    } catch (e) {
                        console.error('[Motor Interno] Error:', e);
                        return { error: String(e) };
                    }
                }, { url: apiUrlFallback, body: bodyToUse });

                onStep?.({ type: 'debug', message: `📥 Resultado: ${result.success ? `${result.count} alumnos` : result.error}` });

                if (result?.success && result.count > 0 && !capturado) {
                    onStep?.({ type: 'debug', message: `🔍 Extracción interna exitosa: ${result.count} alumnos` });
                    onStep?.({ type: 'debug', message: `📦 Extrayendo datos en chunks de 50...` });
                    
                    const chunkSize = 50;
                    const totalChunks = Math.ceil(result.count / chunkSize);
                    const allData: any[] = [];
                    
                    for (let i = 0; i < totalChunks; i++) {
                        const chunk = await page.evaluate((params: { index: number, size: number }) => {
                            const data = (window as any).__innovatData || [];
                            return data.slice(params.index * params.size, (params.index + 1) * params.size);
                        }, { index: i, size: chunkSize });
                        
                        if (Array.isArray(chunk)) {
                            allData.push(...chunk);
                        }
                        
                        if ((i + 1) % 10 === 0) {
                            onStep?.({ type: 'debug', message: `📦 Extraídos ${allData.length}/${result.count}...` });
                        }
                    }
                    
                    await page.evaluate(() => { delete (window as any).__innovatData; });
                    
                    onStep?.({ type: 'debug', message: `📊 Generando Excel con ${allData.length} registros...` });
                    
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.json_to_sheet(allData);
                    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
                    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                    
                    capturado = true;
                    yaSalido = true;
                    clearTimeout(timeoutId);
                    await writeFile(filePath, buffer);
                    onStep?.({ type: 'debug', message: `💾 Excel guardado: ${buffer.length} bytes` });
                    resolve(true);
                } else if (result?.error) {
                    onStep?.({ type: 'debug', message: `⚠️ Falló extracción interna: ${result.error}` });
                } else {
                    onStep?.({ type: 'debug', message: `⚠️ Extracción interna sin resultado válido` });
                }
            } catch (e) {
                onStep?.({ type: 'debug', message: `⚠️ Error en evaluación interna: ${e}` });
            }
        }, (process.env.RENDER_ENVIRONMENT || process.env.NODE_ENV === 'production') ? 5000 : 15000); // 5s en producción, 15s en desarrollo

        try {
            // Verificar que el botón GENERAR está habilitado antes de hacer click
            const botonHabilitado = await botonGenerar.isEnabled().catch(() => false);
            const botonVisible = await botonGenerar.isVisible().catch(() => false);
            onStep?.({ type: 'debug', message: `🔍 Botón GENERAR - Visible: ${botonVisible}, Habilitado: ${botonHabilitado}` });

            if (!botonHabilitado) {
                onStep?.({ type: 'debug', message: '⚠️ Botón GENERAR deshabilitado, esperando...' });
                await page.waitForTimeout(3000);
            }

            // CRÍTICO: Simular un click más "humano" para disparar todos los eventos de AngularJS
            await botonGenerar.scrollIntoViewIfNeeded().catch(() => { });
            await page.waitForTimeout(500);

            await botonGenerar.focus().catch(() => { });
            await page.waitForTimeout(300);

            await botonGenerar.click({ force: true });
            onStep?.({ type: 'debug', message: '🖱️ Click en GENERAR ejecutado' });

            // Esperar un momento para que AngularJS procese el click
            await page.waitForTimeout(1000);

            if (yaSalido) {
                clearTimeout(internalFetchTimeout);
                onStep?.({ type: 'debug', message: '✅ Saliendo: Datos ya capturados por el interceptor' });
                return;
            }

            // En producción, el motor interno maneja todo - no necesitamos esperar el icono de Excel
            const isCloudEnv = process.env.RENDER_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
            if (isCloudEnv) {
                onStep?.({ type: 'debug', message: '⏳ Esperando motor interno (5s)...' });
                // Esperar a que el motor interno complete (timeout + margen)
                const waitTime = Math.max(10000, timeoutDuration - 50000);
                for (let i = 0; i < waitTime / 500 && !yaSalido; i++) {
                    await page.waitForTimeout(500).catch(() => {});
                }
                clearTimeout(internalFetchTimeout);
                return;
            }

            onStep?.({ type: 'debug', message: '⏳ Esperando a que aparezca el icono de Excel...' });

            const iconoExcel = page.locator(
                'i.mdi-file-excel[ng-click*="ExportarExcel"], ' +
                'i[class*="mdi-file-excel"][ng-click*="Exportar"], ' +
                '[ng-click*="ExportarExcel"]'
            ).first();

            const MARGEN_INTERCEPTOR = 30_000;
            const timeoutIcono = Math.max(15_000, timeoutDuration - MARGEN_INTERCEPTOR);
            onStep?.({ type: 'debug', message: `⏳ Esperando icono Excel (timeout: ${timeoutIcono / 1000}s)...` });

            let excelVisible = false;
            try {
                await iconoExcel.waitFor({ state: 'visible', timeout: timeoutIcono }).catch(() => {});
                if (!yaSalido) {
                    const esVisibleConfirmado = await iconoExcel.isVisible().catch(() => false);
                    if (esVisibleConfirmado) {
                        excelVisible = true;
                        onStep?.({ type: 'debug', message: '✅ Icono de Excel apareció' });
                    }
                }
            } catch {
                if (!yaSalido) {
                    onStep?.({ type: 'debug', message: `⚠️ Timeout esperando icono de Excel (${timeoutIcono / 1000}s para ${campus} ${ciclo})` });
                }
            }

            if (page.isClosed()) {
                if (timeoutId) clearTimeout(timeoutId);
                clearTimeout(internalFetchTimeout);
                resolve(false);
                return;
            }

            if (excelVisible && !page.isClosed() && !yaSalido) {
                onStep?.({ type: 'debug', message: '✅ Haciendo click en icono de Excel...' });
                await iconoExcel.click({ force: true }).catch(async () => {
                    await page.evaluate(() => {
                        const el = document.querySelector('[ng-click*="ExportarExcel"]') as HTMLElement;
                        if (el) el.click();
                    }).catch(() => { });
                });
                for (let i = 0; i < MARGEN_INTERCEPTOR / 500 && !yaSalido; i++) {
                    await page.waitForTimeout(500).catch(() => { });
                }
            }

            clearTimeout(internalFetchTimeout);
        } catch (e) {
            if (timeoutId) clearTimeout(timeoutId);
            clearTimeout(internalFetchTimeout);
            try {
                page.off('response', responseHandler);
                page.off('request', requestHandler);
            } catch { }
            onStep?.({ type: 'debug', message: `❌ Error en click GENERAR: ${e}` });
            resolve(false);
        }
    });

    if (exito) return true;

    // En desarrollo, si el interceptor falla, usar el mismo fallback que producción
    onStep?.({ type: 'debug', message: '🔄 Interceptor falló - activando fallback' });
    return await ejecutarFallbackDirecto(page, botonGenerar, filePath, campus, ciclo, onStep);
}

// ─── Agente Principal ───────────────────────────────────────────────────────
export async function syncFromInnovat(
    campusList: string[] = CAMPUS_LIST,
    onStep?: SyncCallback
): Promise<string[]> {
    const uploadDir = await getUploadDir();
    const downloadedFiles: string[] = [];
    let browser: Browser | null = null;

    try {
        browser = await chromium.launch({
            headless: process.env.NODE_ENV === 'production',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-animations',
                // Configuración adicional para Render y entornos cloud
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                // Optimizaciones agresivas de memoria para Render
                ...(process.env.RENDER_ENVIRONMENT ? [
                    '--single-process',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-extensions',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--enable-features=NetworkService,NetworkServiceInProcess',
                    '--force-color-profile=srgb',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--disable-hang-monitor',
                    '--disable-prompt-on-repost',
                    '--disable-sync',
                    '--disable-translate',
                    '--disable-domain-reliability',
                    '--disable-client-side-phishing-detection',
                    '--memory-pressure-off',
                    // Límites de memoria explícitos
                    '--max-old-space-size=512',
                    '--js-flags=--max-old-space-size=512',
                    '--disable-software-rasterizer',
                    '--disable-canvas-aa',
                    '--disable-2d-canvas-clip-aa',
                    '--disable-gl-drawing-for-tests'
                ] : [])
            ],
        });

        const context = await browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1280, height: 720 },  // Reducido para ahorrar memoria en Render
            // Deshabilitar JavaScript innecesario para reducir memoria
            javaScriptEnabled: true, // Necesario para AngularJS
        });

        // ── OPTIMIZACIÓN: Bloquear recursos innecesarios (imágenes, fuentes) ──
        await context.route('**/*', (route) => {
            const request = route.request();
            const type = request.resourceType();
            // No bloqueamos 'stylesheet' porque AngularJS podría depender de elementos visibles (layout) para clics
            if (['image', 'media', 'font'].includes(type) || request.url().includes('google-analytics')) {
                route.abort();
            } else {
                route.continue();
            }
        });

        let page = await context.newPage();

        // ── 1. LOGIN ──────────────────────────────────────────────────────────
        onStep?.({ type: 'login' });
        onStep?.({ type: 'debug', message: `🔑 Credenciales: escuela="${INNOVAT_SCHOOL}" usuario="${INNOVAT_USER}"` });

        // Intentar cargar la página con reintento si tarda (el servidor Innovat puede ser lento)
        let loginCargado = false;
        for (let intento = 1; intento <= 3; intento++) {
            try {
                await page.goto(INNOVAT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
                loginCargado = true;
                break;
            } catch {
                onStep?.({ type: 'debug', message: `⏳ Intento ${intento}/3 de carga del login...` });
                await page.waitForTimeout(3000);
            }
        }
        if (!loginCargado) throw new Error('No se pudo cargar la página de login de Innovat tras 3 intentos');
        await page.waitForSelector('#NombreEscuela', { state: 'visible', timeout: 20000 });

        await screenshot(page, '01_login_page', onStep);

        await page.click('#NombreEscuela');
        await page.type('#NombreEscuela', INNOVAT_SCHOOL, { delay: 50 });
        await page.waitForTimeout(1500);

        const sugerencia = page.locator('md-autocomplete-parent-scope li, .md-autocomplete-suggestions li').first();
        if (await sugerencia.isVisible({ timeout: 2000 }).catch(() => false)) {
            await sugerencia.click();
        } else {
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(500);

        await page.fill('#NombreUsuario', INNOVAT_USER);
        await page.fill('#Contrasena', INNOVAT_PASS);
        await page.locator('button[type="submit"], input[type="submit"], .md-btn-primary').first().click();
        await page.waitForTimeout(3500);

        await screenshot(page, '02_post_login', onStep);
        onStep?.({ type: 'debug', message: `📍 URL: ${page.url()}` });

        // Verificar login exitoso
        const errorLogin = await page.locator('text=Datos de acceso incorrectos').isVisible({ timeout: 1000 }).catch(() => false);
        if (errorLogin || page.url().includes('/login')) {
            throw new Error(
                `❌ Login fallido — Escuela: "${INNOVAT_SCHOOL}" | Usuario: "${INNOVAT_USER}"\n` +
                `Configura INNOVAT_USER, INNOVAT_PASS e INNOVAT_SCHOOL en .env.local`
            );
        }
        onStep?.({ type: 'debug', message: `✅ Login exitoso` });

        // ── 2. POR CADA CAMPUS Y CICLO ────────────────────────────────────────
        // FIX CRÍTICO: Abrir página nueva para CADA combinación campus+ciclo
        // Esto elimina el "fantasma" del ciclo anterior que hacía click en ExportarExcel
        // y corrompía el estado de AngularJS para el siguiente ciclo
        let esPrimeraCombinacion = true;
        for (const campus of campusList) {
            for (const ciclo of CICLOS) {
                onStep?.({ type: 'campus', campus, ciclo });

                try {
                    // Verificar que el navegador sigue activo
                    if (page.isClosed() || !browser || !browser.isConnected()) {
                        onStep?.({ type: 'error', message: `Error en ${campus} ${ciclo}: Navegador cerrado prematuramente (posible OOM)` });
                        break; // Salir del loop de ciclos para este campus
                    }
                    
                    // FIX CRÍTICO: Limpiar página sin destruirla para no perder sessionStorage de Angular
                    if (!esPrimeraCombinacion) {
                        onStep?.({ type: 'debug', message: `♻️ Página limpia para ${campus} ${ciclo}... (Soft reload)` });
                        try {
                            // Cambiamos el hash de Angular suavemente para forzar que el router se limpie
                            // sin necesidad de refrescar todo el navegador (que causa pérdida de sesión)
                            await page.evaluate(() => {
                                window.location.hash = '/Inicio';
                            });
                            await page.waitForTimeout(2000);
                        } catch (e) {
                            onStep?.({ type: 'debug', message: `⚠️ Error en soft reload: ${e}` });
                        }
                    }
                    esPrimeraCombinacion = false;

                    // ── 2a. Cambiar campus/ciclo en el header
                    await cambiarCampusCiclo(page, campus, ciclo, onStep);
                    
                    // Darle mucho más tiempo al servidor de Innovat para cambiar el ciclo en la sesión
                    // (A veces el ciclo 2026-2027 tarda bastante en cargar y si navegamos muy rápido se interrumpe)
                    await page.waitForTimeout(4000); 

                    // ── 2b. Navegar a General de Alumnos
                    const navOk = await navegarAGeneralDeAlumnos(page, onStep);
                    if (!navOk) {
                        onStep?.({ type: 'debug', message: '⏳ Reintentando navegación...' });
                        await page.waitForTimeout(3000);
                        await navegarAGeneralDeAlumnos(page, onStep);
                        await page.waitForTimeout(2000);
                    }

                    await screenshot(page, `en_reporte_${campus}_${cicloCorto(ciclo)}`, onStep);

                    // ── 2c. Localizar botón GENERAR
                    const botonGenerar = page.locator('a, button').filter({ hasText: /^generar$/i }).first();
                    // Aumentamos el timeout a 25s, porque 2026-2027 a veces es muy lento creando la vista de Cumbres/Mitras
                    const genVisible = await botonGenerar.isVisible().catch(() => false);
                    if (!genVisible) {
                        onStep?.({ type: 'error', message: `Error en ${campus} ${ciclo}: Botón GENERAR no visible` });
                        continue;
                    }

                    // ── 2d. ESTRATEGIA DE UNIT ID: Capturar IDs reales desde el autocomplete de Innovat
                    // El problema confirmado: para 2026-2027, las unidades pueden tener nombres/IDs distintos
                    // y el autocomplete no encuentra resultados al buscar "CUMB" o "ANÁH"
                    // Solución: interceptar la respuesta del autocomplete API y obtener los IDs directamente,
                    // luego inyectarlos en el scope de AngularJS sin pasar por la UI
                    try {
                        const seleccioneInput = page.locator([
                            'md-autocomplete input[placeholder*="Seleccione"]',
                            'md-autocomplete input[placeholder*="seleccione"]',
                            'input[placeholder*="Seleccione"]',
                            'md-autocomplete input',
                        ].join(', ')).first();

                        const inputVisible = await seleccioneInput.isVisible({ timeout: 3000 }).catch(() => false);
                        onStep?.({ type: 'debug', message: `🔍 Campo "Seleccione..." visible: ${inputVisible}` });

                        if (inputVisible) {
                            const valorActual = await seleccioneInput.inputValue({ timeout: 1000 }).catch(() => '');
                            onStep?.({ type: 'debug', message: `🔍 Valor actual: "${valorActual || '(vacío)'}"` });

                            if (!valorActual || valorActual.trim() === '') {
                                // Estrategia 1: Interceptar la respuesta del autocomplete API
                                // Cuando se hace click y se escribe, Innovat llama algo como /api/unidadesfiltro o similar
                                let unidadIdCapturado: string | null = null;
                                let todasLasUnidades: Array<{ id: string, nombre: string }> = [];

                                const autocompleteHandler = async (response: import('playwright').Response) => {
                                    try {
                                        const url = response.url();
                                        // Capturar cualquier respuesta JSON que parezca ser de unidades
                                        if ((url.includes('unidad') || url.includes('Unidad') || url.includes('plantel') || url.includes('filtro'))
                                            && response.status() === 200) {
                                            const text = await response.text().catch(() => '');
                                            if (text.startsWith('[') || text.startsWith('{')) {
                                                onStep?.({ type: 'debug', message: `📡 Autocomplete API: ${url.split('/').pop()} → ${text.substring(0, 200)}` });
                                                try {
                                                    const data = JSON.parse(text);
                                                    const items = Array.isArray(data) ? data : (data.data || data.items || []);
                                                    for (const item of items) {
                                                        // Innovat usa diferentes nombres de campo: Id, id, IdUnidad, Nombre, nombre, Descripcion
                                                        const id = String(item.Id ?? item.id ?? item.IdUnidad ?? item.IdPlantel ?? '');
                                                        const nombre = String(item.Nombre ?? item.nombre ?? item.Descripcion ?? item.descripcion ?? item.NombreUnidad ?? '');
                                                        if (id) todasLasUnidades.push({ id, nombre });
                                                        // Si el nombre coincide con el campus, capturar el ID
                                                        const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                                                        if (norm(nombre).includes(norm(campus).substring(0, 4))) {
                                                            unidadIdCapturado = id;
                                                        }
                                                    }
                                                } catch { }
                                            }
                                        }
                                    } catch { }
                                };
                                page.on('response', autocompleteHandler);

                                // Disparar el autocomplete con varios intentos
                                await seleccioneInput.click({ force: true });
                                await page.waitForTimeout(800);

                                // Intento 1: Escribir el campus para filtrar
                                const campusBusqueda = campus === 'ANAHUAC' ? 'ANÁHUAC' : campus;
                                await seleccioneInput.type(campusBusqueda.substring(0, 4), { delay: 80 });
                                await page.waitForTimeout(2000); // Más tiempo para que responda el servidor

                                const sugerencias = page.locator([
                                    'ul.md-autocomplete-suggestions li',
                                    'li[md-virtual-repeat]',
                                    'md-virtual-repeat-container li',
                                    '.md-autocomplete-suggestions-container li',
                                ].join(', '));

                                let countS = await sugerencias.count().catch(() => 0);
                                onStep?.({ type: 'debug', message: `📋 Sugerencias con "${campusBusqueda.substring(0, 4)}": ${countS}` });

                                // Intento 2: Borrar y probar con espacio para ver TODAS las opciones
                                if (countS === 0) {
                                    await seleccioneInput.fill('');
                                    await seleccioneInput.press('Space');
                                    await page.waitForTimeout(2000);
                                    countS = await sugerencias.count().catch(() => 0);
                                    onStep?.({ type: 'debug', message: `📋 Sugerencias con espacio: ${countS}` });
                                }

                                // Intento 3: Sin texto, solo ArrowDown
                                if (countS === 0) {
                                    await seleccioneInput.fill('');
                                    await page.waitForTimeout(500);
                                    await seleccioneInput.press('ArrowDown');
                                    await page.waitForTimeout(2000);
                                    countS = await sugerencias.count().catch(() => 0);
                                    onStep?.({ type: 'debug', message: `📋 Sugerencias con ArrowDown: ${countS}` });
                                }

                                page.off('response', autocompleteHandler);

                                // Loguear TODAS las unidades capturadas de la API
                                if (todasLasUnidades.length > 0) {
                                    onStep?.({ type: 'debug', message: `📋 Unidades capturadas desde API (${todasLasUnidades.length}):` });
                                    for (const u of todasLasUnidades.slice(0, 15)) {
                                        onStep?.({ type: 'debug', message: `  ID=${u.id} → "${u.nombre}"` });
                                    }
                                }

                                if (countS > 0) {
                                    // Hay sugerencias en la UI — loguear y seleccionar la que coincida
                                    let seleccionado = false;
                                    for (let s = 0; s < countS && s < 15; s++) {
                                        const t = (await sugerencias.nth(s).textContent().catch(() => '')) ?? '';
                                        onStep?.({ type: 'debug', message: `  sugerencia[${s}]: "${t.trim()}"` });
                                        if (t.toUpperCase().includes(campus.substring(0, 4))) {
                                            await sugerencias.nth(s).click();
                                            seleccionado = true;
                                            onStep?.({ type: 'debug', message: `✅ Unidad "${campus}" seleccionada desde UI` });
                                            break;
                                        }
                                    }
                                    if (!seleccionado) {
                                        await sugerencias.first().click();
                                        onStep?.({ type: 'debug', message: `⚠️ Seleccionada primera sugerencia de UI` });
                                    }
                                    await page.waitForTimeout(800);
                                } else if (unidadIdCapturado) {
                                    // No hay UI pero capturamos el ID desde la API — inyectar en AngularJS
                                    onStep?.({ type: 'debug', message: `🔧 Inyectando unit ID ${unidadIdCapturado} en AngularJS scope...` });
                                    await page.keyboard.press('Escape');
                                    await page.evaluate((uid: string) => {
                                        try {
                                            // @ts-ignore
                                            const w = window as any;
                                            const scope = w.angular?.element(document.querySelector('[ng-controller], .ng-scope'))?.scope?.();
                                            if (scope) {
                                                scope.$apply(() => {
                                                    if (scope.vm) scope.vm.Ids = [uid];
                                                    else if (scope.Ids !== undefined) scope.Ids = [uid];
                                                });
                                            }
                                        } catch { }
                                    }, unidadIdCapturado);
                                    await page.waitForTimeout(500);
                                    onStep?.({ type: 'debug', message: `✅ Unit ID ${unidadIdCapturado} inyectado` });
                                } else {
                                    // Sin sugerencias UI ni API — el campo queda vacío
                                    await page.keyboard.press('Escape');
                                    onStep?.({ type: 'debug', message: `❌ No se pudo seleccionar unidad para ${campus} ${ciclo}` });
                                    onStep?.({ type: 'debug', message: `ℹ️ Unidades disponibles en API: ${JSON.stringify(todasLasUnidades)}` });
                                }

                                await screenshot(page, `despues_seleccione_${campus}_${cicloCorto(ciclo)}`, onStep);
                            } else {
                                onStep?.({ type: 'debug', message: `✅ Campo ya tiene valor: "${valorActual}"` });
                            }
                        } else {
                            onStep?.({ type: 'debug', message: `ℹ️ Campo "Seleccione..." no visible — campus IDs preseleccionados por AngularJS` });
                        }
                    } catch (e) {
                        onStep?.({ type: 'debug', message: `⚠️ Error en campo Seleccione: ${e}` });
                    }

                    // ── 2e. SELECCIONAR "AMBOS" EN BOTONES RADIALES (para ciclo 2026-2027) ───
                    // Según el usuario, para ciclo 2026-2027 hay que seleccionar "Ambos" en los botones radiales
                    if (ciclo === '2026-2027') {
                        try {
                            onStep?.({ type: 'debug', message: '🔘 Buscando botón radio "Ambos" para ciclo 2026-2027...' });

                            // Para iCheck, necesitamos hacer click en el elemento <ins> que intercepta los clicks
                            // Buscar el label "Ambos" y luego el ins helper
                            const labelAmbos = page.locator('label').filter({ hasText: /^Ambos$/i }).first();

                            if (await labelAmbos.isVisible().catch(() => false)) {
                                // Hacer click directamente en el label (iCheck lo maneja)
                                onStep?.({ type: 'debug', message: '✅ Seleccionando "Ambos"...' });
                                await labelAmbos.click({ force: true });
                                await page.waitForTimeout(500);
                            } else {
                                // Fallback: buscar el ins.iCheck-helper directamente
                                const insHelper = page.locator('.iCheck-helper').first();
                                if (await insHelper.isVisible({ timeout: 1000 })) {
                                    await insHelper.click({ force: true });
                                    await page.waitForTimeout(500);
                                } else {
                                    onStep?.({ type: 'debug', message: '⚠️ No se encontró botón radio "Ambos"' });
                                }
                            }
                        } catch (e) {
                            onStep?.({ type: 'debug', message: `⚠️ Error al seleccionar "Ambos": ${e}` });
                        }
                    }

                    // ── 2f. ASEGURAR CHECKBOXES DE CAMPOS NECESARIOS (TÉCNICA MITRAS) ───────────────────
                    try {
                        onStep?.({ type: 'debug', message: '📋 Configurando campos necesarios (técnica robusta)...' });

                        const camposNecesarios = [
                            { campo: 'Matrícula', tab: 'Alumno' },
                            { campo: 'Nombre corto', tab: 'Alumno' },
                            { campo: 'Unidad', tab: 'Administrativos' },
                            { campo: 'Grado', tab: 'Administrativos' },
                            { campo: 'Grupo', tab: 'Administrativos' },
                            { campo: 'Estatus', tab: 'Administrativos' },
                            { campo: 'Fecha estatus', tab: 'Administrativos' },
                            { campo: 'Comentario estatus', tab: 'Administrativos' },
                        ];

                        // Agrupar por pestaña
                        const tabs = Array.from(new Set(camposNecesarios.map(c => c.tab)));

                        for (const tabName of tabs) {
                            // 1. Intentar navegar a la pestaña
                            const tabSelector = `a:has-text("${tabName}"), span:has-text("${tabName}"), .uk-tab a:has-text("${tabName}")`;
                            const tabFound = await page.evaluate((name) => {
                                const elements = Array.from(document.querySelectorAll('.uk-tab a, .uk-tab span, a, span'));
                                const target = elements.find(el => el.textContent?.trim().toUpperCase() === name.toUpperCase());
                                if (target) { (target as HTMLElement).click(); return true; }
                                return false;
                            }, tabName);

                            if (tabFound) {
                                onStep?.({ type: 'debug', message: `📂 Pestaña "${tabName}" abierta` });
                                await page.waitForTimeout(1000);
                            }

                            // 2. Ejecutar técnica robusta de marcado (Add-only)
                            const camposDeEstaTab = camposNecesarios.filter(c => c.tab === tabName).map(c => c.campo);
                            
                            await page.evaluate(({ campos, tab }) => {
                                console.log(`[InnovatAgent] Verificando campos en ${tab}:`, campos);
                                const labels = Array.from(document.querySelectorAll('label'));
                                
                                for (const campo of campos) {
                                    const targetText = campo.toUpperCase();
                                    // Buscar label que contenga o sea exactamente el campo
                                    const lbl = labels.find(l => {
                                        const txt = l.textContent?.trim().toUpperCase() || '';
                                        return txt === targetText || txt.startsWith(targetText);
                                    });

                                    if (lbl) {
                                        // Buscar el input asociado (puede estar dentro o ser hermano)
                                        const input = (lbl.querySelector('input[type="checkbox"]') || 
                                                       lbl.parentElement?.querySelector('input[type="checkbox"]') ||
                                                       document.querySelector(`input[id="${lbl.getAttribute('for')}"]`)) as HTMLInputElement;
                                        
                                        if (input) {
                                            // SI NO ESTÁ MARCADO, LO MARCAMOS. 
                                            // SI YA ESTÁ MARCADO, LO DEJAMOS (No afectamos la selección previa)
                                            const isChecked = input.checked || 
                                                              input.parentElement?.classList.contains('checked') || 
                                                              input.closest('.icheckbox_flat-green')?.classList.contains('checked');
                                            
                                            if (!isChecked) {
                                                console.log(`[InnovatAgent] Marcando campo: ${campo}`);
                                                lbl.click();
                                            }
                                        }
                                    }
                                }
                            }, { campos: camposDeEstaTab, tab: tabName });
                            
                            await page.waitForTimeout(400);
                        }

                        // Volver a la pestaña principal Alumno
                        await page.evaluate(() => {
                            const alum = Array.from(document.querySelectorAll('.uk-tab a')).find(a => a.textContent?.trim().toUpperCase() === 'ALUMNO');
                            if (alum) (alum as HTMLElement).click();
                        }).catch(() => {});

                        onStep?.({ type: 'debug', message: '✅ Campos configurados correctamente' });
                    } catch (e) {
                        onStep?.({ type: 'debug', message: `⚠️ Error al configurar campos: ${e}` });
                    }

                    // ── ESPERA CRÍTICA: Dar tiempo al formulario para que se actualice completamente ───
                    // Para ciclo 2026-2027, especialmente CUMBRES y ANAHUAC, el formulario necesita
                    // tiempo adicional para procesar todos los cambios antes de hacer click en GENERAR
                    if (ciclo === '2026-2027') {
                        const tiempoEsperaFormulario = campus === 'CUMBRES' || campus === 'ANAHUAC' ? 3000 : 2000;
                        onStep?.({ type: 'debug', message: `⏳ Esperando ${tiempoEsperaFormulario}ms para que el formulario se actualice...` });
                        await page.waitForTimeout(tiempoEsperaFormulario);
                    }

                    // ── 2e. Descargar con interceptor de red
                    const fileName = campusNombreArchivo(campus, ciclo);
                    const filePath = join(uploadDir, fileName);

                    const descargado = await descargarConInterceptor(page, botonGenerar, filePath, campus, ciclo, onStep);

                    if (descargado) {
                        downloadedFiles.push(fileName);
                        onStep?.({ type: 'downloaded', campus, ciclo, path: filePath });
                    } else {
                        // Si el interceptor falló, guardar HTML para investigar
                        await saveHtml(page, `fallo_${campus}_${cicloCorto(ciclo)}`);
                        await screenshot(page, `fallo_${campus}_${cicloCorto(ciclo)}`, onStep);
                        onStep?.({ type: 'error', message: `Error en ${campus} ${ciclo}: No se capturó el Excel. Ver /upload/debug/` });
                    }

                    await page.waitForTimeout(1500);

                } catch (campusErr) {
                    const msg = campusErr instanceof Error ? campusErr.message : String(campusErr);
                    onStep?.({ type: 'error', message: `Error en ${campus} ${ciclo}: ${msg}` });
                    await screenshot(page, `ERROR_${campus}_${cicloCorto(ciclo)}`, onStep).catch(() => { });
                }
            }
        }



        onStep?.({ type: 'done', files: downloadedFiles });
        return downloadedFiles;

    } finally {
        await browser?.close();
    }
}
