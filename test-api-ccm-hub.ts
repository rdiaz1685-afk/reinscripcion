/**
 * Script de prueba para los endpoints de CCM HUB
 * 
 * Ejecutar con: bun run test-api-ccm-hub.ts
 * 
 * Asegúrate de que el servidor esté corriendo en http://localhost:3000
 */

const API_URL = 'http://localhost:3000';
const API_KEY = 'ccm_hub_secret_key_2026_cambiar_en_produccion';

async function testMetricsEndpoint() {
  console.log('\n🧪 Probando /api/ccm-hub/metrics...\n');

  const tests = [
    { campus: 'MITRAS', grupo: null },
    { campus: 'NORTE', grupo: null },
    { campus: 'MITRAS', grupo: '3A' },
    { campus: null, grupo: null }, // Global
  ];

  for (const test of tests) {
    const params = new URLSearchParams();
    if (test.campus) params.append('campus', test.campus);
    if (test.grupo) params.append('grupo', test.grupo);

    const url = `${API_URL}/api/ccm-hub/metrics?${params}`;
    
    console.log(`📍 GET ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`   ❌ Error: ${response.status} ${response.statusText}`);
        const error = await response.json();
        console.log(`   Detalles:`, error);
        continue;
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✅ Success`);
        console.log(`   Campus: ${data.data.campus}`);
        console.log(`   Total alumnos: ${data.data.totalAlumnos}`);
        console.log(`   Reinscritos: ${data.data.reinscritos}`);
        console.log(`   % RI: ${data.data.porcentajeRI}%`);
        console.log(`   Grupos: ${Object.keys(data.data.grupos).length}`);
      } else {
        console.log(`   ❌ Error en respuesta:`, data);
      }
    } catch (error) {
      console.log(`   ❌ Error de red:`, error);
    }
    
    console.log('');
  }
}

async function testRotacionEndpoint() {
  console.log('\n🧪 Probando /api/ccm-hub/rotacion...\n');

  const campuses = ['MITRAS', 'NORTE', 'CUMBRES', 'ANAHUAC', 'DOMINIO', null];

  for (const campus of campuses) {
    const params = new URLSearchParams();
    if (campus) params.append('campus', campus);

    const url = `${API_URL}/api/ccm-hub/rotacion?${params}`;
    
    console.log(`📍 GET ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`   ❌ Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✅ Success`);
        console.log(`   Campus: ${data.data.campus}`);
        console.log(`   Empleados anterior: ${data.data.empleadosAnterior}`);
        console.log(`   Empleados actual: ${data.data.empleadosActual}`);
        console.log(`   Bajas: ${data.data.bajas}`);
        console.log(`   % Rotación: ${data.data.porcentajeRotacion}%`);
      } else {
        console.log(`   ❌ Error en respuesta:`, data);
      }
    } catch (error) {
      console.log(`   ❌ Error de red:`, error);
    }
    
    console.log('');
  }
}

async function testUnauthorized() {
  console.log('\n🧪 Probando acceso sin API Key...\n');

  const url = `${API_URL}/api/ccm-hub/metrics?campus=MITRAS`;
  
  console.log(`📍 GET ${url} (sin API key)`);
  
  try {
    const response = await fetch(url);

    if (response.status === 401) {
      console.log(`   ✅ Correctamente bloqueado (401 Unauthorized)`);
    } else {
      console.log(`   ❌ Debería retornar 401, pero retornó: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error de red:`, error);
  }
  
  console.log('');
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  TEST DE API CCM HUB');
  console.log('═'.repeat(60));

  // Verificar que el servidor esté corriendo
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      console.log('\n❌ El servidor no está corriendo en', API_URL);
      console.log('   Ejecuta: bun run dev\n');
      process.exit(1);
    }
  } catch (error) {
    console.log('\n❌ No se puede conectar al servidor en', API_URL);
    console.log('   Ejecuta: bun run dev\n');
    process.exit(1);
  }

  await testUnauthorized();
  await testMetricsEndpoint();
  await testRotacionEndpoint();

  console.log('═'.repeat(60));
  console.log('  ✅ PRUEBAS COMPLETADAS');
  console.log('═'.repeat(60));
}

main().catch(console.error);
