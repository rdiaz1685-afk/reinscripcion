import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const unidad = searchParams.get('unidad');
    const mes = searchParams.get('mes') ? parseInt(searchParams.get('mes')!) : new Date().getMonth() + 1;

    // Función para normalizar texto (quitar acentos y pasar a mayúsculas)
    const normalizeText = (text: string) =>
      text?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() || "";

    // Obtener alumnos
    const todosAlumnos = await db.alumnoClasificado.findMany();

    const alumnos = unidad
      ? todosAlumnos.filter(a => normalizeText(a.unidad) === normalizeText(unidad))
      : todosAlumnos;

    // Obtener metas (usando as any para evitar bloqueos por lints de tipos desactualizados)
    const todasMetas = await (db.metaReinscripcion as any).findMany({
      where: { mes }
    });

    const reinscritos = alumnos.filter(a => a.clasificacion === 'Reinscrito').length;
    const bajasTransferencia = alumnos.filter(a => a.clasificacion === 'Baja Transferencia').length;
    const bajasReales = alumnos.filter(a => a.clasificacion === 'Baja Real').length;
    const porReinscribir = alumnos.filter(a => a.clasificacion === 'Por Reinscribir').length;
    const nuevos = alumnos.filter(a => a.clasificacion === 'Nuevo').length;
    const candidatos = alumnos.filter(a => a.clasificacion === 'Candidato').length;

    const totalAReinscribir = reinscritos + bajasTransferencia + bajasReales + porReinscribir;
    const totalClasificados = alumnos.length;

    // Buscar metas con prioridad: 
    // 1. Meta específica del campus creada por el Admin del campus
    // 2. Meta específica del campus creada por el Director General
    // 3. Meta global creada por el Director General
    const unidadNormalizada = normalizeText(unidad || "");

    console.log('Buscando metas para unidad:', unidadNormalizada, 'en mes:', mes);

    const metaCampusAdmin = todasMetas.find((m: any) =>
      m.tipo === 'unidad' &&
      normalizeText(m.unidadAsignada || "") === unidadNormalizada &&
      m.creadaPorRol === 'ADMIN_CAMPUS'
    );
    const metaCampusDG = todasMetas.find((m: any) =>
      m.tipo === 'unidad' &&
      normalizeText(m.unidadAsignada || "") === unidadNormalizada &&
      m.creadaPorRol === 'DIRECTOR_GENERAL'
    );
    const metaGlobal = todasMetas.find((m: any) =>
      m.tipo === 'global' &&
      m.creadaPorRol === 'DIRECTOR_GENERAL'
    );

    console.log('Metas encontradas:', {
      admin: !!metaCampusAdmin,
      dg: !!metaCampusDG,
      global: !!metaGlobal
    });

    // La meta "principal" para este dashboard será la del campus (Admin o DG) o la Global
    const metaPrincipal = metaCampusAdmin || metaCampusDG || metaGlobal;

    // Meta específica de DG para comparativas (siempre la de DG)
    const metaDG = metaCampusDG || metaGlobal;

    const porcentajeActual = totalAReinscribir > 0 ? Math.round((reinscritos / totalAReinscribir) * 100) : 0;

    // Restaurar métricas por grupo
    const grupos = [...new Set(alumnos.map(a => a.grupo))];
    const metricasPorGrupo = grupos.map(grupo => {
      const alumnosGrupo = alumnos.filter(a => a.grupo === grupo);
      const reinscritosGrupo = alumnosGrupo.filter(a => a.clasificacion === 'Reinscrito').length;
      const metaGrupo = todasMetas.find((m: any) => m.tipo === 'grupo' && m.grupo === grupo);

      return {
        grupo,
        total: alumnosGrupo.length,
        reinscritos: reinscritosGrupo,
        bajasTransferencia: alumnosGrupo.filter(a => a.clasificacion === 'Baja Transferencia').length,
        bajasReales: alumnosGrupo.filter(a => a.clasificacion === 'Baja Real').length,
        porReinscribir: alumnosGrupo.filter(a => a.clasificacion === 'Por Reinscribir').length,
        nuevos: alumnosGrupo.filter(a => a.clasificacion === 'Nuevo').length,
        candidatos: alumnosGrupo.filter(a => a.clasificacion === 'Candidato').length,
        porcentaje: alumnosGrupo.length > 0 ? Math.round((reinscritosGrupo / alumnosGrupo.length) * 100) : 0,
        meta: metaGrupo?.meta || 0,
        tipoMeta: metaGrupo?.tipoMeta || 'numero',
        valorMeta: metaGrupo?.valorMeta || 0,
        porcentajeCumplimiento: metaGrupo?.meta > 0 ? Math.round((reinscritosGrupo / metaGrupo.meta) * 100) : 0,
      };
    }).sort((a, b) => a.grupo.localeCompare(b.grupo));

    // Restaurar Timeline (solo Reinscritos genuinos hasta hoy)
    const hoyStr = new Date().toISOString().split('T')[0];
    const timelineMap = new Map<string, number>();

    alumnos
      .filter(a => a.clasificacion === 'Reinscrito' && a.fechaEstatus)
      .forEach(a => {
        const fecha = a.fechaEstatus!.toISOString().split('T')[0];
        // Solo descartar fechas futuras accidentales
        if (fecha <= hoyStr) {
          timelineMap.set(fecha, (timelineMap.get(fecha) || 0) + 1);
        }
      });

    const timeline = Array.from(timelineMap.entries())
      .map(([fecha, cantidad]) => ({ fecha, cantidad }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    let acumulado = 0;
    const timelineAcumulado = timeline.map(t => {
      acumulado += t.cantidad;
      return { ...t, acumulado };
    });

    return NextResponse.json({
      resumen: {
        total: totalAReinscribir,
        totalClasificados,
        reinscritos,
        bajasTransferencia,
        bajasReales,
        porReinscribir,
        nuevos,
        candidatos,
        meta: metaPrincipal?.meta || 0,
        tipoMeta: metaPrincipal?.tipoMeta || 'numero',
        valorMeta: metaPrincipal?.valorMeta || 0,
        porcentajeCumplimiento: metaPrincipal?.meta > 0 ? Math.round((reinscritos / metaPrincipal.meta) * 100) : 0,
        porcentajeActual,
        metaDirectorGeneral: metaDG?.valorMeta || 0,
        porcentajeCumplimientoDirectorGeneral: metaDG?.valorMeta > 0 ? Math.round((porcentajeActual / metaDG.valorMeta) * 100) : 0
      },
      porGrupo: metricasPorGrupo,
      timeline: timelineAcumulado,
      estatusOriginal: alumnos.reduce((acc, a) => {
        acc[a.estatus] = (acc[a.estatus] || 0) + 1;
        return acc;
      }, {} as any),
      metaGlobal: metaGlobal || null,
    });


  } catch (error) {
    console.error('Error al obtener métricas:', error);
    return NextResponse.json({ error: 'Error al obtener métricas' }, { status: 500 });
  }
}
