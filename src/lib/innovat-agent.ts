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
                    onStep?.({ type: 'debug', message: `📤 Request body: ${body.substring(0, 150)}` });
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
                    if (!bodyText || bodyText.length < 5) {
                        onStep?.({ type: 'debug', message: `📄 Body vacío o insuficiente (status ${status}).` });
                        return;
                    }
                    const json = JSON.parse(bodyText);

                    if (Array.isArray(json) && json.length > 0) {
                        // REGLA CRÍTICA: Algunos campus no tienen "Grupo" por defecto en la UI.
                        // Si falta el campo "Grupo" o el código "A9", ignoramos esta captura
                        // para que el sistema use el Intento 2 (fetch directo) con todos los campos.
                        const tieneGrupo = json.some(row => row.hasOwnProperty('Grupo') || row.hasOwnProperty('A9'));
                        if (!tieneGrupo) {
                            onStep?.({ type: 'debug', message: '⚠️ JSON sin columna "Grupo". Forzando reintento por API con campos completos...' });
                            return; // Sigue escuchando o irá al fallback por timeout
                        }

                        onStep?.({ type: 'debug', message: `📊 ${json.length} alumnos → Excel...` });
                        const XLSX = await import('xlsx');
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.json_to_sheet(json);
                        XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
                        const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                        capturado = true;
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

        timeoutId = setTimeout(async () => {
            page.off('response', responseHandler);
            page.off('request', requestHandler);
            if (!capturado) {
                onStep?.({ type: 'debug', message: `⏱️ Timeout del interceptor (30s) — intentando fetch directo...` });
                resolve(false);
            }
        }, 30_000); // 30s de gracia para campus grandes

        try {
            await botonGenerar.click();
            onStep?.({ type: 'debug', message: '🖱️ Click en GENERAR...' });
        } catch (e) {
            if (timeoutId) clearTimeout(timeoutId);
            page.off('response', responseHandler);
            page.off('request', requestHandler);
            resolve(false);
        }
    });

    if (exito) return true;

    const apiUrl = gralalumnosReqUrl ?? 'https://innovat1.mx/Gaia/32.2.2/api/gralalumnos';

    // Columnas exactas que tiene MITRAS:
    // A1: Matrícula, A5: Nombre corto, A16: Unidad, A8: Grado, A9: Grupo, A10: Estatus, A11: Fecha estatus
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
    const campusNorm = campus.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const estatus = ciclo === '2026-2027' ? -1 : 1;
    onStep?.({ type: 'debug', message: `🔍 Escaneando IDs 1-15 para ${campus} ("${campusNorm}")...` });

    try {
        for (const testId of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30']) {
            const scanBody = JSON.stringify({ ...templateBody, Filtro: 'Unidad', Ids: [testId], Estatus: estatus });
            const result = await page.evaluate(
                async ({ url, body }: { url: string; body: string }) => {
                    // Plan B: Intentar PUT y luego POST (algunos servers así lo piden)
                    for (const method of ['PUT', 'POST']) {
                        try {
                            const res = await fetch(url, {
                                method,
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
                                body,
                            });
                            if (res.status === 200) {
                                const text = await res.text();
                                if (text.length > 50) return { status: 200, text };
                            }
                            // Reintento: si falló con Estatus -1, probar con Estatus 1
                            if (body.includes('"Estatus":-1')) {
                                const retryBody = body.replace('"Estatus":-1', '"Estatus":1');
                                const res2 = await fetch(url, {
                                    method,
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: retryBody,
                                });
                                if (res2.status === 200) {
                                    const t2 = await res2.text();
                                    if (t2.length > 50) return { status: 200, text: t2 };
                                }
                            }
                        } catch { }
                    }
                    return { status: 500, text: '' };
                },
                { url: apiUrl, body: scanBody }
            );

            if (result.status !== 200 || result.text.length < 5) {
                onStep?.({ type: 'debug', message: `  ID ${testId} → status ${result.status}` });
                continue;
            }

            let json: Record<string, unknown>[];
            try { json = JSON.parse(result.text); } catch { continue; }
            if (!Array.isArray(json) || json.length === 0) {
                onStep?.({ type: 'debug', message: `  ID ${testId} → []` });
                continue;
            }

            const nombreResp = ((json[0].NombreComercial ?? json[0].Unidad ?? '') as string)
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            onStep?.({ type: 'debug', message: `  ID ${testId} → ${json.length} alumnos de "${nombreResp}"` });

            if (nombreResp === campusNorm || nombreResp.includes(campusNorm) || campusNorm.includes(nombreResp)) {
                onStep?.({ type: 'debug', message: `✅ ${campus} = unit ID ${testId}` });
                const XLSX = await import('xlsx');
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(json);
                XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
                const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                await writeFile(filePath, buffer);
                onStep?.({ type: 'debug', message: `💾 Excel escaneado: ${json.length} alumnos → ${buffer.length} bytes` });
                return true;
            }
        }
        onStep?.({ type: 'debug', message: `❌ No se encontró unit ID para ${campus} entre 1-15` });
        return false;
    } catch (e) {
        onStep?.({ type: 'debug', message: `❌ Error en escaneo: ${e}` });
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
                '--js-flags="--max-old-space-size=512"', // Limitar memoria JS para evitar crashes
                '--disable-gpu',
                '--disable-animations'
            ],
        });

        const context = await browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1280, height: 900 },
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
        let primerCampus = true;
        for (const campus of campusList) {
            // Liberar RAM: Cerrar pestaña anterior y abrir una nueva
            // La cookie de sesión se mantiene en el "context" del navegador
            if (!primerCampus) {
                onStep?.({ type: 'debug', message: '♻️ Reiniciando pestaña para liberar memoria...' });
                await page.close();
                page = await context.newPage();
                await page.goto('https://innovat1.mx/Gaia/32.2.2/#/Inicio', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);
            }
            primerCampus = false;

            for (const ciclo of CICLOS) {
                onStep?.({ type: 'campus', campus, ciclo });

                try {
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

                    // ── 2d. Asegurar que el campo "Seleccione..." tenga una unidad seleccionada
                    // Para DOMINIO/MITRAS el scope AngularJS ya tiene los IDs cargados automáticamente
                    // Para NORTE/CUMBRES/ANAHUAC hay que seleccionarlo manualmente via el autocomplete
                    try {
                        // Intentar con getByPlaceholder (más fiable que CSS selector para AngularJS)
                        const autocompleteInput = page.getByPlaceholder(/Seleccione/i).first();
                        const isVisible = await autocompleteInput.isVisible({ timeout: 3000 }).catch(() => false);

                        if (isVisible) {
                            const valorActual = await autocompleteInput.inputValue({ timeout: 1000 }).catch(() => '');
                            onStep?.({ type: 'debug', message: `🔍 Campo autocomplete: "${valorActual || '(vacío)'}"` });

                            // Limpiar y escribir el nombre del campus para disparar el autocomplete
                            await autocompleteInput.click();
                            await page.waitForTimeout(400);
                            await autocompleteInput.fill(''); // Limpiar
                            await autocompleteInput.type(campus.substring(0, 3), { delay: 80 }); // Escribir las primeras 3 letras
                            await page.waitForTimeout(1000); // Esperar que carguen las sugerencias

                            // Buscar opciones del autocomplete de AngularJS Material
                            const sugerencias = page.locator([
                                'ul.md-autocomplete-suggestions li',
                                'li[md-virtual-repeat]',
                                'md-virtual-repeat-container li',
                                '.md-autocomplete-suggestions-container li',
                            ].join(', '));
                            const countS = await sugerencias.count().catch(() => 0);
                            onStep?.({ type: 'debug', message: `📋 ${countS} sugerencias para "${campus.substring(0, 3)}"` });

                            if (countS > 0) {
                                for (let i = 0; i < Math.min(countS, 5); i++) {
                                    const t = await sugerencias.nth(i).textContent().catch(() => '');
                                    onStep?.({ type: 'debug', message: `  sug[${i}]: "${t?.trim()}"` });
                                }
                                await sugerencias.first().click();
                                await page.waitForTimeout(600);
                                onStep?.({ type: 'debug', message: `✅ Unidad seleccionada del autocomplete` });
                            } else {
                                // Sin sugerencias → intentar con ArrowDown
                                await autocompleteInput.press('ArrowDown');
                                await page.waitForTimeout(500);
                                const trasSug = page.locator('ul.md-autocomplete-suggestions li, li[md-virtual-repeat]');
                                if (await trasSug.count().catch(() => 0) > 0) {
                                    await trasSug.first().click();
                                    await page.waitForTimeout(600);
                                    onStep?.({ type: 'debug', message: `✅ Unidad seleccionada (ArrowDown)` });
                                } else {
                                    await page.keyboard.press('Escape');
                                    onStep?.({ type: 'debug', message: `⚠️ Sin sugerencias para "${campus}" — el form enviará Ids vacío` });
                                }
                            }
                        } else {
                            onStep?.({ type: 'debug', message: `ℹ️ Campo Seleccione no visible — campus ya tiene IDs preseleccionados` });
                        }
                    } catch (e) {
                        onStep?.({ type: 'debug', message: `⚠️ Error al llenar autocomplete: ${e}` });
                    }

                    // ── 2e. ASEGURAR COLUMNA "GRUPO" EN LA UI ───────────────────────
                    // Para campus como CUMBRES/NORTE que no la traen activa por defecto
                    try {
                        const tabAdmin = page.locator('a, span').filter({ hasText: /^Administrativos$/i }).first();
                        if (await tabAdmin.isVisible({ timeout: 2000 })) {
                            await tabAdmin.click();
                            await page.waitForTimeout(600);

                            // El checkbox de Grupo suele estar en un div.icheckbox_flat-green
                            const insGrupo = page.locator('div:has(label:text-is("Grupo")) ins, label:has-text("Grupo") + div ins, .icheckbox_flat-green:has(+ label:text-is("Grupo")) ins').first();

                            if (await insGrupo.isVisible({ timeout: 3000 })) {
                                const isChecked = await insGrupo.evaluate(node =>
                                    node.parentElement?.classList.contains('checked') ||
                                    node.parentElement?.getAttribute('aria-checked') === 'true'
                                );

                                if (!isChecked) {
                                    onStep?.({ type: 'debug', message: '🔘 Activando columna "Grupo" en la UI...' });
                                    await insGrupo.dispatchEvent('click'); // dispatchEvent es más robusto para iCheck
                                    await page.waitForTimeout(600);
                                }
                            }

                            // Volver a la primera pestaña (Alumno)
                            const tabAlumno = page.locator('a, span').filter({ hasText: /^Alumno$/i }).first();
                            if (await tabAlumno.isVisible()) {
                                await tabAlumno.click();
                                await page.waitForTimeout(400);
                            }
                        }
                    } catch (e) {
                        onStep?.({ type: 'debug', message: `⚠️ No se pudo asegurar columna Grupo en UI: ${e}` });
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
