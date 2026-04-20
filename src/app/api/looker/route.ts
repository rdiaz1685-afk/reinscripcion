import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * API pública para Looker Studio
 * GET /api/looker?type=historico&unidad=MITRAS
 * GET /api/looker?type=coordinadoras&unidad=MITRAS&mes=4&anio=2026
 * 
 * Retorna datos en formato JSON para ser consumidos por Looker Studio
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'historico';
    const unidad = searchParams.get('unidad');
    const mes = searchParams.get('mes');
    const anio = searchParams.get('anio');

    // Tipo 1: Histórico mensual por campus
    if (type === 'historico') {
      const where: any = {};
      if (unidad) where.unidad = unidad;
      if (anio) where.anio = parseInt(anio);

      const snapshots = await db.snapshotMensual.findMany({
        where,
        orderBy: [
          { anio: 'asc' },
          { mes: 'asc' }
        ]
      });

      // Formato para Looker Studio
      const data = snapshots.map(s => ({
        fecha: `${s.anio}-${String(s.mes).padStart(2, '0')}-01`,
        anio: s.anio,
        mes: s.mes,
        mes_nombre: getMesNombre(s.mes),
        unidad: s.unidad,
        total_alumnos: s.totalAlumnos,
        reinscritos: s.reinscritos,
        bajas_transferencia: s.bajasTransferencia,
        bajas_reales: s.bajasReales,
        por_reinscribir: s.porReinscribir,
        nuevos: s.nuevos,
        porcentaje_reinscritos: s.porcentajeReinscritos,
        meta_mes: s.metaMes,
        porcentaje_cumplimiento: s.porcentajeCumplimiento
      }));

      return NextResponse.json({
        type: 'historico',
        data,
        total: data.length
      });
    }

    // Tipo 2: Desglose por coordinadora
    if (type === 'coordinadoras') {
      const where: any = {};
      if (unidad) where.unidad = unidad;
      if (anio) where.anio = parseInt(anio);
      if (mes) where.mes = parseInt(mes);

      const snapshotsGrupo = await db.snapshotGrupo.findMany({
        where,
        orderBy: [
          { anio: 'desc' },
          { mes: 'desc' },
          { grupo: 'asc' }
        ]
      });

      // Agrupar por coordinadora
      const coordinadorasMap = new Map<string, any>();

      for (const snapshot of snapshotsGrupo) {
        const coordNombre = snapshot.coordinadora || 'Sin Asignar';
        
        if (!coordinadorasMap.has(coordNombre)) {
          coordinadorasMap.set(coordNombre, {
            coordinadora: coordNombre,
            unidad: snapshot.unidad,
            anio: snapshot.anio,
            mes: snapshot.mes,
            mes_nombre: getMesNombre(snapshot.mes),
            total_alumnos: 0,
            reinscritos: 0,
            bajas_transferencia: 0,
            bajas_reales: 0,
            por_reinscribir: 0,
            nuevos: 0,
            grupos: []
          });
        }

        const coord = coordinadorasMap.get(coordNombre)!;
        coord.total_alumnos += snapshot.totalAlumnos;
        coord.reinscritos += snapshot.reinscritos;
        coord.bajas_transferencia += snapshot.bajasTransferencia;
        coord.bajas_reales += snapshot.bajasReales;
        coord.por_reinscribir += snapshot.porReinscribir;
        coord.nuevos += snapshot.nuevos;
        coord.grupos.push({
          grupo: snapshot.grupo,
          total: snapshot.totalAlumnos,
          reinscritos: snapshot.reinscritos,
          porcentaje: snapshot.porcentajeReinscritos
        });
      }

      const data = Array.from(coordinadorasMap.values()).map(coord => ({
        ...coord,
        porcentaje_reinscritos: coord.total_alumnos > 0 
          ? Math.round((coord.reinscritos / coord.total_alumnos) * 10000) / 100
          : 0
      }));

      return NextResponse.json({
        type: 'coordinadoras',
        data,
        total: data.length
      });
    }

    // Tipo 3: Desglose mensual detallado (para gráficas)
    if (type === 'desglose_mensual') {
      const where: any = {};
      if (unidad) where.unidad = unidad;
      if (anio) where.anio = parseInt(anio);

      const snapshots = await db.snapshotMensual.findMany({
        where,
        orderBy: [
          { anio: 'asc' },
          { mes: 'asc' }
        ]
      });

      // Metas por mes (configurables)
      const metasPorMes = {
        11: 20,  // Noviembre
        12: 65,  // Diciembre
        1: 60,   // Enero
        2: 70,   // Febrero
        3: 80,   // Marzo
        4: 85,   // Abril
        5: 90,   // Mayo
        6: 95    // Junio
      };

      const data = snapshots.map(s => ({
        fecha: `${s.anio}-${String(s.mes).padStart(2, '0')}-01`,
        anio: s.anio,
        mes: s.mes,
        mes_nombre: getMesNombre(s.mes),
        unidad: s.unidad,
        porcentaje_real: s.porcentajeReinscritos,
        meta: metasPorMes[s.mes as keyof typeof metasPorMes] || s.metaMes,
        cumplimiento: s.porcentajeCumplimiento
      }));

      return NextResponse.json({
        type: 'desglose_mensual',
        data,
        total: data.length
      });
    }

    return NextResponse.json({
      error: 'Tipo de consulta no válido',
      tipos_disponibles: ['historico', 'coordinadoras', 'desglose_mensual']
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error en API Looker:', error);
    return NextResponse.json({
      error: 'Error obteniendo datos',
      details: error.message
    }, { status: 500 });
  }
}

function getMesNombre(mes: number): string {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return meses[mes - 1] || 'Desconocido';
}
