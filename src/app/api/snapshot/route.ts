import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/snapshot
 * Guarda un snapshot mensual de las métricas actuales
 * Body: { unidad?: string, mes?: number, anio?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { unidad, mes, anio } = body;

    // Usar fecha actual si no se especifica
    const now = new Date();
    const targetMes = mes || now.getMonth() + 1; // 1-12
    const targetAnio = anio || now.getFullYear();

    const normalizeText = (text: string) =>
      text?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() || "";

    // Obtener todos los alumnos clasificados
    const allClasificados = await db.alumnoClasificado.findMany();

    // Filtrar por unidad si se especifica
    const clasificados = unidad
      ? allClasificados.filter(a => normalizeText(a.unidad) === normalizeText(unidad))
      : allClasificados;

    if (clasificados.length === 0) {
      return NextResponse.json({
        error: 'No hay datos para guardar snapshot',
        unidad: unidad || 'Global'
      }, { status: 400 });
    }

    // Calcular métricas
    const reinscritos = clasificados.filter(a => a.clasificacion === 'Reinscrito').length;
    const bajasTransferencia = clasificados.filter(a => a.clasificacion === 'Baja Transferencia').length;
    const bajasReales = clasificados.filter(a => a.clasificacion === 'Baja Real').length;
    const porReinscribir = clasificados.filter(a => a.clasificacion === 'Por Reinscribir').length;
    const nuevos = clasificados.filter(a => a.clasificacion === 'Nuevo').length;
    const totalAlumnos = clasificados.length;
    const porcentajeReinscritos = totalAlumnos > 0 ? (reinscritos / totalAlumnos) * 100 : 0;

    // Obtener meta del mes
    const metasDelMes = await db.metaReinscripcion.findMany({
      where: {
        mes: targetMes,
        ...(unidad ? { unidadAsignada: unidad } : {})
      }
    });

    const metaPrincipal = metasDelMes.find(m => m.creadaPorRol === 'DIRECTOR_GENERAL') || metasDelMes[0];
    const metaMes = metaPrincipal?.valorMeta || 0;
    const porcentajeCumplimiento = metaMes > 0 ? (porcentajeReinscritos / metaMes) * 100 : 0;

    // Guardar snapshot mensual por campus
    const snapshotMensual = await db.snapshotMensual.upsert({
      where: {
        snapshot_mensual_unique: {
          anio: targetAnio,
          mes: targetMes,
          unidad: unidad || 'Global'
        }
      },
      update: {
        totalAlumnos,
        reinscritos,
        bajasTransferencia,
        bajasReales,
        porReinscribir,
        nuevos,
        porcentajeReinscritos: Math.round(porcentajeReinscritos * 100) / 100,
        metaMes,
        porcentajeCumplimiento: Math.round(porcentajeCumplimiento * 100) / 100
      },
      create: {
        anio: targetAnio,
        mes: targetMes,
        unidad: unidad || 'Global',
        totalAlumnos,
        reinscritos,
        bajasTransferencia,
        bajasReales,
        porReinscribir,
        nuevos,
        porcentajeReinscritos: Math.round(porcentajeReinscritos * 100) / 100,
        metaMes,
        porcentajeCumplimiento: Math.round(porcentajeCumplimiento * 100) / 100
      }
    });

    // Guardar snapshot por grupo
    const gruposMap = new Map<string, any[]>();
    clasificados.forEach(alumno => {
      const grupo = alumno.grupo || 'Sin Grupo';
      if (!gruposMap.has(grupo)) {
        gruposMap.set(grupo, []);
      }
      gruposMap.get(grupo)!.push(alumno);
    });

    const snapshotsGrupo = [];
    for (const [grupo, alumnos] of gruposMap.entries()) {
      const grupoReinscritos = alumnos.filter(a => a.clasificacion === 'Reinscrito').length;
      const grupoBajasTransf = alumnos.filter(a => a.clasificacion === 'Baja Transferencia').length;
      const grupoBajasReales = alumnos.filter(a => a.clasificacion === 'Baja Real').length;
      const grupoPorReinscribir = alumnos.filter(a => a.clasificacion === 'Por Reinscribir').length;
      const grupoNuevos = alumnos.filter(a => a.clasificacion === 'Nuevo').length;
      const grupoTotal = alumnos.length;
      const grupoPorcentaje = grupoTotal > 0 ? (grupoReinscritos / grupoTotal) * 100 : 0;

      // Buscar coordinadora del grupo
      const coordinadoras = await db.coordinadora.findMany({
        where: {
          unidad: unidad || '',
          activa: true
        }
      });

      let coordinadoraNombre = null;
      for (const coord of coordinadoras) {
        const gruposCoord = coord.grupos.split(',').map(g => g.trim());
        if (gruposCoord.includes(grupo)) {
          coordinadoraNombre = coord.nombre;
          break;
        }
      }

      const snapshotGrupo = await db.snapshotGrupo.upsert({
        where: {
          snapshot_grupo_unique: {
            anio: targetAnio,
            mes: targetMes,
            unidad: unidad || 'Global',
            grupo
          }
        },
        update: {
          coordinadora: coordinadoraNombre,
          totalAlumnos: grupoTotal,
          reinscritos: grupoReinscritos,
          bajasTransferencia: grupoBajasTransf,
          bajasReales: grupoBajasReales,
          porReinscribir: grupoPorReinscribir,
          nuevos: grupoNuevos,
          porcentajeReinscritos: Math.round(grupoPorcentaje * 100) / 100
        },
        create: {
          anio: targetAnio,
          mes: targetMes,
          unidad: unidad || 'Global',
          grupo,
          coordinadora: coordinadoraNombre,
          totalAlumnos: grupoTotal,
          reinscritos: grupoReinscritos,
          bajasTransferencia: grupoBajasTransf,
          bajasReales: grupoBajasReales,
          porReinscribir: grupoPorReinscribir,
          nuevos: grupoNuevos,
          porcentajeReinscritos: Math.round(grupoPorcentaje * 100) / 100
        }
      });

      snapshotsGrupo.push(snapshotGrupo);
    }

    return NextResponse.json({
      message: 'Snapshot guardado exitosamente',
      snapshot: snapshotMensual,
      grupos: snapshotsGrupo.length,
      fecha: `${targetAnio}-${String(targetMes).padStart(2, '0')}`
    });

  } catch (error: any) {
    console.error('Error guardando snapshot:', error);
    return NextResponse.json({
      error: 'Error guardando snapshot',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/snapshot
 * Obtiene snapshots históricos
 * Query params: unidad, anio, mes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unidad = searchParams.get('unidad');
    const anio = searchParams.get('anio');
    const mes = searchParams.get('mes');

    const where: any = {};
    if (unidad) where.unidad = unidad;
    if (anio) where.anio = parseInt(anio);
    if (mes) where.mes = parseInt(mes);

    const snapshots = await db.snapshotMensual.findMany({
      where,
      orderBy: [
        { anio: 'desc' },
        { mes: 'desc' }
      ]
    });

    return NextResponse.json({
      snapshots,
      total: snapshots.length
    });

  } catch (error: any) {
    console.error('Error obteniendo snapshots:', error);
    return NextResponse.json({
      error: 'Error obteniendo snapshots',
      details: error.message
    }, { status: 500 });
  }
}
