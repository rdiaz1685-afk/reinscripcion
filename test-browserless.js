// ============================================
// Script de Prueba: Browserless
// Proyecto: Reinscripción A
// ============================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testBrowserless() {
  console.log('🧪 Iniciando pruebas de Browserless...\n');
  
  // Test 1: Prueba básica
  console.log('📋 Test 1: Prueba básica de navegación');
  try {
    const response = await fetch(`${BASE_URL}/api/test-browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Test básico exitoso');
      console.log('   Título:', result.data.title);
      console.log('   URL:', result.data.url);
      console.log('   Ambiente:', result.data.environment);
      console.log('   Usando Browserless:', result.data.usingBrowserless);
    } else {
      console.log('❌ Test básico falló:', result.error);
    }
  } catch (error) {
    console.log('❌ Error en test básico:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Screenshot
  console.log('📋 Test 2: Captura de screenshot');
  try {
    const response = await fetch(`${BASE_URL}/api/test-browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'screenshot',
        url: 'https://example.com'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Screenshot capturado');
      console.log('   URL:', result.data.url);
      console.log('   Screenshot (preview):', result.data.screenshot);
    } else {
      console.log('❌ Screenshot falló:', result.error);
    }
  } catch (error) {
    console.log('❌ Error en screenshot:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: Scraping
  console.log('📋 Test 3: Extracción de datos');
  try {
    const response = await fetch(`${BASE_URL}/api/test-browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'scrape',
        url: 'https://example.com'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Datos extraídos');
      console.log('   Título:', result.data.title);
      console.log('   Encabezados:', result.data.headings);
      console.log('   Links (primeros 5):', result.data.links.length);
    } else {
      console.log('❌ Scraping falló:', result.error);
    }
  } catch (error) {
    console.log('❌ Error en scraping:', error.message);
  }
  
  console.log('\n---\n');
  console.log('✅ Pruebas completadas\n');
}

// Ejecutar pruebas
testBrowserless().catch(console.error);
