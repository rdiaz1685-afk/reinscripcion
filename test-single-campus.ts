/**
 * Test simplificado para un solo campus y ciclo
 * Para verificar que el flujo completo funciona
 */

import { syncFromInnovat, type SyncStep } from './src/lib/innovat-agent';
import { config } from 'dotenv';

config();

async function main() {
    console.log('🧪 Iniciando prueba con MITRAS 2026-2027...\n');
    console.log('═'.repeat(80));

    const steps: SyncStep[] = [];
    
    try {
        const files = await syncFromInnovat(
            ['MITRAS'], // Solo MITRAS
            (step) => {
                steps.push(step);
                const timestamp = new Date().toLocaleTimeString('es-MX');
                
                if (step.type === 'debug') {
                    console.log(`[${timestamp}] 📝 ${step.message}`);
                } else if (step.type === 'login') {
                    console.log(`[${timestamp}] 🔐 Iniciando login...`);
                } else if (step.type === 'campus') {
                    console.log(`[${timestamp}] 📍 Procesando: ${step.campus} ${step.ciclo}`);
                } else if (step.type === 'downloaded') {
                    console.log(`[${timestamp}] ✅ Descargado: ${step.campus} ${step.ciclo} → ${step.path}`);
                } else if (step.type === 'error') {
                    console.log(`[${timestamp}] ❌ ${step.message}`);
                } else if (step.type === 'done') {
                    console.log(`[${timestamp}] 🎉 Completado. Archivos: ${step.files.join(', ')}`);
                }
            }
        );

        console.log('\n' + '═'.repeat(80));
        console.log('✅ Prueba completada');
        console.log(`📁 Archivos descargados: ${files.length}`);
        files.forEach(f => console.log(`   - ${f}`));

    } catch (error) {
        console.error('\n❌ Error en la prueba:', error);
        process.exit(1);
    }
}

main();
