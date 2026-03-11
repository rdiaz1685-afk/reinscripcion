/**
 * Script de diagnóstico para encontrar los IDs correctos del ciclo 2026-2027
 * 
 * Este script escanea IDs del 1 al 200 con diferentes valores de Estatus
 * y muestra qué datos devuelve cada combinación para ayudar a identificar
 * los IDs correctos para el ciclo 2026-2027.
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

const INNOVAT_URL = 'https://innovat1.mx/Gaia/login';
const INNOVAT_USER = process.env.INNOVAT_USER || '';
const INNOVAT_PASS = process.env.INNOVAT_PASS || '';
const INNOVAT_SCHOOL = process.env.INNOVAT_SCHOOL || '';

const CAMPUS_TO_TEST = 'MITRAS'; // Cambiar según necesites
const CICLO_TO_TEST = '2026-2027';

async function main() {
    console.log('🔍 Iniciando diagnóstico de IDs para Innovat...\n');
    console.log(`Campus: ${CAMPUS_TO_TEST}`);
    console.log(`Ciclo: ${CICLO_TO_TEST}\n`);
    console.log('═'.repeat(80));

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Login
        console.log('\n🔑 Haciendo login...');
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

        // Navegar a General de Alumnos y seleccionar el campus/ciclo correcto
        console.log('🔄 Navegando a General de Alumnos...');
        await page.goto('https://innovat1.mx/Gaia/32.2.2/#/Inicio', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        // Seleccionar el campus y ciclo 2026-2027 en el dropdown
        console.log(`🔄 Seleccionando ${CAMPUS_TO_TEST} ${CICLO_TO_TEST}...`);
        
        const dropdownTrigger = page.locator([
            'a[ng-click*="Unidad"], a[ng-click*="Campus"]',
            'nav a:has-text("2025"), nav a:has-text("2026")',
        ].join(', ')).first();

        try {
            await dropdownTrigger.click({ timeout: 4000 });
            await page.waitForTimeout(800);
            
            // Buscar la opción del campus y ciclo
            const opciones = page.locator('ul li, li[ng-repeat]');
            const count = await opciones.count();
            
            for (let i = 0; i < count; i++) {
                const texto = await opciones.nth(i).textContent() || '';
                const textoNorm = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                
                if (textoNorm.includes(CAMPUS_TO_TEST) && textoNorm.includes(CICLO_TO_TEST)) {
                    await opciones.nth(i).click({ force: true });
                    await page.waitForTimeout(2000);
                    console.log(`✅ Seleccionado: ${texto.trim()}`);
                    break;
                }
            }
        } catch (e) {
            console.log('⚠️ No se pudo seleccionar campus/ciclo, continuando...');
        }

        // Navegar a General de Alumnos
        try {
            const escolar = page.locator('a:has-text("Escolar")').first();
            if (await escolar.isVisible({ timeout: 2000 })) {
                await escolar.click();
                await page.waitForTimeout(600);
            }

            const infoAlumnos = page.locator('a:has-text("Información Alumnos"), a:has-text("Información de Alumnos")').first();
            if (await infoAlumnos.isVisible({ timeout: 2000 })) {
                await infoAlumnos.click();
                await page.waitForTimeout(500);
            }

            const general = page.locator('a:has-text("General de alumnos"), a:has-text("General de Alumnos")').first();
            if (await general.isVisible({ timeout: 2000 })) {
                await general.click();
                await page.waitForTimeout(2000);
            }
            
            console.log('✅ En página General de Alumnos');
        } catch (e) {
            console.log('⚠️ Error navegando a General de Alumnos:', e);
        }

        console.log('\n🔍 Escaneando IDs del 1 al 200 con diferentes valores de Estatus...\n');
        console.log('═'.repeat(80));

        const apiUrl = 'https://innovat1.mx/Gaia/32.2.2/api/gralalumnos';
        const templateBody = {
            Filtro: 'Unidad',
            Ids: [],
            Estatus: 1,
            OptHermanos: 'TODOS',
            Campos: [
                { Alias: 'Matrícula', Codigo: 'A1', Seccion: 1, Columna: 1, Selected: true },
                { Alias: 'Nombre corto', Codigo: 'A5', Seccion: 1, Columna: 2, Selected: true },
                { Alias: 'Unidad', Codigo: 'A16', Seccion: 1, Columna: 3, Selected: true },
                { Alias: 'Grado', Codigo: 'A8', Seccion: 1, Columna: 4, Selected: true },
                { Alias: 'Grupo', Codigo: 'A9', Seccion: 1, Columna: 5, Selected: true },
                { Alias: 'Estatus', Codigo: 'A10', Seccion: 1, Columna: 6, Selected: true },
                { Alias: 'Fecha estatus', Codigo: 'A11', Seccion: 1, Columna: 7, Selected: true },
            ],
            Tipo: 'xlsx',
            Hermanos: 'TODOS',
        };

        const estatusValues = [-1, 0, 1, 2];
        const idsToTest = Array.from({ length: 200 }, (_, i) => String(i + 1));
        const campusNorm = CAMPUS_TO_TEST.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

        const resultados: Array<{
            id: string;
            estatus: number;
            count: number;
            campus: string;
            ciclo?: string;
            sample?: any;
        }> = [];

        for (const estatusValue of estatusValues) {
            console.log(`\n📊 Probando con Estatus: ${estatusValue}`);
            console.log('─'.repeat(80));

            for (const testId of idsToTest) {
                const scanBody = JSON.stringify({
                    ...templateBody,
                    Filtro: 'Unidad',
                    Ids: [testId],
                    Estatus: estatusValue
                });

                try {
                    const result = await page.evaluate(
                        async ({ url, body }: { url: string; body: string }) => {
                            try {
                                const res = await fetch(url, {
                                    method: 'PUT',
                                    credentials: 'include',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json, text/plain, */*'
                                    },
                                    body,
                                });

                                if (res.status === 200) {
                                    const text = await res.text();
                                    if (text.length > 50) {
                                        return { status: 200, text };
                                    }
                                }
                            } catch (e) {
                                return { status: 500, text: '', error: String(e) };
                            }
                            return { status: 500, text: '' };
                        },
                        { url: apiUrl, body: scanBody }
                    );

                    if (result.status === 200 && result.text.length > 5) {
                        try {
                            const json = JSON.parse(result.text);
                            if (Array.isArray(json) && json.length > 0) {
                                const nombreCampus = ((json[0].NombreComercial ?? json[0].Unidad ?? '') as string)
                                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                                
                                // Intentar detectar el ciclo de los datos
                                const sample = json[0];
                                
                                console.log(`  ✅ ID ${testId}: ${json.length} alumnos de "${nombreCampus}"`);
                                
                                resultados.push({
                                    id: testId,
                                    estatus: estatusValue,
                                    count: json.length,
                                    campus: nombreCampus,
                                    sample: sample
                                });

                                // Si encontramos el campus que buscamos, mostrar más detalles
                                if (nombreCampus === campusNorm || nombreCampus.includes(campusNorm)) {
                                    console.log(`     🎯 MATCH! Este es ${CAMPUS_TO_TEST}`);
                                    console.log(`     📋 Sample data:`, JSON.stringify(sample, null, 2).substring(0, 300));
                                }
                            }
                        } catch (e) {
                            // No es JSON válido
                        }
                    }
                } catch (e) {
                    // Error en la petición
                }

                // Mostrar progreso cada 50 IDs
                if (parseInt(testId) % 50 === 0) {
                    console.log(`  Progreso: ${testId}/200 IDs escaneados...`);
                }
            }
        }

        console.log('\n' + '═'.repeat(80));
        console.log('📊 RESUMEN DE RESULTADOS');
        console.log('═'.repeat(80));

        console.log(`\nTotal de IDs con datos: ${resultados.length}`);
        
        console.log(`\n🎯 IDs que coinciden con ${CAMPUS_TO_TEST}:`);
        const matchingIds = resultados.filter(r => 
            r.campus === campusNorm || r.campus.includes(campusNorm) || campusNorm.includes(r.campus)
        );
        
        if (matchingIds.length > 0) {
            matchingIds.forEach(r => {
                console.log(`  - ID ${r.id} con Estatus ${r.estatus}: ${r.count} alumnos`);
                console.log(`    Campus: ${r.campus}`);
                console.log(`    Sample:`, JSON.stringify(r.sample, null, 2).substring(0, 200));
            });
        } else {
            console.log(`  ❌ No se encontraron IDs para ${CAMPUS_TO_TEST}`);
        }

        console.log(`\n📋 Todos los IDs encontrados (agrupados por campus):`);
        const campusGroups = resultados.reduce((acc, r) => {
            if (!acc[r.campus]) acc[r.campus] = [];
            acc[r.campus].push(r);
            return acc;
        }, {} as Record<string, typeof resultados>);

        Object.entries(campusGroups).forEach(([campus, ids]) => {
            console.log(`\n  ${campus}:`);
            ids.forEach(r => {
                console.log(`    - ID ${r.id} (Estatus ${r.estatus}): ${r.count} alumnos`);
            });
        });

    } catch (error) {
        console.error('\n❌ Error:', error);
    } finally {
        await browser.close();
    }
}

main()
    .then(() => {
        console.log('\n✅ Diagnóstico completado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });
