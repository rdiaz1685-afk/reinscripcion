import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * API Endpoint para CCM HUB - Métricas de Reinscripción
 * 
 * GET /api/ccm-hub/metrics?campus=MITRAS&grupo=3A
 * 
 * Retorna:
 * - % Reinscripción por campus
 * - Desglose por grupo
 * - Cruce de ciclos 2025-2026 (grupos) con 2026-2027 (pagos)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campus = searchParams.get('campus'); // "MITRAS", "NORTE", etc.
  const grupo = searchParams.get('grupo');   // "3A", "3B", etc. (opcional)

  try {
    // 1. Obtener alumnos del ciclo 2025-2026 (BASE - con grupos definidos)
    const alumnosActuales = await db.alumno25_26.findMany({
      where: {
        unidad: campus || undefined,
        grupo: grupo || undefined,
      },
      select: {
        matricula: true,
        nombre: true,
        grupo: true,
        grado: true,
        unidad: true,
      },
    });

    // 2. Obtener alumnos del ciclo 2026-2027 (VALIDACIÓN - con estatus de pago)
    const alumnosSiguiente = await db.alumno26_27.findMany({
      where: {
        unidad: campus || undefined,
      },
      select: {
        matricula: true,
        estatus: true,
        fechaEstatus: true,
        comentario: true,
      },
    });

    // 3. Crear mapa de matrículas → estatus para búsqueda rápida
    const estatusMap = new Map(
      alumnosSiguiente.map(a => [
        a.matricula,
        {
          estatus: a.estatus,
          fechaEstatus: a.fechaEstatus,
          comentario: a.comentario,
        },
      ])
    );

    // 4. Calcular métricas por grupo
    const metricasPorGrupo: Record<
      string,
      {
        total: number;
        reinscritos: number;
        bajasTransferencia: number;
        bajasReales: number;
        porReinscribir: number;
        porcentaje: number;
        alumnos: Array<{
          matricula: string;
          nombre: string;
          estatus: string;
          fechaEstatus: Date | null;
        }>;
      }
    > = {};

    for (const alumno of alumnosActuales) {
      const grupoKey = alumno.grupo;

      // Inicializar grupo si no existe
      if (!metricasPorGrupo[grupoKey]) {
        metricasPorGrupo[grupoKey] = {
          total: 0,
          reinscritos: 0,
          bajasTransferencia: 0,
          bajasReales: 0,
          porReinscribir: 0,
          porcentaje: 0,
          alumnos: [],
        };
      }

      // Buscar estatus del alumno en el ciclo 2026-2027
      const estatusInfo = estatusMap.get(alumno.matricula);
      const estatus = estatusInfo?.estatus || 'Por Reinscribir';
      const estatusLower = estatus.toLowerCase();
      const comentarioLower = (estatusInfo?.comentario || '').toLowerCase();

      // Clasificar alumno
      let clasificacion = 'Por Reinscribir';
      if (estatusLower.includes('reinscrito')) {
        clasificacion = 'Reinscrito';
        metricasPorGrupo[grupoKey].reinscritos++;
      } else if (estatusLower.includes('baja') || estatusLower.includes('retirado')) {
        if (
          comentarioLower.includes('transferencia') ||
          comentarioLower.includes('plantel') ||
          comentarioLower.includes('unidad')
        ) {
          clasificacion = 'Baja Transferencia';
          metricasPorGrupo[grupoKey].bajasTransferencia++;
        } else {
          clasificacion = 'Baja Real';
          metricasPorGrupo[grupoKey].bajasReales++;
        }
      } else {
        metricasPorGrupo[grupoKey].porReinscribir++;
      }

      metricasPorGrupo[grupoKey].total++;
      metricasPorGrupo[grupoKey].alumnos.push({
        matricula: alumno.matricula,
        nombre: alumno.nombre,
        estatus: clasificacion,
        fechaEstatus: estatusInfo?.fechaEstatus || null,
      });
    }

    // 5. Calcular porcentajes
    for (const grupoKey in metricasPorGrupo) {
      const m = metricasPorGrupo[grupoKey];
      m.porcentaje = m.total > 0 ? (m.reinscritos / m.total) * 100 : 0;
    }

    // 6. Calcular totales del campus
    const totalCampus = Object.values(metricasPorGrupo).reduce(
      (acc, m) => ({
        total: acc.total + m.total,
        reinscritos: acc.reinscritos + m.reinscritos,
        bajasTransferencia: acc.bajasTransferencia + m.bajasTransferencia,
        bajasReales: acc.bajasReales + m.bajasReales,
        porReinscribir: acc.porReinscribir + m.porReinscribir,
      }),
      {
        total: 0,
        reinscritos: 0,
        bajasTransferencia: 0,
        bajasReales: 0,
        porReinscribir: 0,
      }
    );

    const porcentajeCampus =
      totalCampus.total > 0 ? (totalCampus.reinscritos / totalCampus.total) * 100 : 0;

    // 7. Obtener meta si existe
    const meta = await db.metaReinscripcion.findFirst({
      where: {
        unidadAsignada: campus || '',
        tipo: campus ? 'unidad' : 'global',
      },
      orderBy: { createdAt: 'desc' },
    });

    const porcentajeCumplimiento = meta
      ? (totalCampus.reinscritos / meta.meta) * 100
      : 0;

    // 8. Respuesta
    return NextResponse.json({
      success: true,
      data: {
        campus: campus || 'Global',
        periodo: '2025-2026 → 2026-2027',
        totalAlumnos: totalCampus.total,
        reinscritos: totalCampus.reinscritos,
        bajasTransferencia: totalCampus.bajasTransferencia,
        bajasReales: totalCampus.bajasReales,
        porReinscribir: totalCampus.porReinscribir,
        porcentajeRI: parseFloat(porcentajeCampus.toFixed(2)),
        meta: meta?.meta || 0,
        porcentajeCumplimiento: parseFloat(porcentajeCumplimiento.toFixed(2)),
        grupos: metricasPorGrupo,
        ultimaActualizacion: new Date(),
      },
    });
  } catch (error) {
    console.error('Error en API metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener métricas',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
