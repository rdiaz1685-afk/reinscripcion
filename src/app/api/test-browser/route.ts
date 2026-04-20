// ============================================
// API Route de Prueba: Browserless
// Proyecto: Reinscripción A
// ============================================

import { BrowserAutomation } from '@/lib/browser-automation';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route para probar Playwright + Browserless
 * 
 * Uso:
 * POST /api/test-browser
 * Body: { "action": "test" }
 */
export async function POST(req: NextRequest) {
  const browser = new BrowserAutomation('test-session');
  
  try {
    const { action, url } = await req.json();
    
    console.log('[Test Browser] Iniciando prueba...');
    console.log('[Test Browser] Action:', action);
    console.log('[Test Browser] URL:', url || 'N/A');
    
    // Inicializar navegador
    await browser.initialize();
    const page = browser.getPage();
    
    switch (action) {
      case 'test':
        // Prueba básica: Navegar a Google
        await page.goto('https://www.google.com');
        const title = await page.title();
        
        return NextResponse.json({
          success: true,
          message: 'Browserless funcionando correctamente',
          data: {
            title,
            url: page.url(),
            environment: process.env.NODE_ENV,
            usingBrowserless: !!process.env.BROWSERLESS_URL,
          }
        });
        
      case 'screenshot':
        // Tomar screenshot de una URL
        const targetUrl = url || 'https://www.google.com';
        await page.goto(targetUrl);
        const screenshot = await browser.takeScreenshot('test');
        
        return NextResponse.json({
          success: true,
          message: 'Screenshot capturado',
          data: {
            url: targetUrl,
            screenshot: screenshot.substring(0, 100) + '...', // Solo primeros 100 chars
          }
        });
        
      case 'scrape':
        // Extraer datos de una página
        const scrapeUrl = url || 'https://example.com';
        await page.goto(scrapeUrl);
        
        const data = await page.evaluate(() => {
          return {
            title: document.title,
            headings: Array.from(document.querySelectorAll('h1, h2')).map(h => h.textContent),
            links: Array.from(document.querySelectorAll('a')).slice(0, 5).map(a => ({
              text: a.textContent,
              href: a.getAttribute('href')
            }))
          };
        });
        
        return NextResponse.json({
          success: true,
          message: 'Datos extraídos correctamente',
          data
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida. Usa: test, screenshot, o scrape'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Test Browser] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
    
  } finally {
    // IMPORTANTE: Siempre cerrar el navegador
    await browser.close();
    console.log('[Test Browser] Navegador cerrado');
  }
}

/**
 * GET para información de la API
 */
export async function GET() {
  return NextResponse.json({
    name: 'Test Browser API',
    description: 'API para probar Playwright + Browserless',
    environment: process.env.NODE_ENV,
    browserlessConfigured: !!process.env.BROWSERLESS_URL,
    endpoints: {
      POST: {
        actions: ['test', 'screenshot', 'scrape'],
        examples: [
          {
            action: 'test',
            description: 'Prueba básica de navegación'
          },
          {
            action: 'screenshot',
            url: 'https://example.com',
            description: 'Captura screenshot de una URL'
          },
          {
            action: 'scrape',
            url: 'https://example.com',
            description: 'Extrae datos de una página'
          }
        ]
      }
    }
  });
}
