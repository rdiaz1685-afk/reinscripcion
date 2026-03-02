import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filtro = searchParams.get('filtro'); // 'grupo' o null para general

    // Obtener todos los alumnos clasificados
    const alumnos = await db.alumnoClasificado.findMany();

    // Obtener todas las metas de una vez
    const todasMetas = await db.metaReinscripcion.findMany();

    // Métricas generales
    const reinscritos = alumnos.filter(a => a.clasificacion === 'Reinscrito').length;
    const bajasTransferencia = alumnos.filter(a => a.clasificacion === 'Baja Transferencia').length;
    const bajasReales = alumnos.filter(a => a.clasificacion === 'Baja Real').length;
    const porReinscribir = alumnos.filter(a => a.clasificacion === 'Por Reinscribir').length;
    const nuevos = alumnos.filter(a => a.clasificacion === 'Nuevo').length;
    const candidatos = alumnos.filter(a => a.clasificacion === 'Candidato').length;

    // Total a reinscribir = alumnos del 25-26 (excluyendo nuevos ingresos y candidatos)
    const totalAReinscribir = reinscritos + bajasTransferencia + bajasReales + porReinscribir;
    const totalClasificados = alumnos.length; // Incluye todos

    // Buscar meta global
    const metaGlobal = todasMetas.find(m => m.tipo === 'global');

    // Calcular porcentaje de cumplimiento
    let porcentajeCumplimiento = 0;
    let metaObjetivo = 0;
    let tipoMetaGlobal = 'numero';
    let valorMetaGlobal = 0;

    if (metaGlobal) {
      tipoMetaGlobal = metaGlobal.tipoMeta ?? 'numero';
      valorMetaGlobal = metaGlobal.valorMeta ?? 0;

      if (metaGlobal.tipoMeta === 'porcentaje') {
        // Si la meta es porcentaje, mostrar cuánto hemos alcanzado del porcentaje objetivo
        porcentajeCumplimiento = totalAReinscribir > 0
          ? Math.round((reinscritos / totalAReinscribir) * 100)
          : 0;
        metaObjetivo = metaGlobal.meta; // Número absoluto calculado
      } else {
        // Si la meta es número absoluto
        porcentajeCumplimiento = metaGlobal.meta > 0
          ? Math.round((reinscritos / metaGlobal.meta) * 100)
          : 0;
        metaObjetivo = metaGlobal.meta;
      }
    }

    // Métricas por grupo
    const grupos = [...new Set(alumnos.map(a => a.grupo))];
    const metricasPorGrupo = grupos.map(grupo => {
      const alumnosGrupo = alumnos.filter(a => a.grupo === grupo);
      const reinscritosGrupo = alumnosGrupo.filter(a => a.clasificacion === 'Reinscrito').length;

      // Buscar meta específica del grupo
      const metaGrupo = todasMetas.find(m => m.tipo === 'grupo' && m.grupo === grupo);

      let metaGrupoAbsoluta = metaGrupo?.meta || null;
      let porcentajeGrupo = alumnosGrupo.length > 0
        ? Math.round((reinscritosGrupo / alumnosGrupo.length) * 100)
        : 0;
      let porcentajeCumplimientoGrupo = 0;

      if (metaGrupo) {
        if (metaGrupo.tipoMeta === 'porcentaje') {
          porcentajeCumplimientoGrupo = porcentajeGrupo; // El porcentaje actual vs el porcentaje objetivo
        } else {
          porcentajeCumplimientoGrupo = metaGrupo.meta > 0
            ? Math.round((reinscritosGrupo / metaGrupo.meta) * 100)
            : 0;
        }
      }

      return {
        grupo,
        total: alumnosGrupo.length,
        reinscritos: reinscritosGrupo,
        bajasTransferencia: alumnosGrupo.filter(a => a.clasificacion === 'Baja Transferencia').length,
        bajasReales: alumnosGrupo.filter(a => a.clasificacion === 'Baja Real').length,
        porReinscribir: alumnosGrupo.filter(a => a.clasificacion === 'Por Reinscribir').length,
        nuevos: alumnosGrupo.filter(a => a.clasificacion === 'Nuevo').length,
        candidatos: alumnosGrupo.filter(a => a.clasificacion === 'Candidato').length,
        porcentaje: porcentajeGrupo,
        meta: metaGrupoAbsoluta,
        tipoMeta: metaGrupo?.tipoMeta || 'numero',
        valorMeta: metaGrupo?.valorMeta || 0,
        porcentajeCumplimiento: porcentajeCumplimientoGrupo,
      };
    }).sort((a, b) => a.grupo.localeCompare(b.grupo));

    // Timeline de reinscripciones por fecha
    const reinscritosConFecha = alumnos.filter(a =>
      a.clasificacion === 'Reinscrito' && a.fechaEstatus
    );

    const timelineMap = new Map<string, number>();
    reinscritosConFecha.forEach(alumno => {
      if (alumno.fechaEstatus) {
        const fechaStr = alumno.fechaEstatus.toISOString().split('T')[0];
        timelineMap.set(fechaStr, (timelineMap.get(fechaStr) || 0) + 1);
      }
    });

    const timeline = Array.from(timelineMap.entries())
      .map(([fecha, cantidad]) => ({ fecha, cantidad }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Calcular acumulado
    let acumulado = 0;
    const timelineAcumulado = timeline.map(t => {
      acumulado += t.cantidad;
      return { ...t, acumulado };
    });

    // Distribución por estatus original
    const estatusOriginal = alumnos.reduce((acc, alumno) => {
      acc[alumno.estatus] = (acc[alumno.estatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      resumen: {
        total: totalAReinscribir, // Total de alumnos a reinscribir (del 25-26)
        totalClasificados: totalClasificados, // Incluye todos
        reinscritos,
        bajasTransferencia,
        bajasReales,
        porReinscribir,
        nuevos,
        candidatos,
        meta: metaObjetivo,
        porcentajeCumplimiento,
        tipoMeta: tipoMetaGlobal,
        valorMeta: valorMetaGlobal,
        porcentajeActual: totalAReinscribir > 0 ? Math.round((reinscritos / totalAReinscribir) * 100) : 0,
      },
      porGrupo: metricasPorGrupo,
      timeline: timelineAcumulado,
      estatusOriginal,
      metaGlobal: metaGlobal || null,
    });
  } catch (error) {
    console.error('Error al obtener métricas:', error);
    return NextResponse.json({ error: 'Error al obtener métricas' }, { status: 500 });
  }
}
