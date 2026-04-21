/**
 * scripts/sync-innovat.mjs
 * 
 * Script standalone para correr el sync de Innovat desde GitHub Actions.
 * NO depende de Next.js ni de Vercel — corre directamente con Node.js.
 * 
 * Uso:
 *   node --expose-gc scripts/sync-innovat.mjs
 *   node --expose-gc scripts/sync-innovat.mjs CUMBRES ANAHUAC   ← solo campus específicos
 */

// Cargar variables de entorno desde .env (solo en local)
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

// Importar el agente (TypeScript compilado o via tsx/ts-node)
// Usamos la versión compilada si existe, sino tsx para desarrollo
let syncFromInnovat;
let CAMPUS_LIST;

try {
  // Intentar importar versión compilada (producción)
  const agent = await import('../.next/server/chunks/innovat-agent.js').catch(() => null)
    || await import('../src/lib/innovat-agent.js').catch(() => null);
  
  if (agent) {
    syncFromInnovat = agent.syncFromInnovat;
    CAMPUS_LIST = agent.CAMPUS_LIST;
  }
} catch {
  // fallback: usar tsx (desarrollo o si no hay build)
}

// Si no se pudo importar el compilado, usar tsx directamente
if (!syncFromInnovat) {
  const { execSync } = await import('child_process');
  
  // Verificar que tsx está disponible
  try {
    execSync('npx tsx --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ Error: No se puede importar el agente compilado ni tsx.');
    console.error('   Solución: Agrega "tsx" a devDependencies o corre "npm run build" primero.');
    process.exit(1);
  }

  // Re-ejecutar este script con tsx para que pueda importar TypeScript
  const args = process.argv.slice(2).join(' ');
  const { spawnSync } = await import('child_process');
  const result = spawnSync(
    'npx', ['tsx', 'scripts/sync-innovat.ts', ...process.argv.slice(2)],
    { stdio: 'inherit', env: process.env }
  );
  process.exit(result.status ?? 0);
}

// ─── Lógica principal ─────────────────────────────────────────────────────

// Leer campus desde argumentos (ej: node sync-innovat.mjs CUMBRES ANAHUAC)
const campusArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
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

// Validar variables de entorno requeridas
const requiredEnvVars = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'INNOVAT_USER', 'INNOVAT_PASS'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Variables de entorno faltantes: ${missingVars.join(', ')}`);
  console.error('   Configúralas en GitHub → Settings → Secrets → Actions');
  process.exit(1);
}

const startTime = Date.now();
let exitCode = 0;

try {
  await syncFromInnovat(campusList, (step) => {
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
        exitCode = 1;
        break;
      case 'debug':
        // Solo mostrar debug en verbose mode o en CI
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
  });

} catch (err) {
  console.error('');
  console.error('❌ Error fatal en el sync:');
  console.error(err);
  exitCode = 1;
}

process.exit(exitCode);
