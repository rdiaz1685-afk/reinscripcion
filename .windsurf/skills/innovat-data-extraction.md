# Estrategia de Extracción de Datos de Innovat

## 📋 Resumen
Esta estrategia extrae datos de alumnos desde Innovat sin depender de IDs estáticos que cambian frecuentemente. Está basada en el proyecto chatbot que funciona exitosamente en producción.

## 🎯 Problema Resuelto
- ❌ **Problema anterior**: Usar `UNIT_IDS` estáticos que se vuelven obsoletos
- ✅ **Solución actual**: Extraer datos directamente de la tabla HTML después de hacer click en GENERAR

## 🔧 Implementación

### 1. Navegación a General de Alumnos
```typescript
// Navegar: Escolar → Información Alumnos → General de alumnos
await page.evaluate(() => {
  const escolar = Array.from(document.querySelectorAll('span'))
    .find(s => s.textContent?.trim().toLowerCase() === 'escolar');
  if (escolar) escolar.click();
});

await page.evaluate(() => {
  const infoAlumnos = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent?.toLowerCase().includes('información alumnos'));
  if (infoAlumnos) infoAlumnos.click();
});

await page.evaluate(() => {
  const general = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent?.toLowerCase().includes('general de alumnos'));
  if (general) general.click();
});
```

### 2. Configurar Campos Necesarios
```typescript
// Activar solo los checkboxes necesarios
await page.evaluate(() => {
  const targets = ['MATRÍCULA', 'NOMBRE CORTO', 'UNIDAD', 'GRADO', 'GRUPO', 'ESTATUS', 'FECHA ESTATUS', 'COMENTARIO ESTATUS'];
  const labels = Array.from(document.querySelectorAll('label'));
  
  for (const lbl of labels) {
    const text = lbl.textContent?.trim().toUpperCase() || '';
    const input = lbl.querySelector('input') as HTMLInputElement;
    
    if (!input || input.type !== 'checkbox') continue;
    
    const isTarget = targets.includes(text);
    if (isTarget && !input.checked) {
      lbl.click(); // Activar
    } else if (!isTarget && input.checked) {
      lbl.click(); // Desactivar para reducir carga
    }
  }
});
```

### 3. Hacer Click en GENERAR
```typescript
const botonGenerar = page.locator('button, a').filter({ hasText: /^GENERAR$/i }).first();
await botonGenerar.click({ force: true });

// Esperar que la tabla se cargue (8 segundos es suficiente)
await page.waitForTimeout(8000);
```

### 4. Detectar Columnas Dinámicamente
```typescript
const headers = await page.locator('table thead th').all();
const columnMap: Record<string, number> = {};

for (let i = 0; i < headers.length; i++) {
  const text = (await headers[i].innerText().catch(() => '')).toUpperCase().trim();
  if (text.includes('MATR')) columnMap['matricula'] = i;
  if (text.includes('NOMBR')) columnMap['nombre'] = i;
  if (text.includes('UNIDAD')) columnMap['unidad'] = i;
  if (text.includes('GRADO')) columnMap['grado'] = i;
  if (text.includes('GRUPO')) columnMap['grupo'] = i;
  if (text.includes('ESTATUS')) columnMap['estatus'] = i;
  if (text.includes('FECHA')) columnMap['fecha'] = i;
  if (text.includes('COMENTARIO')) columnMap['comentario'] = i;
}
```

### 5. Extraer Datos de la Tabla
```typescript
const rows = await page.locator('table tbody tr').all();
const alumnos: Record<string, unknown>[] = [];

for (const row of rows) {
  const cells = await row.locator('td').all();
  const cellTexts = await Promise.all(cells.map(c => c.innerText().catch(() => '')));
  
  const alumno: Record<string, unknown> = {};
  if (columnMap['matricula'] !== undefined) alumno['Matricula'] = cellTexts[columnMap['matricula']]?.trim();
  if (columnMap['nombre'] !== undefined) alumno['Nombre'] = cellTexts[columnMap['nombre']]?.trim();
  if (columnMap['unidad'] !== undefined) alumno['Unidad'] = cellTexts[columnMap['unidad']]?.trim();
  if (columnMap['grado'] !== undefined) alumno['Grado'] = cellTexts[columnMap['grado']]?.trim();
  if (columnMap['grupo'] !== undefined) alumno['Grupo'] = cellTexts[columnMap['grupo']]?.trim();
  if (columnMap['estatus'] !== undefined) alumno['Estatus'] = cellTexts[columnMap['estatus']]?.trim();
  if (columnMap['fecha'] !== undefined) alumno['Fecha estatus'] = cellTexts[columnMap['fecha']]?.trim();
  if (columnMap['comentario'] !== undefined) alumno['Comentario estatus'] = cellTexts[columnMap['comentario']]?.trim();
  
  // Solo agregar si tiene matrícula y nombre
  if (alumno['Matricula'] && alumno['Nombre']) {
    alumnos.push(alumno);
  }
}
```

### 6. Procesar y Guardar en BD
```typescript
// Normalizar keys y preparar datos
const normalizeKey = (obj: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  for (const key in obj) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('matrícula') || lowerKey.includes('matricula')) {
      normalized.matricula = obj[key];
    } else if (lowerKey.includes('nombre')) {
      normalized.nombre = obj[key];
    }
    // ... más campos
  }
  return normalized;
};

// Guardar en lote
if (ciclo === '2025-2026') {
  await db.alumno25_26.deleteMany({ where: { unidad: campus.toUpperCase() } });
  await db.alumno25_26.createMany({ data: datosParaGuardar });
} else {
  await db.alumno26_27.deleteMany({ where: { unidad: campus.toUpperCase() } });
  await db.alumno26_27.createMany({ data: datosParaGuardar });
}
```

## ✅ Ventajas de Esta Estrategia

1. **No depende de IDs estáticos** - Los Unit IDs cambian frecuentemente en Innovat
2. **Usa el campus preseleccionado** - No necesita buscar ni inyectar IDs
3. **Detecta columnas dinámicamente** - Funciona aunque cambien el orden de las columnas
4. **Extracción directa del DOM** - Más confiable que interceptar APIs
5. **Probado en producción** - Funciona exitosamente en el proyecto chatbot

## 🚨 Puntos Importantes

- **Esperar 8 segundos** después de GENERAR es crucial para que la tabla cargue
- **Desactivar checkboxes innecesarios** reduce la carga de memoria
- **Validar matrícula y nombre** antes de agregar a la lista
- **Guardar en lote** con `createMany` es más eficiente que uno por uno
- **Borrar registros existentes** antes de insertar para evitar duplicados

## 📝 Uso en Producción

```typescript
// En producción (Render), usar esta estrategia directamente
const isCloudEnv = process.env.RENDER_ENVIRONMENT || 
                   process.env.RAILWAY_ENVIRONMENT || 
                   process.env.NODE_ENV === 'production';

if (isCloudEnv) {
  return await ejecutarFallbackDirecto(page, botonGenerar, filePath, campus, ciclo, onStep);
}
```

## 🔗 Referencias

- **Proyecto origen**: `C:\Users\Contabilidad\Documents\proyectos\chatbot`
- **Archivo fuente**: `src\lib\automation\innovat-agent.ts`
- **Métodos clave**: 
  - `configureFiltersAndGenerate()` - Configurar checkboxes y hacer click en GENERAR
  - `searchAndVerifyCURP()` - Extraer datos de la tabla HTML

## 📊 Logs Esperados

```
🔄 Extrayendo datos de tabla HTML (estrategia chatbot)
🖱️ Haciendo click en GENERAR...
⏳ Esperando que la tabla se cargue...
🔍 Analizando encabezados de tabla...
📋 Columnas detectadas: {"matricula":0,"nombre":1,"unidad":2,...}
📊 Extrayendo datos de la tabla...
✅ 450 alumnos extraídos de la tabla
📊 Muestra: {"Matricula":"123456","Nombre":"Juan Perez",...}
🔄 Guardando 450 alumnos en BD...
💾 Guardando 450 registros en BD...
🗑️ Borrando registros existentes de MITRAS en alumno26_27...
➕ Insertando 450 registros en alumno26_27...
✅ 450 alumnos guardados en BD
```

---

**Última actualización**: Marzo 26, 2026
**Estado**: ✅ Implementado y funcionando en producción
