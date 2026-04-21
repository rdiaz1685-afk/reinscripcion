/**
 * scripts/sync-innovat.ts
 * Compatible con CommonJS (sin top-level await)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { syncFromInnovat, CAMPUS_LIST, SyncStep } from '../src/lib/innovat-agent';

const campusArgs = process.argv.slice(2).filter((a: string) => !a.startsWith('--'));
const campusList = campusArgs.length > 0 ? campusArgs : CAMPUS_LIST;

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║     SYNC INNOVAT → TURSO                 ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`📅 Fecha: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
console.log(`🏫 Campus: ${campusList.join(', ')}`);
console.log(`🔑 INNOVAT_USER: ${process.env.INNOVAT_USER || '(no definido)'}`);
console.log(`🗄️  TURSO_URL: ${process.env.TURSO_DATABASE_URL ? '✅ definida' : '❌ no definida'}`);
console.log('');

const requiredEnvVars = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'INNOVAT_USER', 'INNOVAT_PASS'];
const missingVars = requiredEnvVars.filter((v: string) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Variables de entorno faltantes: ${missingVars.join(', ')}`);
  process.exit(1);
}

const startTime = Date.now();

function handleStep(step: SyncStep): void {
  const ts = new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' });
  switch (step.type) {
    case 'login':
      console.log(`[${ts}] 🔑 Iniciando sesión en Innovat...`);
      break;
    case 'campus':
      console.log(`[${ts}] 🏫 Procesando: ${step.campus} (${step.ciclo})`);
      break;
    case 'downloaded':
      console.log(`[${ts}] 📥 Descargado: ${step.campus} ${step.ciclo}`);
      break;
    case 'processing':
      console.log(`[${ts}] ⚙️  Procesando ${step.count} alumnos — ${step.campus} ${step.ciclo}`);
      break;
    case 'saved':
      console.log(`[${ts}] 💾 Guardados ${step.count} registros — ${step.campus} ${step.ciclo}`);
      break;
    case 'error':
      console.error(`[${ts}] ❌ ${step.message}`);
      break;
    case 'debug':
      if (process.env.VERBOSE || process.env.CI) {
        console.log(`[${ts}]    ${step.message}`);
      }
      break;
    case 'done':
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log('');
      console.log(`[${ts}] ✅ Sync completado en ${elapsed} minutos`);
      console.log(`[${ts}] 📁 Archivos procesados: ${step.files.length}`);
      break;
  }
}

syncFromInnovat(campusList, handleStep)
  .then(() => {
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error('\n❌ Error fatal en el sync:');
    console.error(err);
    process.exit(1);
  });
