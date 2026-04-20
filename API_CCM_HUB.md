# API CCM HUB - Documentación

API REST para integración entre el Sistema de Reinscripción y CCM HUB (Digital Hub).

---

## 🔐 **Autenticación**

Todos los endpoints requieren un API Key en el header:

```http
x-api-key: ccm_hub_secret_key_2026_cambiar_en_produccion
```

**Configuración:**
- Variable de entorno: `CCM_HUB_API_KEY`
- Archivo: `.env`

---

## 📊 **Endpoints**

### **1. Métricas de Reinscripción**

Obtiene métricas de reinscripción por campus y/o grupo.

**URL:** `GET /api/ccm-hub/metrics`

**Query Parameters:**
- `campus` (opcional): Nombre del campus (`MITRAS`, `NORTE`, `CUMBRES`, `ANAHUAC`, `DOMINIO`)
- `grupo` (opcional): Nombre del grupo (`3A`, `3B`, etc.)

**Ejemplo:**
```bash
curl -H "x-api-key: ccm_hub_secret_key_2026_cambiar_en_produccion" \
  "http://localhost:3000/api/ccm-hub/metrics?campus=MITRAS"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "campus": "MITRAS",
    "periodo": "2025-2026 → 2026-2027",
    "totalAlumnos": 450,
    "reinscritos": 360,
    "bajasTransferencia": 15,
    "bajasReales": 10,
    "porReinscribir": 65,
    "porcentajeRI": 80.00,
    "meta": 400,
    "porcentajeCumplimiento": 90.00,
    "grupos": {
      "3A": {
        "total": 25,
        "reinscritos": 20,
        "bajasTransferencia": 1,
        "bajasReales": 0,
        "porReinscribir": 4,
        "porcentaje": 80.00,
        "alumnos": [
          {
            "matricula": "2027",
            "nombre": "Juan Pérez",
            "estatus": "Reinscrito",
            "fechaEstatus": "2026-01-15T00:00:00.000Z"
          }
        ]
      },
      "3B": {
        "total": 30,
        "reinscritos": 25,
        "bajasTransferencia": 2,
        "bajasReales": 1,
        "porReinscribir": 2,
        "porcentaje": 83.33,
        "alumnos": [...]
      }
    },
    "ultimaActualizacion": "2026-04-20T14:30:00.000Z"
  }
}
```

---

### **2. Rotación Laboral**

Obtiene métricas de rotación laboral por campus.

**URL:** `GET /api/ccm-hub/rotacion`

**Query Parameters:**
- `campus` (opcional): Nombre del campus
- `periodo` (opcional): Periodo escolar (default: `2025-2026`)

**Ejemplo:**
```bash
curl -H "x-api-key: ccm_hub_secret_key_2026_cambiar_en_produccion" \
  "http://localhost:3000/api/ccm-hub/rotacion?campus=MITRAS"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "campus": "MITRAS",
    "periodo": "2025-2026",
    "empleadosAnterior": 45,
    "empleadosActual": 42,
    "bajas": 3,
    "porcentajeRotacion": 6.67,
    "ultimaActualizacion": "2026-04-20T14:30:00.000Z",
    "nota": "Datos de ejemplo - Implementar lógica real con datos de Innovat"
  }
}
```

**⚠️ Nota:** Este endpoint actualmente retorna datos de ejemplo. Necesita implementación real con datos de empleados de Innovat.

---

## 🚀 **Uso desde CCM HUB**

### **Configuración en CCM HUB**

**Archivo:** `.env` (en proyecto CCM HUB)

```bash
VITE_REINSCRIPCION_API_URL=https://tu-app-reinscripcion.railway.app
VITE_REINSCRIPCION_API_KEY=ccm_hub_secret_key_2026_cambiar_en_produccion
```

### **Servicio JavaScript**

**Archivo:** `src/lib/reinscripcionService.js`

```javascript
const API_URL = import.meta.env.VITE_REINSCRIPCION_API_URL;
const API_KEY = import.meta.env.VITE_REINSCRIPCION_API_KEY;

export async function obtenerMetricasRI(campus, grupo = null) {
  const params = new URLSearchParams({ campus });
  if (grupo) params.append('grupo', grupo);

  const response = await fetch(
    `${API_URL}/api/ccm-hub/metrics?${params}`,
    {
      headers: { 'x-api-key': API_KEY },
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener métricas de RI');
  }

  return response.json();
}

export async function obtenerRotacion(campus) {
  const response = await fetch(
    `${API_URL}/api/ccm-hub/rotacion?campus=${campus}`,
    {
      headers: { 'x-api-key': API_KEY },
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener rotación');
  }

  return response.json();
}
```

### **Componente React**

```javascript
import { useState, useEffect } from 'react';
import { obtenerMetricasRI, obtenerRotacion } from '../lib/reinscripcionService';

export default function IndicadoresDirectivos() {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      try {
        const data = await obtenerMetricasRI('MITRAS');
        setMetricas(data.data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    cargarDatos();
  }, []);

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <h1>% Reinscripción: {metricas.porcentajeRI}%</h1>
      <p>{metricas.reinscritos} de {metricas.totalAlumnos} alumnos</p>
    </div>
  );
}
```

---

## 🧪 **Pruebas**

### **Ejecutar servidor de desarrollo:**
```bash
bun run dev
```

### **Probar endpoints:**
```bash
bun run test-api-ccm-hub.ts
```

### **Prueba manual con curl:**

**Sin API Key (debe fallar):**
```bash
curl http://localhost:3000/api/ccm-hub/metrics?campus=MITRAS
# Respuesta esperada: 401 Unauthorized
```

**Con API Key (debe funcionar):**
```bash
curl -H "x-api-key: ccm_hub_secret_key_2026_cambiar_en_produccion" \
  http://localhost:3000/api/ccm-hub/metrics?campus=MITRAS
# Respuesta esperada: JSON con métricas
```

---

## 🔒 **Seguridad**

### **En Desarrollo:**
- API Key en `.env` local
- No commitear `.env` a Git

### **En Producción:**
1. **Generar API Key segura:**
   ```bash
   openssl rand -base64 32
   ```

2. **Configurar en Railway/Render:**
   - Variables de entorno → `CCM_HUB_API_KEY`

3. **Compartir API Key con CCM HUB:**
   - Solo por canal seguro (1Password, etc.)
   - Rotar periódicamente

---

## 📈 **Roadmap**

### **Completado:**
- ✅ Endpoint de métricas de RI
- ✅ Desglose por grupo
- ✅ Cruce de ciclos 2025-2026 y 2026-2027
- ✅ Protección con API Key
- ✅ Endpoint de rotación (placeholder)

### **Pendiente:**
- ⏳ Implementar rotación laboral real
- ⏳ Agregar tablas de empleados en Prisma
- ⏳ Modificar RPA para extraer datos de empleados
- ⏳ Endpoint de métricas de Learning Walk
- ⏳ Endpoint de quejas (Open House)
- ⏳ Endpoint de evaluaciones 360

---

## 🐛 **Troubleshooting**

### **Error 401 Unauthorized**
- Verificar que el header `x-api-key` esté presente
- Verificar que el valor coincida con `CCM_HUB_API_KEY` en `.env`

### **Error 500 Internal Server Error**
- Verificar logs del servidor
- Verificar que la base de datos esté accesible
- Verificar que existan datos en las tablas

### **Datos vacíos**
- Ejecutar el RPA para sincronizar datos de Innovat
- Verificar que los datos se guardaron en la BD:
  ```sql
  SELECT COUNT(*) FROM Alumno25_26;
  SELECT COUNT(*) FROM Alumno26_27;
  ```

---

**Última actualización:** Abril 2026  
**Versión:** 1.0
