/**
 * Bug Condition Exploration Test - Task 1
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * Property 1: Bug Condition - Campus/Ciclo Selection Fails for 4 Campuses
 * 
 * This test verifies that cambiarCampusCiclo() fails to select the correct campus/ciclo
 * for MITRAS, NORTE, CUMBRES, ANAHUAC due to dynamic IDs in dropdown.
 * 
 * EXPECTED OUTCOME: Test FAILS for all 4 campuses (this proves the bug exists)
 * 
 * The test will:
 * - Attempt to select campus/ciclo for each of the 4 failing campuses
 * - Capture screenshots of dropdown opened
 * - Log all dropdown options with their HTML attributes
 * - Verify that the header does NOT reflect the expected campus/ciclo (bug condition)
 */

import { test, expect } from '@playwright/test';
import { chromium, Browser, Page } from 'playwright';
import * as fc from 'fast-check';
import { mkdir } from 'fs/promises';
import { join } from 'path';

// ─── Configuration ─────────────────────────────────────────────────────────
const INNOVAT_URL = 'https://innovat1.mx/Gaia/login';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

const INNOVAT_USER = process.env.INNOVAT_USER || '';
const INNOVAT_PASS = process.env.INNOVAT_PASS || '';
const INNOVAT_SCHOOL = process.env.INNOVAT_SCHOOL || 'Colegio Cambridge de Monterrey';

// The 4 campuses that are failing
const FAILING_CAMPUSES = ['MITRAS', 'NORTE', 'CUMBRES', 'ANAHUAC'] as const;
const CICLO = '2025-2026';
const CICLO_CORTO = '25-26';

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getDebugDir(): Promise<string> {
    const dir = join(process.cwd(), 'upload', 'debug', 'bugfix-exploration');
    await mkdir(dir, { recursive: true });
    return dir;
}

async function screenshot(page: Page, nombre: string) {
    try {
        const debugDir = await getDebugDir();
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const path = join(debugDir, `${ts}_${nombre}.png`);
        await page.screenshot({ path, fullPage: false });
        console.log(`📸 Screenshot saved: ${nombre}`);
    } catch (e) {
        console.error(`Failed to save screenshot: ${e}`);
    }
}

function norm(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

// ─── Login Helper ──────────────────────────────────────────────────────────
async function loginToInnovat(page: Page): Promise<void> {
    console.log('🔑 Starting login process...');
    
    // Try to load login page with retry
    let loginCargado = false;
    for (let intento = 1; intento <= 3; intento++) {
        try {
            await page.goto(INNOVAT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            loginCargado = true;
            break;
        } catch {
            console.log(`⏳ Login load attempt ${intento}/3...`);
            await page.waitForTimeout(3000);
        }
    }
    if (!loginCargado) throw new Error('Could not load Innovat login page after 3 attempts');
    
    await page.waitForSelector('#NombreEscuela', { state: 'visible', timeout: 20000 });
    console.log('✅ Login page loaded');

    // Fill school name with autocomplete
    await page.click('#NombreEscuela');
    await page.type('#NombreEscuela', INNOVAT_SCHOOL, { delay: 50 });
    await page.waitForTimeout(1500);

    // Select from autocomplete suggestions
    const sugerencia = page.locator('md-autocomplete-parent-scope li, .md-autocomplete-suggestions li').first();
    if (await sugerencia.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sugerencia.click();
    } else {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(500);

    // Fill credentials
    await page.fill('#NombreUsuario', INNOVAT_USER);
    await page.fill('#Contrasena', INNOVAT_PASS);
    
    // Submit login
    await page.locator('button[type="submit"], input[type="submit"], .md-btn-primary').first().click();
    await page.waitForTimeout(3500);

    console.log(`📍 After login URL: ${page.url()}`);

    // Verify login success
    const errorLogin = await page.locator('text=Datos de acceso incorrectos').isVisible({ timeout: 1000 }).catch(() => false);
    if (errorLogin || page.url().includes('/login')) {
        throw new Error(
            `❌ Login failed — School: "${INNOVAT_SCHOOL}" | User: "${INNOVAT_USER}"\n` +
            `Configure INNOVAT_USER, INNOVAT_PASS and INNOVAT_SCHOOL in .env`
        );
    }
    console.log('✅ Login successful');
}

// ─── Test cambiarCampusCiclo (UNFIXED CODE) ────────────────────────────────
async function testCambiarCampusCicloUnfixed(
    page: Page,
    campus: string,
    ciclo: string
): Promise<{ success: boolean; headerText: string; options: Array<{ text: string; id: string; ngRepeat: string; role: string }> }> {
    const cicloC = ciclo.replace('20', '').replace('-20', '-');
    
    console.log(`\n🔄 Testing campus: ${campus} ${ciclo}`);
    console.log(`📍 Current URL: ${page.url()}`);

    // Capture screenshot of current page state
    await screenshot(page, `before_test_${campus}_${cicloC}`);

    // ── Find dropdown trigger
    const dropdownTrigger = page.locator([
        'a[ng-click*="Unidad"], a[ng-click*="Campus"], a[ng-click*="ciclo"]',
        '.uk-navbar-nav a:has-text("2025"), .uk-navbar-nav a:has-text("2026")',
        'a.dropdown-toggle:has-text("CUMBRES"), a.dropdown-toggle:has-text("DOMINIO")',
        'a.dropdown-toggle:has-text("MITRAS"), a.dropdown-toggle:has-text("NORTE")',
        'nav a:has-text("2025-2026"), nav a:has-text("2026-2027")',
        '.md-navbar a:has-text("2025"), .md-navbar a:has-text("2026")',
    ].join(', ')).first();

    const dropdownFallback = page.locator('a, button, span')
        .filter({ hasText: /(?:CUMBRES|DOMINIO|MITRAS|NORTE|AN[AÁ]HUAC)\s+\d{4}/i })
        .first();

    // Debug: Check if any elements match
    const triggerCount = await dropdownTrigger.count().catch(() => 0);
    const fallbackCount = await dropdownFallback.count().catch(() => 0);
    console.log(`🔍 Dropdown trigger count: ${triggerCount}`);
    console.log(`🔍 Dropdown fallback count: ${fallbackCount}`);

    // Read initial header text
    let textoHeaderInicial = '';
    try {
        textoHeaderInicial = await dropdownTrigger.textContent({ timeout: 2000 }) ?? '';
    } catch (e) {
        console.log(`⚠️ Failed to read trigger text: ${e}`);
        try {
            textoHeaderInicial = await dropdownFallback.textContent({ timeout: 2000 }) ?? '';
        } catch (e2) {
            console.log(`⚠️ Failed to read fallback text: ${e2}`);
        }
    }
    console.log(`📍 Initial header text: "${textoHeaderInicial.trim().substring(0, 50)}"`);

    // ── Click dropdown trigger
    let clicExitoso = false;
    try {
        await dropdownTrigger.click({ timeout: 4000 });
        clicExitoso = true;
        console.log('✅ Clicked dropdown trigger');
    } catch (e) {
        console.log(`⚠️ Failed to click trigger: ${e}`);
        try {
            await dropdownFallback.click({ timeout: 4000 });
            clicExitoso = true;
            console.log('✅ Clicked dropdown fallback');
        } catch (e2) {
            console.log(`⚠️ Failed to click fallback: ${e2}`);
            console.log('⚠️ Failed to open dropdown');
            await screenshot(page, `failed_dropdown_${campus}_${cicloC}`);
            return { success: false, headerText: textoHeaderInicial, options: [] };
        }
    }

    if (!clicExitoso) {
        return { success: false, headerText: textoHeaderInicial, options: [] };
    }

    await page.waitForTimeout(800);
    console.log('✅ Dropdown opened');
    await screenshot(page, `dropdown_${campus}_${cicloC}`);

    // ── Read and log ALL dropdown options
    const opciones = page.locator('ul li, li[ng-repeat], .uk-dropdown li, [role="option"]');
    const count = await opciones.count().catch(() => 0);
    console.log(`📋 ${count} options in dropdown:`);
    
    const optionsData: Array<{ text: string; id: string; ngRepeat: string; role: string }> = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
        const el = opciones.nth(i);
        const texto = (await el.textContent().catch(() => ''))?.trim() ?? '';
        const id = await el.getAttribute('id').catch(() => '') ?? '';
        const ngRepeat = await el.getAttribute('ng-repeat').catch(() => '') ?? '';
        const role = await el.getAttribute('role').catch(() => '') ?? '';
        
        optionsData.push({ text: texto, id, ngRepeat, role });
        console.log(`  [${i}] id="${id}" ng-repeat="${ngRepeat}" role="${role}" text="${texto.substring(0, 50)}"`);
    }

    // ── Try to select the option (using UNFIXED code logic)
    const MAX_LONGITUD_OPCION = 60;
    let seleccionado = false;
    let seleccionadoConCiclo = false;

    // Strategy 1: Exact combo "CAMPUS CICLO" in short text
    for (let i = 0; i < count; i++) {
        const raw = (await opciones.nth(i).textContent().catch(() => '')) ?? '';
        const texto = norm(raw);
        if (texto.length > MAX_LONGITUD_OPCION) continue;
        const campusNorm = norm(campus);
        const tieneCampus = texto.includes(campusNorm);
        const tieneCiclo = texto.includes(ciclo.toUpperCase()) || texto.includes(cicloC.toUpperCase());
        if (tieneCampus && tieneCiclo) {
            try {
                await opciones.nth(i).click({ noWaitAfter: true, force: true, timeout: 5000 });
            } catch (e) {
                console.log(`⚠️ Click failed on combo campus/ciclo: ${e}`);
            }
            await page.waitForTimeout(2500);
            console.log(`✅ Selected: "${raw.trim()}" (idx ${i})`);
            seleccionado = true;
            seleccionadoConCiclo = true;
            break;
        }
    }

    // Strategy 2: Only campus (two-level dropdown) — fallback
    if (!seleccionado) {
        for (let i = 0; i < count; i++) {
            const raw = (await opciones.nth(i).textContent().catch(() => '')) ?? '';
            const texto = norm(raw);
            if (texto.length > MAX_LONGITUD_OPCION && texto.includes(norm(campus))) {
                try {
                    await opciones.nth(i).click({ noWaitAfter: true, force: true, timeout: 5000 });
                } catch (e) {
                    console.log(`⚠️ Click failed on fallback campus: ${e}`);
                }
                await page.waitForTimeout(2000);
                console.log(`✅ Campus (fallback): "${raw.trim()}"`);
                seleccionado = true;
                break;
            }
        }
    }

    if (!seleccionado) {
        console.log(`⚠️ No option found for ${campus} ${ciclo}`);
        await page.keyboard.press('Escape');
        return { success: false, headerText: textoHeaderInicial, options: optionsData };
    }

    await screenshot(page, `after_selection_${campus}_${cicloC}`);

    // If we didn't select the full combo, look for ciclo in second level
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
                        console.log(`⚠️ Click failed on ciclo 2nd level: ${e}`);
                    }
                    await page.waitForTimeout(2500);
                    console.log(`✅ Ciclo ${cicloC} selected in 2nd level`);
                    break;
                }
            }
        }
    }

    // ── Verify result
    await page.waitForTimeout(500);
    const headerFinal = await dropdownFallback.textContent({ timeout: 2000 }).catch(() => '???');
    console.log(`📍 Header after change: "${headerFinal?.trim().substring(0, 50)}"`);

    // Check if selection was successful
    const headerNorm = norm(headerFinal ?? '');
    const campusNorm = norm(campus);
    const cicloNorm = norm(ciclo);
    const success = headerNorm.includes(campusNorm) && (headerNorm.includes(cicloNorm) || headerNorm.includes(cicloC.toUpperCase()));

    return { success, headerText: headerFinal ?? '', options: optionsData };
}

// ─── Property-Based Test ───────────────────────────────────────────────────
test.describe('Bug Condition Exploration - Campus/Ciclo Selection', () => {
    let browser: Browser;
    let page: Page;
    let skipTests = false;

    test.beforeAll(async () => {
        // Skip if credentials not provided
        if (!INNOVAT_USER || !INNOVAT_PASS) {
            console.log('⚠️ Skipping tests: INNOVAT_USER and INNOVAT_PASS environment variables not set');
            console.log(`INNOVAT_USER: "${INNOVAT_USER}"`);
            console.log(`INNOVAT_PASS: "${INNOVAT_PASS ? '***' : ''}"`);
            skipTests = true;
            return;
        }

        browser = await chromium.launch({ headless: false });
        page = await browser.newPage();
        
        try {
            await loginToInnovat(page);
        } catch (e) {
            console.error('Failed to login:', e);
            skipTests = true;
            throw e;
        }
    });

    test.afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    // Test each failing campus individually
    for (const campus of FAILING_CAMPUSES) {
        test(`should FAIL to select ${campus} ${CICLO} (bug condition)`, async () => {
            if (skipTests) {
                test.skip();
                return;
            }

            // Ensure we're logged in and on the main page
            if (page.url().includes('/login')) {
                console.log('⚠️ Session expired, logging in again...');
                await loginToInnovat(page);
            }

            // Navigate to a known page with the dropdown
            await page.goto('https://innovat1.mx/Gaia/32.2.2/#/Inicio', { waitUntil: 'domcontentloaded' }).catch(() => {});
            await page.waitForTimeout(2000);

            const result = await testCambiarCampusCicloUnfixed(page, campus, CICLO);

            console.log(`\n📊 Test Result for ${campus}:`);
            console.log(`  - Selection success: ${result.success}`);
            console.log(`  - Final header: "${result.headerText}"`);
            console.log(`  - Options found: ${result.options.length}`);

            // Log counterexamples
            if (!result.success) {
                console.log(`\n🐛 COUNTEREXAMPLE FOUND for ${campus}:`);
                console.log(`  - Campus: ${campus}`);
                console.log(`  - Ciclo: ${CICLO}`);
                console.log(`  - Header text: "${result.headerText}"`);
                console.log(`  - Dropdown options:`);
                result.options.forEach((opt, idx) => {
                    console.log(`    [${idx}] id="${opt.id}" ng-repeat="${opt.ngRepeat}" role="${opt.role}"`);
                    console.log(`         text="${opt.text.substring(0, 60)}"`);
                });
            }

            // CRITICAL: This assertion should FAIL on unfixed code
            // When it fails, it confirms the bug exists
            expect(result.success).toBe(true);
            expect(result.headerText).toContain(campus);
            expect(result.headerText).toMatch(new RegExp(`${CICLO}|${CICLO_CORTO}`, 'i'));
        });
    }

    // Property-based test: All 4 failing campuses should fail
    test('Property 1: Bug Condition - All 4 campuses fail selection', async () => {
        if (skipTests) {
            test.skip();
            return;
        }

        // Generator for failing campuses
        const failingCampusArb = fc.constantFrom(...FAILING_CAMPUSES);

        await fc.assert(
            fc.asyncProperty(failingCampusArb, async (campus) => {
                const result = await testCambiarCampusCicloUnfixed(page, campus, CICLO);

                // Log the result
                console.log(`\n🔍 Property test for ${campus}: success=${result.success}`);

                // CRITICAL: This should return false (fail) for unfixed code
                // When this property fails, it confirms the bug exists
                return result.success;
            }),
            {
                numRuns: 4, // Test all 4 campuses
                verbose: true,
            }
        );
    });
});
