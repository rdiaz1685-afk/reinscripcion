/**
 * Script de prueba para ejecutar el agente de Innovat end-to-end
 * 
 * Este script ejecuta el agente completo para los 4 campus que supuestamente fallan
 * (MITRAS, NORTE, CUMBRES, ANAHUAC) y verifica si la descarga de Excel funciona.
 */

import { syncFromInnovat, SyncStep } from './src/lib/innovat-agent';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Los 4 campus que supuestamente fallan
const FAILING_CAMPUSES = ['MITRAS', 'NORTE', 'CUMBRES', 'ANAHUAC'];

async function testInnovatAgent() {
    console.log('🚀 Iniciando prueba del agente de Innovat...\n');
    console.log(`📋 Campus a probar: ${FAILING_CAMPUSES.join(', ')}\n`);
    console.log('─'.repeat(80));

    const logs: string[] = [];
    const errors: string[] = [];
    const downloads: { campus: string; ciclo: string; path: string }[] = [];

    try {
        const archivosDescargados = await syncFromInnovat(
            FAILING_CAMPUSES,
            (step: SyncStep) => {
                const timestamp = new Date().toISOString().substring(11, 19);
                
                switch (step.type) {
                    case 'login':
                        console.log(`\n[${timestamp}] 🔑 Iniciando login...`);
                        logs.push(`[${timestamp}] LOGIN`);
                        break;
                    
                    case 'campus':
                        console.log(`\n[${timestamp}] 📍 Procesando: ${step.campus} ${step.ciclo}`);
                        logs.push(`[${timestamp}] CAMPUS: ${step.campus} ${step.ciclo}`);
                        break;
                    
                    case 'downloaded':
                        console.log(`[${timestamp}] ✅ Descargado: ${step.campus} ${step.ciclo} → ${step.path}`);
                        logs.push(`[${timestamp}] DOWNLOADED: ${step.campus} ${step.ciclo}`);
                        downloads.push({ campus: step.campus, ciclo: step.ciclo, path: step.path });
                        break;
                    
                    case 'error':
                        console.log(`[${timestamp}] ❌ Error: ${step.message}`);
                        errors.push(`[${timestamp}] ${step.message}`);
                        break;
                    
                    case 'done':
                        console.log(`\n[${timestamp}] 🎉 Proceso completado`);
                        console.log(`[${timestamp}] Archivos descargados: ${step.files.join(', ')}`);
                        logs.push(`[${timestamp}] DONE: ${step.files.length} archivos`);
                        break;
                    
                    case 'debug':
                        // Solo mostrar mensajes de debug importantes
                        if (step.message.includes('❌') || 
                            step.message.includes('⚠️') || 
                            step.message.includes('✅') ||
                            step.message.includes('📍')) {
                            console.log(`[${timestamp}] ${step.message}`);
                        }
                        logs.push(`[${timestamp}] DEBUG: ${step.message}`);
                        break;
                }
            }
        );

        console.log('\n' + '═'.repeat(80));
        console.log('📊 RESUMEN DE RESULTADOS');
        console.log('═'.repeat(80));
        
        console.log(`\n✅ Archivos descargados exitosamente: ${archivosDescargados.length}`);
        archivosDescargados.forEach(file => console.log(`   - ${file}`));
        
        console.log(`\n📥 Descargas por campus:`);
        downloads.forEach(d => console.log(`   - ${d.campus} ${d.ciclo}: ${d.path}`));
        
        if (errors.length > 0) {
            console.log(`\n❌ Errores encontrados: ${errors.length}`);
            errors.forEach(err => console.log(`   - ${err}`));
        }

        console.log('\n' + '═'.repeat(80));
        console.log('🔍 ANÁLISIS DEL BUG');
        console.log('═'.repeat(80));
        
        const campusExitosos = downloads.map(d => d.campus);
        const campusFallidos = FAILING_CAMPUSES.filter(c => !campusExitosos.includes(c));
        
        if (campusFallidos.length === 0) {
            console.log('\n✅ TODOS LOS CAMPUS FUNCIONAN CORRECTAMENTE');
            console.log('   → El bug reportado NO se reproduce en el código actual');
            console.log('   → Posibles causas:');
            console.log('     • El código ya tiene un fix implementado');
            console.log('     • Innovat revirtió los cambios que causaban el problema');
            console.log('     • El bug nunca existió de esta manera');
        } else {
            console.log(`\n❌ BUG CONFIRMADO - ${campusFallidos.length} campus fallaron:`);
            campusFallidos.forEach(campus => {
                console.log(`   - ${campus}: No se pudo descargar el archivo Excel`);
            });
            console.log('\n   → El bug existe y necesita ser arreglado');
        }

        console.log('\n' + '═'.repeat(80));

    } catch (error) {
        console.error('\n💥 Error fatal durante la ejecución:', error);
        throw error;
    }
}

// Ejecutar el test
testInnovatAgent()
    .then(() => {
        console.log('\n✅ Prueba completada exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Prueba falló:', error);
        process.exit(1);
    });
