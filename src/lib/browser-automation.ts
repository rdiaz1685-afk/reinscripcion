// ============================================
// Motor de Automatización con Playwright + Browserless
// Proyecto: Reinscripción A
// Basado en: Chatbot Innovat
// ============================================

import { chromium, Browser, Page, BrowserContext, Locator } from 'playwright';

/**
 * Clase para manejar la automatización del navegador
 * PRODUCCIÓN: Usa Browserless.io (Vercel)
 * DESARROLLO: Usa navegador local
 */
export class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionId: string;

  constructor(sessionId: string = `session-${Date.now()}`) {
    this.sessionId = sessionId;
  }

  /**
   * Inicializa el navegador
   * Detecta automáticamente si usar Browserless o local
   */
  async initialize(): Promise<void> {
    try {
      console.log(`[Browser-${this.sessionId}] Iniciando navegador...`);

      const isProduction = process.env.NODE_ENV === 'production';
      const browserlessUrl = process.env.BROWSERLESS_URL;

      if (isProduction && browserlessUrl) {
        console.log('[Browser] 🌐 Conectando a Browserless.io (producción)...');
        // Browserless v2 usa CDP nativo
        this.browser = await chromium.connectOverCDP(browserlessUrl);
      } else {
        const isHeadless = process.env.HEADLESS !== 'false';
        console.log(`[Browser] 💻 Iniciando navegador local (headless: ${isHeadless})...`);
        this.browser = await chromium.launch({
          headless: isHeadless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        });
      }

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'es-MX',
        timezoneId: 'America/Mexico_City',
      });

      this.page = await this.context.newPage();
      
      // Configurar timeout por defecto
      this.page.setDefaultTimeout(60000);

      console.log('[Browser] ✅ Navegador inicializado correctamente');
    } catch (error) {
      console.error('[Browser] ❌ Error al inicializar:', error);
      throw new Error(`Error al inicializar navegador: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Navega a una URL específica
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    try {
      console.log(`[Browser] Navegando a: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle' });
      await this.waitForPageLoad();
    } catch (error) {
      console.error('[Browser] Error al navegar:', error);
      throw new Error(`Error al navegar a ${url}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Espera a que la página termine de cargar
   */
  async waitForPageLoad(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // Ignorar si no alcanza networkidle
      });
    } catch {
      // Continuar si hay timeout
    }
  }

  /**
   * Captura un screenshot de la página actual
   */
  async takeScreenshot(name: string): Promise<string> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    try {
      const screenshot = await this.page.screenshot({
        fullPage: false,
        type: 'png',
      });

      // Convertir a base64
      const base64 = screenshot.toString('base64');
      
      console.log(`[Browser] Screenshot capturado: ${name}`);
      
      return base64;
    } catch (error) {
      console.error('[Browser] Error al capturar screenshot:', error);
      throw new Error('Error al capturar screenshot');
    }
  }

  /**
   * Alias para takeScreenshot (compatibilidad)
   */
  async captureScreenshot(name: string): Promise<string> {
    return this.takeScreenshot(name);
  }

  /**
   * Obtiene el contenido HTML de la página
   */
  async getHTML(): Promise<string> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    return await this.page.content();
  }

  /**
   * Obtiene la URL actual
   */
  getCurrentUrl(): string {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }
    return this.page.url();
  }

  /**
   * Busca un elemento por texto visible
   */
  async findByText(text: string, exact: boolean = false): Promise<Locator | null> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    try {
      const locator = this.page.getByText(text, { exact });
      const count = await locator.count();
      
      if (count > 0) {
        return locator;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Busca un input por placeholder o label
   */
  async findInput(placeholder?: string, label?: string): Promise<Locator | null> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    try {
      if (placeholder) {
        const locator = this.page.getByPlaceholder(placeholder);
        if (await locator.count() > 0) {
          return locator;
        }
      }

      if (label) {
        const locator = this.page.getByLabel(label);
        if (await locator.count() > 0) {
          return locator;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Busca un botón por texto
   */
  async findButton(text: string): Promise<Locator | null> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    try {
      const locator = this.page.getByRole('button', { name: text });
      if (await locator.count() > 0) {
        return locator;
      }

      // Buscar por texto como alternativa
      const textLocator = this.page.locator(`button:has-text("${text}")`);
      if (await textLocator.count() > 0) {
        return textLocator;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Escribe texto en un input
   */
  async fillInput(locator: Locator, value: string): Promise<void> {
    try {
      await locator.clear();
      await locator.fill(value);
      await this.waitForPageLoad();
    } catch (error) {
      console.error('[Browser] Error al llenar input:', error);
      throw error;
    }
  }

  /**
   * Hace clic en un elemento
   */
  async clickElement(locator: Locator): Promise<void> {
    try {
      await locator.click();
      await this.waitForPageLoad();
    } catch (error) {
      console.error('[Browser] Error al hacer clic:', error);
      throw error;
    }
  }

  /**
   * Selecciona una opción de un dropdown
   */
  async selectOption(locator: Locator, value: string): Promise<void> {
    try {
      await locator.selectOption({ label: value });
      await this.waitForPageLoad();
    } catch (error) {
      console.error('[Browser] Error al seleccionar opción:', error);
      throw error;
    }
  }

  /**
   * Espera a que aparezca un elemento
   */
  async waitForElement(selector: string, timeout?: number): Promise<Locator> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    const locator = this.page.locator(selector);
    await locator.waitFor({ 
      state: 'visible',
      timeout: timeout || 60000
    });
    return locator;
  }

  /**
   * Espera un tiempo específico
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene el texto de un elemento
   */
  async getElementText(locator: Locator): Promise<string> {
    return await locator.textContent() || '';
  }

  /**
   * Obtiene todos los textos que coinciden con un selector
   */
  async getAllTexts(selector: string): Promise<string[]> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    const elements = await this.page.locator(selector).all();
    const texts: string[] = [];

    for (const element of elements) {
      const text = await element.textContent();
      if (text) {
        texts.push(text.trim());
      }
    }

    return texts;
  }

  /**
   * Extrae datos de una tabla
   */
  async extractTableData(tableSelector: string): Promise<string[][]> {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }

    const table = this.page.locator(tableSelector);
    const rows = await table.locator('tr').all();
    const data: string[][] = [];

    for (const row of rows) {
      const cells = await row.locator('td, th').all();
      const rowData: string[] = [];

      for (const cell of cells) {
        const text = await cell.textContent();
        rowData.push(text?.trim() || '');
      }

      if (rowData.length > 0) {
        data.push(rowData);
      }
    }

    return data;
  }

  /**
   * Verifica si existe un elemento en la página
   */
  async elementExists(selector: string): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      const count = await this.page.locator(selector).count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene la página actual
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Navegador no inicializado');
    }
    return this.page;
  }

  /**
   * Cierra el navegador y limpia recursos
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      console.log('[Browser] ✅ Navegador cerrado correctamente');
    } catch (error) {
      console.error('[Browser] ❌ Error al cerrar navegador:', error);
    }
  }

  /**
   * Ejecuta una acción con reintentos
   */
  async withRetry<T>(
    action: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Error desconocido');
        console.warn(`[Browser] Intento ${attempt}/${maxRetries} falló:`, lastError.message);
        
        if (attempt < maxRetries) {
          await this.wait(1000 * attempt); // Backoff exponencial
        }
      }
    }

    throw lastError || new Error('Error después de todos los reintentos');
  }
}

export default BrowserAutomation;
