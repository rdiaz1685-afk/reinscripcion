/**
 * Script de diagnóstico para identificar el icono de Excel
 * Este script hace login, navega a General de Alumnos, hace click en GENERAR
 * y luego captura TODOS los iconos visibles para identificar cuál es el de Excel
 */

import { chromium } from 'playwright';
import { config } from 'dotenv';

config();

const INNOVAT_URL = 'https://innovat1.mx/Gaia/login';
const INNOVAT_USER = process.env.INNOVAT_USER || 'prueba.diaz';
const INNOVAT_PASS = process.env.INNOVAT_PASS || '123456';
const INNOVAT_SCHOOL = process.env.INNOVAT_SCHOOL || 'Colegio Cambridge de Monterrey';

async function main() {
    console.log('🔍 Iniciando diagnóstico del icono de Excel...\n');

    const browser = await chromium.launch({
        headless: false, // Modo visible para ver qué pasa
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    try {
        // 1. LOGIN
        console.log('🔑 Haciendo login...');
        await page.goto(INNOVAT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#NombreEscuela', { state: 'visible', timeout: 20000 });

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

        console.log('✅ Login exitoso\n');

        // 2. NAVEGAR A GENERAL DE ALUMNOS
        console.log('📂 Navegando a General de Alumnos...');
        
        // Ir a Inicio
        const inicio = page.locator('a, span').filter({ hasText: /^INICIO$|^Inicio$/i }).first();
        if (await inicio.isVisible({ timeout: 2000 })) {
            await inicio.click();
            await page.waitForTimeout(1000);
        }

        // Menú: Escolar
        const escolar = page.locator('li, a, span, div').filter({ hasText: /^Escolar$/i }).first();
        if (await escolar.isVisible({ timeout: 2000 })) {
            await escolar.click();
            await page.waitForTimeout(600);
        }

        // Información Alumnos
        const infoAlumnos = page.locator('li, a, span').filter({ hasText: /informaci[oó]n.*alumnos/i }).first();
        if (await infoAlumnos.isVisible({ timeout: 2000 })) {
            await infoAlumnos.click();
            await page.waitForTimeout(500);
        }

        // General de alumnos
        const general = page.locator('li, a, span').filter({ hasText: /^general de alumnos$/i }).first();
        if (await general.isVisible({ timeout: 2000 })) {
            await general.click();
            await page.waitForTimeout(2000);
        }

        console.log('✅ En página de General de Alumnos\n');

        // 3. SELECCIONAR UNIDAD (para ciclo 2026-2027 necesitamos seleccionar "Ambos")
        console.log('🔍 Buscando selector de Unidad...');
        try {
            // Buscar el dropdown de Unidad
            const unidadDropdown = page.locator('select, md-select').filter({ hasText: /Unidad|Plantel/i }).first();
            const isVisible = await unidadDropdown.isVisible({ timeout: 3000 }).catch(() => false);
            
            if (isVisible) {
                console.log('✅ Dropdown de Unidad encontrado');
                await unidadDropdown.click();
                await page.waitForTimeout(500);
                
                // Buscar opción "Todos los hermanos" o "Ambos"
                const opcionAmbos = page.locator('md-option, option').filter({ hasText: /Todos|Ambos/i }).first();
                if (await opcionAmbos.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await opcionAmbos.click();
                    console.log('✅ Seleccionado "Ambos" en Unidad');
                    await page.waitForTimeout(500);
                }
            } else {
                console.log('ℹ️ Dropdown de Unidad no visible, continuando...');
            }
        } catch (e) {
            console.log('⚠️ Error al seleccionar Unidad:', e);
        }

        // 4. HACER CLICK EN GENERAR
        console.log('🖱️ Haciendo click en GENERAR...');
        const botonGenerar = page.locator('a, button').filter({ hasText: /^generar$/i }).first();
        await botonGenerar.click();
        
        // Esperar a que se genere la tabla
        console.log('⏳ Esperando 8 segundos a que se genere la tabla...\n');
        await page.waitForTimeout(8000);

        // 5. CAPTURAR TODOS LOS ICONOS VISIBLES
        console.log('📋 Capturando TODOS los iconos visibles en la página:\n');
        console.log('═'.repeat(100));

        // Buscar TODOS los elementos con iconos, no solo <a>
        const todosLosIconos = page.locator('a:has(i), button:has(i), span:has(i), div:has(i.material-icons), div:has(i.fa)');
        const count = await todosLosIconos.count();
        console.log(`\n🔍 Encontrados ${count} elementos con iconos\n`);

        for (let i = 0; i < Math.min(count, 50); i++) {
            const elemento = todosLosIconos.nth(i);
            
            // Verificar si es visible
            const isVisible = await elemento.isVisible().catch(() => false);
            if (!isVisible) continue;

            // Capturar atributos
            const tagName = await elemento.evaluate(el => el.tagName).catch(() => '');
            const ngClick = await elemento.getAttribute('ng-click').catch(() => '');
            const onClick = await elemento.getAttribute('onclick').catch(() => '');
            const title = await elemento.getAttribute('title').catch(() => '');
            const href = await elemento.getAttribute('href').catch(() => '');
            const className = await elemento.getAttribute('class').catch(() => '');
            const id = await elemento.getAttribute('id').catch(() => '');
            
            // Capturar clase del icono <i>
            const iconElement = elemento.locator('i').first();
            const iconClass = await iconElement.getAttribute('class').catch(() => '');
            
            // Capturar texto visible
            const texto = await elemento.textContent().catch(() => '');

            // Solo mostrar si tiene ng-click, onclick, o si el texto/clase sugiere Excel
            const esRelevante = ngClick || onClick || 
                               texto?.toLowerCase().includes('excel') ||
                               texto?.toLowerCase().includes('exportar') ||
                               iconClass?.toLowerCase().includes('excel') ||
                               iconClass?.toLowerCase().includes('file') ||
                               iconClass?.toLowerCase().includes('download');

            if (esRelevante || i < 20) { // Mostrar los primeros 20 siempre
                console.log(`\n[${i}] <${tagName}> VISIBLE:`);
                console.log(`  ng-click: "${ngClick}"`);
                console.log(`  onclick: "${onClick}"`);
                console.log(`  title: "${title}"`);
                console.log(`  href: "${href}"`);
                console.log(`  class: "${className}"`);
                console.log(`  id: "${id}"`);
                console.log(`  icon class: "${iconClass}"`);
                console.log(`  texto: "${texto?.trim().substring(0, 50)}"`);
                console.log(`  ─`.repeat(50));
            }
        }

        // También buscar iconos SIN contenedor (solo <i> directos)
        console.log('\n\n🔍 Buscando iconos <i> directos (sin contenedor):\n');
        const iconosSolos = page.locator('i.material-icons, i.fa, i.glyphicon');
        const countSolos = await iconosSolos.count();
        console.log(`Encontrados ${countSolos} iconos directos\n`);

        for (let i = 0; i < Math.min(countSolos, 30); i++) {
            const icono = iconosSolos.nth(i);
            const isVisible = await icono.isVisible().catch(() => false);
            if (!isVisible) continue;

            const className = await icono.getAttribute('class').catch(() => '');
            const texto = await icono.textContent().catch(() => '');
            const parent = icono.locator('xpath=..');
            const parentTag = await parent.evaluate(el => el.tagName).catch(() => '');
            const parentNgClick = await parent.getAttribute('ng-click').catch(() => '');
            const parentOnClick = await parent.getAttribute('onclick').catch(() => '');

            console.log(`\n[${i}] <i> class="${className}" texto="${texto?.trim()}"`);
            console.log(`  parent: <${parentTag}> ng-click="${parentNgClick}" onclick="${parentOnClick}"`);
        }

        // Buscar específicamente iconos cerca del botón GENERAR
        console.log('\n\n🎯 Buscando iconos CERCA del botón GENERAR:\n');
        
        // Buscar iconos en la misma área visual que el botón GENERAR
        // Según la imagen, los iconos están en una fila horizontal debajo del botón
        const iconosCercaGenerar = page.locator([
            // Iconos que están después del botón GENERAR en el DOM
            'button:has-text("GENERAR") + * i',
            'button:has-text("Generar") + * i',
            'a:has-text("GENERAR") + * i',
            'a:has-text("Generar") + * i',
            // Iconos en contenedores de acciones
            '.uk-button-group i, .md-button-group i',
            '.actions i, .toolbar i, .report-actions i',
            // Iconos con clases específicas de acciones
            'i.uk-icon, i.md-icon',
        ].join(', '));

        const countCerca = await iconosCercaGenerar.count();
        console.log(`Encontrados ${countCerca} iconos cerca del botón GENERAR\n`);

        for (let i = 0; i < Math.min(countCerca, 20); i++) {
            const icono = iconosCercaGenerar.nth(i);
            const isVisible = await icono.isVisible().catch(() => false);
            if (!isVisible) continue;

            const className = await icono.getAttribute('class').catch(() => '');
            const texto = await icono.textContent().catch(() => '');
            
            // Obtener el padre (el elemento clickeable)
            const parent = icono.locator('xpath=..');
            const parentTag = await parent.evaluate(el => el.tagName).catch(() => '');
            const parentNgClick = await parent.getAttribute('ng-click').catch(() => '');
            const parentOnClick = await parent.getAttribute('onclick').catch(() => '');
            const parentClass = await parent.getAttribute('class').catch(() => '');
            const parentTitle = await parent.getAttribute('title').catch(() => '');

            console.log(`\n[${i}] <i> class="${className}" texto="${texto?.trim()}"`);
            console.log(`  parent: <${parentTag}>`);
            console.log(`    ng-click: "${parentNgClick}"`);
            console.log(`    onclick: "${parentOnClick}"`);
            console.log(`    class: "${parentClass}"`);
            console.log(`    title: "${parentTitle}"`);
        }

        console.log('\n═'.repeat(100));
        console.log('\n✅ Diagnóstico completado. Revisa los iconos arriba para identificar el de Excel.');
        console.log('💡 Busca el que tenga ng-click con "excel" o "exportar", o icon class con "file-excel"');
        
        // Mantener el navegador abierto para inspección manual
        console.log('\n⏸️ Navegador abierto para inspección manual. Presiona Ctrl+C para cerrar.');
        await page.waitForTimeout(300000); // 5 minutos

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

main();
