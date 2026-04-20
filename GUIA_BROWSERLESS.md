# 🚀 Guía de Uso: Playwright + Browserless en Reinscripción A

## ✅ Configuración Completada

### Variables de Entorno en Vercel:
```env
BROWSERLESS_URL=wss://production-sfo.browserless.io?token=2UB7pySkMriWVkhf735b205a04cfd691cf5d90143cfa4e8e2
NODE_ENV=production
```

---

## 📁 Archivo Creado

### `src/lib/browser-automation.ts`
- ✅ Clase `BrowserAutomation` lista para usar
- ✅ Conecta automáticamente a Browserless en producción
- ✅ Usa navegador local en desarrollo
- ✅ Misma arquitectura que el chatbot de Innovat

---

## 🎯 Cómo Usar

### Ejemplo 1: Uso Básico

```typescript
import { BrowserAutomation } from '@/lib/browser-automation';

async function ejemplo() {
  const browser = new BrowserAutomation();
  
  try {
    // Inicializar (automáticamente usa Browserless en producción)
    await browser.initialize();
    
    // Obtener la página
    const page = browser.getPage();
    
    // Navegar
    await page.goto('https://tu-sistema.com');
    
    // Interactuar
    await page.fill('#username', 'usuario');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    
    // Extraer datos
    const data = await page.textContent('.resultado');
    
    return data;
  } finally {
    // SIEMPRE cerrar el navegador
    await browser.close();
  }
}
```

### Ejemplo 2: En API Route

```typescript
// app/api/automation/route.ts
import { BrowserAutomation } from '@/lib/browser-automation';

export async function POST(req: Request) {
  const browser = new BrowserAutomation();
  
  try {
    const { action, data } = await req.json();
    
    await browser.initialize();
    const page = browser.getPage();
    
    switch (action) {
      case 'scrape':
        await page.goto(data.url);
        const content = await page.content();
        return Response.json({ success: true, content });
        
      case 'login':
        await page.goto(data.url);
        await page.fill('#user', data.username);
        await page.fill('#pass', data.password);
        await page.click('button[type="submit"]');
        return Response.json({ success: true });
        
      default:
        return Response.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Error' 
    }, { status: 500 });
  } finally {
    await browser.close();
  }
}
```

### Ejemplo 3: Integración con innovat-agent.ts

```typescript
// En tu innovat-agent.ts existente
import { BrowserAutomation } from './browser-automation';

export class InnovatAgent {
  private browser: BrowserAutomation;
  
  constructor() {
    this.browser = new BrowserAutomation('innovat-session');
  }
  
  async procesarReinscripcion(curp: string) {
    try {
      await this.browser.initialize();
      const page = this.browser.getPage();
      
      // Tu lógica de Innovat aquí
      await page.goto('https://innovat.mx');
      // ...
      
      return { success: true };
    } finally {
      await this.browser.close();
    }
  }
}
```

---

## 🔧 Métodos Disponibles

### Navegación:
- `initialize()` - Inicia el navegador
- `navigateTo(url)` - Navega a una URL
- `getCurrentUrl()` - Obtiene URL actual
- `waitForPageLoad()` - Espera carga completa

### Búsqueda de Elementos:
- `findByText(text)` - Busca por texto visible
- `findInput(placeholder, label)` - Busca inputs
- `findButton(text)` - Busca botones
- `waitForElement(selector)` - Espera elemento

### Interacción:
- `fillInput(locator, value)` - Llena inputs
- `clickElement(locator)` - Hace clic
- `selectOption(locator, value)` - Selecciona dropdown

### Extracción:
- `getHTML()` - Obtiene HTML completo
- `getAllTexts(selector)` - Obtiene textos
- `extractTableData(selector)` - Extrae tablas
- `getElementText(locator)` - Obtiene texto de elemento

### Utilidades:
- `takeScreenshot(name)` - Captura pantalla
- `wait(ms)` - Espera tiempo
- `withRetry(action, retries)` - Reintenta acciones
- `elementExists(selector)` - Verifica existencia

### Avanzado:
- `getPage()` - Obtiene objeto Page de Playwright
- `close()` - Cierra navegador (IMPORTANTE)

---

## 💰 Costos y Límites

### Plan Actual (Compartido con Chatbot):
- **Free**: 6 horas/mes
- **Uso**: Chatbot + Reinscripción A

### Si necesitas más:
- **Starter**: $29/mes → 100 horas
- **Pro**: $99/mes → 500 horas

### Optimización:
```typescript
// ✅ BUENO: Cierra siempre
try {
  await browser.initialize();
  // ... tu código
} finally {
  await browser.close(); // ← IMPORTANTE
}

// ❌ MALO: No cierra
await browser.initialize();
// ... tu código
// ← Navegador queda abierto = gastas horas
```

---

## 🐛 Troubleshooting

### Error: "Browser not initialized"
```typescript
// Solución: Llamar initialize() primero
await browser.initialize();
const page = browser.getPage(); // Ahora sí funciona
```

### Error: "Connection timeout"
```typescript
// Solución: Aumentar timeout
const page = browser.getPage();
page.setDefaultTimeout(90000); // 90 segundos
```

### Error: "BROWSERLESS_URL not found"
```bash
# Verificar en Vercel:
# Settings → Environment Variables
# Debe existir: BROWSERLESS_URL
```

---

## 📊 Monitoreo

### Ver uso de Browserless:
1. https://www.browserless.io/
2. Login
3. Dashboard → Usage

### Ver logs en Vercel:
```bash
vercel logs --follow
```

---

## ✅ Checklist de Implementación

- [x] Archivo `browser-automation.ts` creado
- [x] Variable `BROWSERLESS_URL` configurada en Vercel
- [ ] Instalar Playwright: `npm install playwright`
- [ ] Crear API route de prueba
- [ ] Probar en desarrollo (local)
- [ ] Desplegar en Vercel
- [ ] Verificar que usa Browserless (ver logs)

---

## 🎯 Próximos Pasos

1. **Instalar Playwright**:
   ```bash
   cd "c:/Users/Contabilidad/Documents/proyectos/reinscripcion A"
   npm install playwright
   ```

2. **Crear API Route de Prueba**:
   - Ver ejemplo arriba
   - Probar localmente primero

3. **Desplegar en Vercel**:
   ```bash
   vercel deploy
   ```

4. **Verificar Logs**:
   - Debe decir: "Conectando a Browserless.io"
   - NO debe decir: "Iniciando navegador local"

---

**✅ Todo listo para usar Playwright en producción con Browserless!**
