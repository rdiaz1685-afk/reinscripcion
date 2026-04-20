# Estrategia Optimizada: Reinscripción → CCM HUB

---

## 🎯 **FLUJO ACTUAL (Correcto)**

```
1. RPA extrae datos de Innovat → JSON en memoria
2. Guarda directo en SQLite/Turso (sin Excel intermedio)
3. Cruce de ciclos:
   - 2025-2026 (actual) → Grupos definidos
   - 2026-2027 (siguiente) → Pagos de RI
4. Clasificación por grupo
5. Dashboard para administrativos
```

**✅ Ventajas:**
- Sin archivos Excel (ahorra storage)
- JSON más rápido de procesar
- Datos en tiempo real

---

## 🚀 **OPTIMIZACIÓN PROPUESTA**

### **1. Caché de JSON en memoria (Sin guardar archivos)**

Modificar el RPA para NO guardar archivos temporales:

```typescript
// innovat-agent.ts - Versión optimizada

async function descargarYProcesarDirecto(
    page: Page,
    campus: string,
    ciclo: string,
    onStep?: SyncCallback
): Promise<any[]> {
    // Interceptar respuesta de red
    const excelBuffer = await page.evaluate(async () => {
        const response = await fetch('/ruta/generar-excel');
        return await response.arrayBuffer();
    });

    // Convertir Excel a JSON en memoria (sin guardar archivo)
    const workbook = XLSX.read(Buffer.from(excelBuffer), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    // Procesar y guardar directo en BD
    await procesarYGuardarDatos(jsonData, campus, ciclo, onStep);

    return jsonData; // Retornar para uso inmediato
}
```

**Beneficio:** Cero archivos temporales, todo en RAM.

---

### **2. API Endpoint para CCM HUB**

Crear endpoint que exponga métricas calculadas:

**Archivo:** `src/app/api/ccm-hub/metrics/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campus = searchParams.get('campus'); // "MITRAS"
  const grupo = searchParams.get('grupo');   // "3A" (opcional)

  try {
    // Obtener alumnos del ciclo actual (2025-2026) con sus grupos
    const alumnosActuales = await db.alumno25_26.findMany({
      where: {
        unidad: campus || undefined,
        grupo: grupo || undefined,
      },
    });

    // Obtener alumnos del ciclo siguiente (2026-2027) con estatus de pago
    const alumnosSiguiente = await db.alumno26_27.findMany({
      where: {
        unidad: campus || undefined,
      },
    });

    // Crear mapa de matrículas → estatus
    const estatusMap = new Map(
      alumnosSiguiente.map(a => [a.matricula, a.estatus])
    );

    // Calcular métricas por grupo
    const metricasPorGrupo: Record<string, {
      total: number;
      reinscritos: number;
      porcentaje: number;
      alumnos: any[];
    }> = {};

    for (const alumno of alumnosActuales) {
      const grupo = alumno.grupo;
      
      if (!metricasPorGrupo[grupo]) {
        metricasPorGrupo[grupo] = {
          total: 0,
          reinscritos: 0,
          porcentaje: 0,
          alumnos: [],
        };
      }

      const estatus = estatusMap.get(alumno.matricula) || 'Por Reinscribir';
      const esReinscrito = estatus.toLowerCase().includes('reinscrito');

      metricasPorGrupo[grupo].total++;
      if (esReinscrito) metricasPorGrupo[grupo].reinscritos++;
      
      metricasPorGrupo[grupo].alumnos.push({
        matricula: alumno.matricula,
        nombre: alumno.nombre,
        estatus,
      });
    }

    // Calcular porcentajes
    for (const grupo in metricasPorGrupo) {
      const m = metricasPorGrupo[grupo];
      m.porcentaje = m.total > 0 ? (m.reinscritos / m.total) * 100 : 0;
    }

    // Calcular totales del campus
    const totalCampus = Object.values(metricasPorGrupo).reduce(
      (acc, m) => ({
        total: acc.total + m.total,
        reinscritos: acc.reinscritos + m.reinscritos,
      }),
      { total: 0, reinscritos: 0 }
    );

    const porcentajeCampus = totalCampus.total > 0
      ? (totalCampus.reinscritos / totalCampus.total) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        campus: campus || 'Todos',
        periodo: '2025-2026',
        totalAlumnos: totalCampus.total,
        reinscritos: totalCampus.reinscritos,
        porcentajeRI: porcentajeCampus.toFixed(2),
        grupos: metricasPorGrupo,
        ultimaActualizacion: new Date(),
      },
    });
  } catch (error) {
    console.error('Error en API metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener métricas' },
      { status: 500 }
    );
  }
}
```

---

### **3. Endpoint para Rotación Laboral**

**Archivo:** `src/app/api/ccm-hub/rotacion/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campus = searchParams.get('campus');
  const periodo = searchParams.get('periodo') || '2025-2026';

  try {
    // Obtener empleados del ciclo anterior
    const empleadosAnterior = await db.empleados25_26.count({
      where: { unidad: campus || undefined },
    });

    // Obtener empleados del ciclo actual
    const empleadosActual = await db.empleados26_27.count({
      where: { unidad: campus || undefined },
    });

    // Calcular bajas
    const bajas = empleadosAnterior - empleadosActual;
    const porcentajeRotacion = empleadosAnterior > 0
      ? (bajas / empleadosAnterior) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        campus: campus || 'Todos',
        periodo,
        empleadosAnterior,
        empleadosActual,
        bajas,
        porcentajeRotacion: porcentajeRotacion.toFixed(2),
        ultimaActualizacion: new Date(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error al calcular rotación' },
      { status: 500 }
    );
  }
}
```

**Nota:** Necesitarás agregar tablas `empleados25_26` y `empleados26_27` en el schema de Prisma si aún no existen.

---

### **4. Proteger API con API Key**

**Archivo:** `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Solo proteger rutas /api/ccm-hub/*
  if (request.nextUrl.pathname.startsWith('/api/ccm-hub')) {
    const apiKey = request.headers.get('x-api-key');
    const validKey = process.env.CCM_HUB_API_KEY;

    if (!apiKey || apiKey !== validKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/ccm-hub/:path*',
};
```

**Archivo:** `.env`

```bash
CCM_HUB_API_KEY=tu_clave_secreta_aqui_12345
```

---

### **5. Consumir desde CCM HUB**

**Archivo:** `src/lib/reinscripcionService.js` (en CCM HUB)

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

**Archivo:** `.env` (en CCM HUB)

```bash
VITE_REINSCRIPCION_API_URL=https://tu-app-reinscripcion.railway.app
VITE_REINSCRIPCION_API_KEY=tu_clave_secreta_aqui_12345
```

---

### **6. Componente Dashboard en CCM HUB**

**Archivo:** `src/pages/IndicadoresDirectivos.jsx`

```javascript
import { useState, useEffect } from 'react';
import { obtenerMetricasRI, obtenerRotacion } from '../lib/reinscripcionService';

export default function IndicadoresDirectivos() {
  const [campus, setCampus] = useState('MITRAS');
  const [metricas, setMetricas] = useState(null);
  const [rotacion, setRotacion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, [campus]);

  async function cargarDatos() {
    setLoading(true);
    try {
      const [riData, rotacionData] = await Promise.all([
        obtenerMetricasRI(campus),
        obtenerRotacion(campus),
      ]);

      setMetricas(riData.data);
      setRotacion(rotacionData.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Indicadores Directivos</h1>
        
        {/* Selector de Campus */}
        <select
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="MITRAS">Mitras</option>
          <option value="NORTE">Norte</option>
          <option value="CUMBRES">Cumbres</option>
          <option value="ANAHUAC">Anáhuac</option>
          <option value="DOMINIO">Dominio</option>
        </select>
      </div>

      {/* Grid de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Card: % Reinscripción */}
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            % Reinscripción
          </h2>
          <div className="text-5xl font-bold text-blue-600 mb-2">
            {metricas?.porcentajeRI}%
          </div>
          <p className="text-gray-600">
            {metricas?.reinscritos} de {metricas?.totalAlumnos} alumnos
          </p>
          
          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${metricas?.porcentajeRI}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card: % Rotación */}
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-red-500">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            % Rotación Laboral
          </h2>
          <div className="text-5xl font-bold text-red-600 mb-2">
            {rotacion?.porcentajeRotacion}%
          </div>
          <p className="text-gray-600">
            {rotacion?.bajas} bajas de {rotacion?.empleadosAnterior} empleados
          </p>
        </div>
      </div>

      {/* Tabla por Grupos */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Avance por Grupo</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Grupo</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Reinscritos</th>
                <th className="px-4 py-3 text-right">% RI</th>
                <th className="px-4 py-3">Progreso</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metricas?.grupos || {}).map(([grupo, data]) => (
                <tr key={grupo} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{grupo}</td>
                  <td className="px-4 py-3 text-right">{data.total}</td>
                  <td className="px-4 py-3 text-right">{data.reinscritos}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {data.porcentaje.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${data.porcentaje}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Última actualización */}
      <p className="text-sm text-gray-500 mt-4 text-center">
        Última actualización: {new Date(metricas?.ultimaActualizacion).toLocaleString('es-MX')}
      </p>
    </div>
  );
}
```

---

## 📊 **VENTAJAS DE ESTA ESTRATEGIA:**

1. ✅ **Sin archivos temporales** - Todo en memoria/BD
2. ✅ **API REST profesional** - Escalable y mantenible
3. ✅ **Datos en tiempo real** - Siempre actualizados
4. ✅ **Métricas por grupo** - Granularidad necesaria
5. ✅ **Seguro** - API Key para proteger endpoints
6. ✅ **Rápido** - JSON directo, sin conversiones

---

## 🎯 **CRONOGRAMA:**

| Tarea | Tiempo | Responsable |
|-------|--------|-------------|
| Crear endpoints API | 2 días | Tú + Windsurf |
| Proteger con API Key | 1 hora | Tú + Windsurf |
| Servicio en CCM HUB | 1 día | Tú + Windsurf |
| Dashboard componente | 2 días | Tú + Windsurf |
| Pruebas e integración | 1 día | Tú |

**Total:** ~1 semana

---

## ✅ **SIGUIENTE PASO:**

¿Empezamos creando los endpoints API en el sistema de reinscripción? 🚀
