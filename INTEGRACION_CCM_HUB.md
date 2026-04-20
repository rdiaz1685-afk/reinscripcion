# Integración Sistema Reinscripción → CCM HUB (Digital Hub)

---

## 📊 **SITUACIÓN ACTUAL**

### **Sistema de Reinscripción (Ya funciona)**
- ✅ Next.js + TypeScript + Prisma
- ✅ Base de datos: SQLite (local) o Turso (cloud)
- ✅ RPA con Playwright para extraer datos de Innovat
- ✅ Dashboard con métricas de RI y rotación
- ✅ Usado por administrativos

### **CCM HUB (Ya funciona)**
- ✅ React + Vite + Supabase
- ✅ Danielson + Learning Walk operativos
- ✅ Autoevaluación automatizada
- ✅ Usado por coordinadores y maestros

---

## 🎯 **OBJETIVO**

Integrar ambos sistemas para que CCM HUB muestre:
1. % Reinscripción (RI)
2. % Rotación Laboral
3. Métricas de uso de Learning Walk
4. Dashboard unificado en Looker Studio

---

## 🏗️ **ARQUITECTURA PROPUESTA**

```
┌──────────────────────────────────────────────────┐
│   SISTEMA REINSCRIPCIÓN (Existente)              │
│   - Next.js + Prisma                             │
│   - RPA Playwright → Innovat                     │
│   - SQLite/Turso                                 │
│   - Datos: RI, Rotación, Alumnos                 │
└──────────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │   OPCIÓN A: API REST  │
        │   Exponer endpoints   │
        └───────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│   CCM HUB (Digital Hub)                          │
│   - React + Supabase                             │
│   - Consume API de Reinscripción                 │
│   - Dashboard unificado                          │
│   - Danielson + LW + RI + Rotación               │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│   LOOKER STUDIO                                  │
│   - Conecta a Supabase                           │
│   - Dashboards ejecutivos                        │
│   - Reportes automáticos                         │
└──────────────────────────────────────────────────┘
```

---

## 🔧 **PLAN DE IMPLEMENTACIÓN**

### **FASE 1: Exponer API desde Sistema Reinscripción (1 semana)**

#### **1.1 Crear endpoints API en Next.js**

**Archivo:** `src/app/api/metrics/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campus = searchParams.get('campus');
  const periodo = searchParams.get('periodo'); // "2025-2026"

  try {
    // Obtener métricas de reinscripción
    const metricas = await db.snapshotMetricas.findMany({
      where: {
        unidad: campus || undefined,
        fecha: {
          gte: new Date(periodo ? `${periodo.split('-')[0]}-08-01` : '2025-08-01'),
        },
      },
      orderBy: { fecha: 'desc' },
      take: 1,
    });

    // Calcular % RI
    const ultimaMetrica = metricas[0];
    const porcentajeRI = ultimaMetrica 
      ? (ultimaMetrica.reinscritos / ultimaMetrica.total) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        campus: campus || 'Global',
        periodo: periodo || '2025-2026',
        reinscritos: ultimaMetrica?.reinscritos || 0,
        total: ultimaMetrica?.total || 0,
        porcentajeRI: porcentajeRI.toFixed(2),
        meta: ultimaMetrica?.meta || 0,
        porcentajeCumplimiento: ultimaMetrica?.porcentajeCumplimiento || 0,
        fecha: ultimaMetrica?.fecha || new Date(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error al obtener métricas' },
      { status: 500 }
    );
  }
}
```

#### **1.2 Endpoint para Rotación Laboral**

**Archivo:** `src/app/api/rotacion/route.ts`

```typescript
// Similar estructura, calculando rotación desde datos de Innovat
// Rotación = (Bajas / Total empleados) * 100
```

#### **1.3 Proteger API con API Key**

```typescript
// middleware.ts
export function middleware(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  
  if (apiKey !== process.env.API_SECRET_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
}
```

---

### **FASE 2: Consumir API desde CCM HUB (3 días)**

#### **2.1 Crear servicio en CCM HUB**

**Archivo:** `src/lib/reinscripcionService.js`

```javascript
const REINSCRIPCION_API_URL = import.meta.env.VITE_REINSCRIPCION_API_URL;
const API_KEY = import.meta.env.VITE_REINSCRIPCION_API_KEY;

export async function obtenerMetricasRI(campus, periodo) {
  const response = await fetch(
    `${REINSCRIPCION_API_URL}/api/metrics?campus=${campus}&periodo=${periodo}`,
    {
      headers: {
        'x-api-key': API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener métricas de RI');
  }

  return response.json();
}

export async function obtenerRotacionLaboral(campus, periodo) {
  const response = await fetch(
    `${REINSCRIPCION_API_URL}/api/rotacion?campus=${campus}&periodo=${periodo}`,
    {
      headers: {
        'x-api-key': API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener rotación laboral');
  }

  return response.json();
}
```

#### **2.2 Crear componente Dashboard**

**Archivo:** `src/pages/IndicadoresDirectivos.jsx`

```javascript
import { useState, useEffect } from 'react';
import { obtenerMetricasRI, obtenerRotacionLaboral } from '../lib/reinscripcionService';

export default function IndicadoresDirectivos() {
  const [metricas, setMetricas] = useState(null);
  const [rotacion, setRotacion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [riData, rotacionData] = await Promise.all([
          obtenerMetricasRI('MITRAS', '2025-2026'),
          obtenerRotacionLaboral('MITRAS', '2025-2026'),
        ]);

        setMetricas(riData.data);
        setRotacion(rotacionData.data);
      } catch (error) {
        console.error('Error cargando indicadores:', error);
      } finally {
        setLoading(false);
      }
    }

    cargarDatos();
  }, []);

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Indicadores Directivos</h1>

      {/* Card de Reinscripción */}
      <div className="bg-white p-6 rounded-lg shadow mb-4">
        <h2 className="text-lg font-semibold mb-2">% Reinscripción</h2>
        <div className="text-4xl font-bold text-blue-600">
          {metricas?.porcentajeRI}%
        </div>
        <p className="text-gray-600 mt-2">
          {metricas?.reinscritos} de {metricas?.total} alumnos
        </p>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Avance vs Meta</span>
            <span>{metricas?.porcentajeCumplimiento}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${metricas?.porcentajeCumplimiento}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card de Rotación */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">% Rotación Laboral</h2>
        <div className="text-4xl font-bold text-red-600">
          {rotacion?.porcentaje}%
        </div>
        <p className="text-gray-600 mt-2">
          {rotacion?.bajas} bajas de {rotacion?.total} empleados
        </p>
      </div>
    </div>
  );
}
```

---

### **FASE 3: Guardar datos en Supabase (Opcional - 2 días)**

Si quieres que los datos también estén en Supabase para Looker Studio:

#### **3.1 Crear tabla en Supabase**

```sql
CREATE TABLE indicadores_directivos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campus TEXT NOT NULL,
  periodo TEXT NOT NULL,
  tipo_indicador TEXT NOT NULL, -- 'reinscripcion', 'rotacion', 'learning_walk'
  valor NUMERIC NOT NULL,
  meta NUMERIC,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_indicadores_campus_periodo ON indicadores_directivos(campus, periodo, tipo_indicador);
```

#### **3.2 Sincronizar datos periódicamente**

**Archivo:** `src/lib/syncIndicadores.js`

```javascript
import { supabase } from './supabase';
import { obtenerMetricasRI, obtenerRotacionLaboral } from './reinscripcionService';

export async function sincronizarIndicadores() {
  const campuses = ['MITRAS', 'NORTE', 'CUMBRES', 'ANAHUAC', 'DOMINIO'];
  const periodo = '2025-2026';

  for (const campus of campuses) {
    try {
      // Obtener RI
      const riData = await obtenerMetricasRI(campus, periodo);
      
      await supabase.from('indicadores_directivos').insert({
        campus,
        periodo,
        tipo_indicador: 'reinscripcion',
        valor: riData.data.porcentajeRI,
        meta: riData.data.meta,
      });

      // Obtener Rotación
      const rotacionData = await obtenerRotacionLaboral(campus, periodo);
      
      await supabase.from('indicadores_directivos').insert({
        campus,
        periodo,
        tipo_indicador: 'rotacion',
        valor: rotacionData.data.porcentaje,
      });

      console.log(`✅ Sincronizado: ${campus}`);
    } catch (error) {
      console.error(`❌ Error en ${campus}:`, error);
    }
  }
}

// Ejecutar diariamente
setInterval(sincronizarIndicadores, 24 * 60 * 60 * 1000);
```

---

### **FASE 4: Looker Studio (1 día)**

1. **Conectar Looker Studio a Supabase:**
   - Data Source → PostgreSQL
   - Host: tu_proyecto.supabase.co
   - Database: postgres
   - User: postgres
   - Password: tu_password

2. **Crear dashboard con:**
   - Gráfica de línea: % RI por mes
   - Gráfica de barras: % RI por campus
   - Tarjetas: Rotación laboral
   - Tabla: Uso de Learning Walk

---

## ⚡ **ALTERNATIVA RÁPIDA (Sin API)**

Si no quieres crear API, puedes:

1. **Exportar datos del sistema de reinscripción a CSV/JSON**
2. **Importar a Supabase manualmente o con script**
3. **CCM HUB lee directamente de Supabase**

**Script de exportación:**

```typescript
// export-to-supabase.ts
import { db } from './src/lib/db';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exportarASupabase() {
  // Obtener métricas
  const metricas = await db.snapshotMetricas.findMany();

  // Insertar en Supabase
  for (const metrica of metricas) {
    await supabase.from('indicadores_directivos').upsert({
      campus: metrica.unidad,
      periodo: '2025-2026',
      tipo_indicador: 'reinscripcion',
      valor: (metrica.reinscritos / metrica.total) * 100,
      meta: metrica.meta,
      fecha: metrica.fecha,
    });
  }

  console.log('✅ Datos exportados a Supabase');
}

exportarASupabase();
```

---

## 📅 **CRONOGRAMA**

| Fase | Tarea | Tiempo | Entrega |
|------|-------|--------|---------|
| 1 | API REST en Sistema Reinscripción | 1 semana | Mayo semana 1 |
| 2 | Consumir API en CCM HUB | 3 días | Mayo semana 2 |
| 3 | Sincronizar a Supabase (opcional) | 2 días | Mayo semana 2 |
| 4 | Dashboard Looker Studio | 1 día | Mayo semana 3 |

**Total:** ~2 semanas

---

## ✅ **RECOMENDACIÓN**

### **Para Mayo 2026 (RI + Rotación):**
1. ✅ **Opción API REST** (más profesional, escalable)
2. ✅ Sincronizar a Supabase para Looker Studio
3. ✅ Dashboard en CCM HUB para coordinadores
4. ✅ Looker Studio para dirección

### **Para Junio 2026 (Danielson + LW):**
- Ya está listo, solo agregar métricas de uso

---

**¿Empezamos con la Fase 1 (API REST)?** 🚀
