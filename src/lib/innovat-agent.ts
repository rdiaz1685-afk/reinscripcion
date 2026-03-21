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

// ─── Tipos ─────────────────────────────────────────────────────────────────
export type SyncStep =
    | { type: 'login' }
    | { type: 'campus'; campus: string; ciclo: string }
    | { type: 'downloaded'; campus: string; ciclo: string; path: string }
    | { type: 'error'; message: string }
    | { type: 'done'; files: string[] }
    | { type: 'debug'; message: string };

export type SyncCallback = (step: SyncStep) => void;

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getUploadDir(): Promise<string> {
    const dir = process.env.RAILWAY_ENVIRONMENT
        ? '/app/upload'
        : join(process.cwd(), 'upload');
    await mkdir(dir, { recursive: true });
    return dir;
}

async function getDebugDir(): Promise<string> {
    const dir = process.env.RAILWAY_ENVIRONMENT
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
    // Ir a Inicio primero para limpiar estado
    try {
        const inicio = page.locator('a, span').filter({ hasText: /^INICIO$|^Inicio$/i }).first();
        if (await inicio.isVisible({ timeout: 2000 })) {
            await inicio.click();
            await page.waitForTimeout(1000);
        }
    } catch { }

    // Menú: Escolar → Información Alumnos → General de alumnos
    try {
        const escolar = page.locator('li, a, span, div').filter({ hasText: /^Escolar$/i }).first();
        if (await escolar.isVisible({ timeout: 2000 })) {
            await escolar.click();
            await page.waitForTimeout(600);
        }
    } catch { }

    try {
        const infoAlumnos = page.locator('li, a, span').filter({ hasText: /informaci[oó]n.*alumnos/i }).first();
        if (await infoAlumnos.isVisible({ timeout: 2000 })) {
            await infoAlumnos.click();
            await page.waitForTimeout(500);
        }
    } catch { }

    try {
        const general = page.locator('li, a, span').filter({ hasText: /^general de alumnos$/i }).first();
        if (await general.isVisible({ timeout: 2000 })) {
            await general.click();
            await page.waitForTimeout(2000);
        }
    } catch { }

    // Verificar que el botón GENERAR está visible
    const genBtn = page.locator('a, button').filter({ hasText: /^generar$/i }).first();
    return await genBtn.isVisible({ timeout: 5000 }).catch(() => false);
}

// ─── Body del request capturado la primera vez (para reutilizar en llamadas directas) ──
let gralalumnosReqBody: string | null = null;
let gralalumnosReqUrl: string | null = null;
let gralalumnosReqHeaders: Record<string, string> = {};

// ─── Descargar via interceptor O fetch directo ────────────────────────────────
// Estrategia:
// 1. Escuchar el REQUEST a gralalumnos para capturar su body/url/headers
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
                        // Log del error
                        const errBody = await response.text().catch(() => '');
                        onStep?.({ type: 'debug', message: `❌ Error ${status}: ${errBody.substring(0, 200)}` });
                        return;
                    }
                    const bodyText = await response.text().catch(() => '');
                    if (!bodyText || bodyText.length < 5 || !bodyText.trim().startsWith('[')) {
                        return;
                    }
                    const json = JSON.parse(bodyText);

                    if (Array.isArray(json) && json.length > 0) {
                        onStep?.({ type: 'debug', message: `📊 ${json.length} alumnos → Excel...` });
                        const XLSX = await import('xlsx');
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.json_to_sheet(json);
                        XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
                        const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                        capturado = true;
                        yaSalido = true;
                        clearTimeout(timeoutId);
                        page.off('response', responseHandler);
                        page.off('request', requestHandler);
                        await writeFile(filePath, buffer);
                        onStep?.({ type: 'debug', message: `💾 Excel: ${json.length} alumnos → ${buffer.length} bytes` });
                        resolve(true);
                    }
                }
            } catch (e) {
                onStep?.({ type: 'debug', message: `[response handler] ${e}` });
            }
        };

        page.on('response', responseHandler);

        // FIX 3.1: CUMBRES y ANAHUAC son los campus más grandes — necesitan timeouts largos en AMBOS ciclos
        const esCampusGrande = campus === 'CUMBRES' || campus === 'ANAHUAC';
        const timeoutDuration = ciclo === '2026-2027'
            ? (esCampusGrande ? 180_000 : 120_000)   // 3 min / 2 min
            : (esCampusGrande ? 120_000 : 60_000);   // 2 min / 1 min — fix: antes era 30s para TODOS

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
            // Hacer scroll al botón para asegurar que está visible
            await botonGenerar.scrollIntoViewIfNeeded().catch(() => { });
            await page.waitForTimeout(500);

            // Hacer focus en el botón
            await botonGenerar.focus().catch(() => { });
            await page.waitForTimeout(300);

            // Hacer click con force: true para asegurar que se ejecuta
            await botonGenerar.click({ force: true });
            onStep?.({ type: 'debug', message: '🖱️ Click en GENERAR ejecutado' });

            // Esperar un momento para que AngularJS procese el click
            await page.waitForTimeout(1000);

            // Esperar a que se genere la tabla en pantalla (puede tardar varios segundos)
            onStep?.({ type: 'debug', message: '⏳ Esperando a que aparezca el icono de Excel...' });

            // FIX CRÍTICO: Esperar activamente a que aparezca el icono de Excel
            // El icono tiene ng-if="vm.PermExcel" y solo aparece cuando la tabla está lista
            // HTML real: <i ng-if="vm.PermExcel" class="md-icon mdi mdi-file-excel uk-float-left ng-scope" ng-click="vm.ExportarExcel()">
            const iconoExcel = page.locator(
                'i.mdi-file-excel[ng-click*="ExportarExcel"], ' +
                'i[class*="mdi-file-excel"][ng-click*="Exportar"], ' +
                '[ng-click*="ExportarExcel"]'
            ).first();

            // FIX: El timeout del icono DEBE ser menor al timeoutDuration total
            // Reservar 30s para que el interceptor capture la respuesta después del click
            const MARGEN_INTERCEPTOR = 30_000; // 30s garantizados para que el interceptor capture
            const timeoutIcono = Math.max(15_000, timeoutDuration - MARGEN_INTERCEPTOR);
            onStep?.({ type: 'debug', message: `⏳ Esperando icono Excel (timeout: ${timeoutIcono / 1000}s)...` });

            let excelVisible = false;
            try {
                await iconoExcel.waitFor({ state: 'visible', timeout: timeoutIcono });
                excelVisible = true;
                onStep?.({ type: 'debug', message: '✅ Icono de Excel apareció' });
            } catch {
                onStep?.({ type: 'debug', message: `⚠️ Timeout esperando icono de Excel (${timeoutIcono / 1000}s para ${campus} ${ciclo})` });
                // Último recurso: buscar el icono de otras formas
                try {
                    const iconoAlt = page.locator('[ng-click*="Exportar"], [ng-click*="excel"], [ng-click*="Excel"]').first();
                    if (await iconoAlt.isVisible({ timeout: 3000 })) {
                        excelVisible = true;
                        onStep?.({ type: 'debug', message: '✅ Icono de Excel encontrado (selector alternativo)' });
                    }
                } catch { }
            }

            // Verificar si la página sigue abierta antes de continuar
            if (page.isClosed()) {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(false);
                return;
            }

            if (excelVisible && !page.isClosed() && !yaSalido) {
                onStep?.({ type: 'debug', message: '✅ Haciendo click en icono de Excel...' });
                await iconoExcel.click({ force: true }).catch(async () => {
                    // Fallback: evaluar click directo desde JS por si hay overlay
                    await page.evaluate(() => {
                        const el = document.querySelector('[ng-click*="ExportarExcel"]') as HTMLElement;
                        if (el) el.click();
                    }).catch(() => { });
                });
                // FIX: Esperar respuesta de red después del click (mínimo 30s)
                // Pero salir inmediatamente si ya se resolvió (yaSalido)
                for (let i = 0; i < MARGEN_INTERCEPTOR / 500 && !yaSalido; i++) {
                    await page.waitForTimeout(500).catch(() => { });
                }
                if (!yaSalido) {
                    onStep?.({ type: 'debug', message: '🖱️ Click en icono de Excel ejecutado — sin respuesta aún...' });
                }
            } else if (!yaSalido) {
                onStep?.({ type: 'debug', message: '⚠️ Icono de Excel no apareció, continuando con interceptor fallback...' });
            }

        } catch (e) {
            if (timeoutId) clearTimeout(timeoutId);
            try {
                page.off('response', responseHandler);
                page.off('request', requestHandler);
            } catch {
                // Página ya cerrada, ignorar
            }
            onStep?.({ type: 'debug', message: `❌ Error en click GENERAR: ${e}` });
            resolve(false);
        }
    });

    if (exito) return true;

    const apiUrl = gralalumnosReqUrl ?? 'https://innovat1.mx/Gaia/32.2.2/api/gralalumnos';

    // Columnas exactas que tiene MITRAS:
    // A1: Matrícula, A5: Nombre corto, A16: Unidad, A8: Grado, A9: Grupo, A10: Estatus, A11: Fecha estatus
    // En Plan B usaremos SIEMPRE las columnas de Mitras para garantizar estandarización
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

    // FIX: Usar el ID específico del campus y ciclo desde el mapeo de UNIT_IDS
    const unitId = UNIT_IDS[ciclo]?.[campus];

    if (!unitId) {
        onStep?.({ type: 'debug', message: `❌ No se encontró unit ID para ${campus} ${ciclo} en el mapeo` });
        return false;
    }

    onStep?.({ type: 'debug', message: `🔍 Usando unit ID ${unitId} para ${campus} ${ciclo}` });

    // FIX 3.3: Probar múltiples valores de Estatus para ciclo 2026-2027
    const estatusValues = ciclo === '2026-2027' ? [-1, 1, 0, 2] : [1];

    try {
        // FIX 3.3: Iterar sobre múltiples valores de Estatus
        for (const estatusValue of estatusValues) {
            if (estatusValues.length > 1) {
                onStep?.({ type: 'debug', message: `🔍 Probando con Estatus: ${estatusValue}...` });
            }

            const scanBody = JSON.stringify({
                ...templateBody,
                Filtro: 'Unidad',
                Ids: [unitId],
                Estatus: estatusValue
            });

            const result = await page.evaluate(
                async ({ url, body }: { url: string; body: string; reqHeaders: any }) => {
                    // Plan B: Usar SOLO credentials: 'include' (cookies actuales del browser)
                    // NO usar reqHeaders obsoletos — el browser tiene el token fresco
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
                { url: apiUrl, body: scanBody, reqHeaders: gralalumnosReqHeaders }
            );

            if (result.status !== 200 || result.text.length < 5) {
                // Loguear el body del error para diagnóstico
                const errorBody = result.text?.substring(0, 300) || '(vacío)';
                onStep?.({ type: 'debug', message: `  Estatus ${estatusValue}: HTTP ${result.status} [${(result as any).method}] → ${errorBody}` });
                continue;
            }

            let json: Record<string, unknown>[];
            try { json = JSON.parse(result.text); } catch {
                onStep?.({ type: 'debug', message: `  Estatus ${estatusValue}: respuesta no es JSON válido` });
                continue;
            }

            if (!Array.isArray(json) || json.length === 0) {
                onStep?.({ type: 'debug', message: `  Estatus ${estatusValue}: respuesta vacía` });
                continue;
            }

            // FIX 3.3 & 3.4: Logging mejorado con valor de Estatus
            onStep?.({ type: 'debug', message: `✅ ${campus} = unit ID ${unitId} con Estatus ${estatusValue}` });
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(json);
            XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
            const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            await writeFile(filePath, buffer);
            onStep?.({ type: 'debug', message: `💾 Excel: ${json.length} alumnos → ${buffer.length} bytes` });
            return true;
        }

        onStep?.({ type: 'debug', message: `❌ No se encontraron datos para ${campus} con unit ID ${unitId}` });
        return false;
    } catch (e) {
        onStep?.({ type: 'debug', message: `❌ Error en descarga: ${e}` });
        return false;
    }
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
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-animations'
            ],
        });

        const context = await browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1920, height: 1080 },  // Aumentado de 1280x900 a 1920x1080 para que las pestañas sean visibles
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
                    // FIX CRÍTICO: Página limpia para cada campus+ciclo
                    // Evita que handlers/timeouts del ciclo anterior corrompan el estado
                    if (!esPrimeraCombinacion) {
                        onStep?.({ type: 'debug', message: `♻️ Página limpia para ${campus} ${ciclo}...` });
                        await page.close().catch(() => { });
                        page = await context.newPage();
                        await page.goto('https://innovat1.mx/Gaia/32.2.2/#/Inicio', { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await page.waitForTimeout(2000);
                    }
                    esPrimeraCombinacion = false;

                    // ── 2a. Cambiar campus/ciclo en el header
                    await cambiarCampusCiclo(page, campus, ciclo, onStep);
                    await page.waitForTimeout(1000);

                    // ── 2b. Navegar a General de Alumnos
                    const navOk = await navegarAGeneralDeAlumnos(page, onStep);
                    if (!navOk) {
                        onStep?.({ type: 'debug', message: '⏳ Reintentando navegación...' });
                        await page.waitForTimeout(2000);
                        await navegarAGeneralDeAlumnos(page, onStep);
                        await page.waitForTimeout(2000);
                    }

                    await screenshot(page, `en_reporte_${campus}_${cicloCorto(ciclo)}`, onStep);

                    // ── 2c. Localizar botón GENERAR
                    const botonGenerar = page.locator('a, button').filter({ hasText: /^generar$/i }).first();
                    const genVisible = await botonGenerar.isVisible({ timeout: 8000 }).catch(() => false);
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

                            if (await labelAmbos.isVisible({ timeout: 2000 })) {
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

                    // ── 2f. ASEGURAR CHECKBOXES DE CAMPOS NECESARIOS ───────────────────
                    // Según el usuario, necesitamos: Unidad, Grado, Estatus, Fecha estatus, Comentario estatus
                    // Estos campos están en diferentes pestañas
                    try {
                        onStep?.({ type: 'debug', message: '📋 Verificando checkboxes de campos necesarios...' });

                        // Lista de campos necesarios y sus pestañas
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
                        const camposPorTab: Record<string, string[]> = {};
                        for (const { campo, tab } of camposNecesarios) {
                            if (!camposPorTab[tab]) camposPorTab[tab] = [];
                            camposPorTab[tab].push(campo);
                        }

                        // Procesar cada pestaña
                        for (const [tabName, campos] of Object.entries(camposPorTab)) {
                            // Hacer click en la pestaña
                            const tab = page.locator('a, span').filter({ hasText: new RegExp(`^${tabName}$`, 'i') }).first();
                            const tabVisible = await tab.isVisible({ timeout: 2000 }).catch(() => false);

                            if (tabVisible) {
                                await tab.click();
                                await page.waitForTimeout(1500);  // Aumentado de 600ms a 1500ms
                                onStep?.({ type: 'debug', message: `📂 Pestaña "${tabName}" abierta` });

                                // Hacer scroll hacia abajo para asegurar que los checkboxes sean visibles
                                await page.evaluate(() => window.scrollBy(0, 200)).catch(() => { });
                                await page.waitForTimeout(500);

                                // Screenshot para debug (solo para Administrativos en ciclo 2026-2027)
                                if (tabName === 'Administrativos' && ciclo === '2026-2027') {
                                    await screenshot(page, `checkboxes_${campus}_${cicloCorto(ciclo)}_${tabName}`, onStep);

                                    // DIAGNÓSTICO: Capturar HTML de los checkboxes
                                    try {
                                        const htmlContent = await page.evaluate(() => {
                                            const tab = document.querySelector('.uk-active');
                                            return tab ? tab.innerHTML : 'No se encontró pestaña activa';
                                        });
                                        onStep?.({ type: 'debug', message: `🔍 HTML de pestaña Administrativos (primeros 500 chars): ${htmlContent.substring(0, 500)}` });
                                    } catch (e) {
                                        onStep?.({ type: 'debug', message: `⚠️ Error capturando HTML: ${e}` });
                                    }
                                }

                                // Verificar/activar cada checkbox
                                for (const campo of campos) {
                                    try {
                                        // DIAGNÓSTICO: Para Administrativos en 2026-2027, buscar TODOS los elementos que contengan el texto del campo
                                        if (tabName === 'Administrativos' && ciclo === '2026-2027') {
                                            const allElements = await page.locator(`*:has-text("${campo}")`).count();
                                            onStep?.({ type: 'debug', message: `🔍 "${campo}": ${allElements} elementos encontrados con ese texto` });

                                            // Intentar obtener info del primer elemento
                                            if (allElements > 0) {
                                                const firstElement = page.locator(`*:has-text("${campo}")`).first();
                                                const tagName = await firstElement.evaluate(el => el.tagName).catch(() => 'unknown');
                                                const classes = await firstElement.evaluate(el => el.className).catch(() => 'unknown');
                                                onStep?.({ type: 'debug', message: `   → Primer elemento: <${tagName}> class="${classes}"` });
                                            }
                                        }

                                        // Buscar el checkbox del campo con selectores más amplios
                                        const checkbox = page.locator([
                                            // Selectores originales
                                            `input[type="checkbox"] + label:has-text("${campo}")`,
                                            `label:has-text("${campo}") input[type="checkbox"]`,
                                            `div:has(label:text-is("${campo}")) input[type="checkbox"]`,
                                            `.icheckbox_flat-green:has(+ label:text-is("${campo}"))`,
                                            // Selectores adicionales más flexibles
                                            `label:text-is("${campo}") ~ input[type="checkbox"]`,
                                            `div:has-text("${campo}") input[type="checkbox"]`,
                                            `input[type="checkbox"][name*="${campo}"]`,
                                            // Para iCheck
                                            `.icheckbox_flat-green:has(~ label:has-text("${campo}"))`,
                                        ].join(', ')).first();

                                        const checkboxVisible = await checkbox.isVisible({ timeout: 1000 }).catch(() => false);

                                        if (checkboxVisible) {
                                            const isChecked = await checkbox.isChecked().catch(() => {
                                                // Para iCheck, verificar la clase 'checked' del contenedor
                                                return checkbox.evaluate(node =>
                                                    node.parentElement?.classList.contains('checked') || false
                                                );
                                            });

                                            if (!isChecked) {
                                                onStep?.({ type: 'debug', message: `  ✓ Activando "${campo}"` });
                                                await checkbox.click({ force: true });
                                                await page.waitForTimeout(300);
                                            } else {
                                                onStep?.({ type: 'debug', message: `  ✓ "${campo}" ya está activado` });
                                            }
                                        } else {
                                            onStep?.({ type: 'debug', message: `  ⚠️ Checkbox "${campo}" no visible` });
                                        }
                                    } catch (e) {
                                        onStep?.({ type: 'debug', message: `  ⚠️ Error con checkbox "${campo}": ${e}` });
                                    }
                                }
                            } else {
                                onStep?.({ type: 'debug', message: `⚠️ Pestaña "${tabName}" NO visible - intentando buscar checkboxes directamente` });

                                // FALLBACK: Buscar checkboxes sin pestañas (pueden estar todos visibles)
                                for (const campo of campos) {
                                    try {
                                        const checkbox = page.locator([
                                            `input[type="checkbox"][id*="${campo}"]`,
                                            `label:has-text("${campo}") input[type="checkbox"]`,
                                            `div:has-text("${campo}") input[type="checkbox"]`,
                                        ].join(', ')).first();

                                        const checkboxVisible = await checkbox.isVisible({ timeout: 1000 }).catch(() => false);

                                        if (checkboxVisible) {
                                            const isChecked = await checkbox.isChecked().catch(() => false);

                                            if (!isChecked) {
                                                onStep?.({ type: 'debug', message: `  ✓ Activando "${campo}" (sin pestaña)` });
                                                await checkbox.click({ force: true });
                                                await page.waitForTimeout(300);
                                            } else {
                                                onStep?.({ type: 'debug', message: `  ✓ "${campo}" ya activado (sin pestaña)` });
                                            }
                                        }
                                    } catch (e) {
                                        // Ignorar errores en fallback
                                    }
                                }
                            }
                        }

                        // Volver a la primera pestaña (Alumno)
                        const tabAlumno = page.locator('a, span').filter({ hasText: /^Alumno$/i }).first();
                        if (await tabAlumno.isVisible({ timeout: 1000 })) {
                            await tabAlumno.click();
                            await page.waitForTimeout(400);
                        }

                        onStep?.({ type: 'debug', message: '✅ Checkboxes verificados' });
                    } catch (e) {
                        onStep?.({ type: 'debug', message: `⚠️ Error al verificar checkboxes: ${e}` });
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
