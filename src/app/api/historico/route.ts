import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * API de histórico dinámico basado en fechas de reinscripción
 * GET /api/historico?unidad=MITRAS&tipo=mensual
 * GET /api/historico?unidad=MITRAS&tipo=coordinadoras&mes=11&anio=2025
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unidad = searchParams.get('unidad');
    const tipo = searchParams.get('tipo') || 'mensual';
    const mes = searchParams.get('mes');
    const anio = searchParams.get('anio') || '2025';

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
        error: 'No hay datos disponibles',
        unidad: unidad || 'Global'
      }, { status: 404 });
    }

    // Tipo 1: Histórico mensual acumulado (Nov 2025 - Jun 2026)
    if (tipo === 'mensual') {
      const mesesConfig = [
        { mes: 11, anio: 2025, nombre: 'Noviembre', meta: 20 },
        { mes: 12, anio: 2025, nombre: 'Diciembre', meta: 65 },
        { mes: 1, anio: 2026, nombre: 'Enero', meta: 60 },
        { mes: 2, anio: 2026, nombre: 'Febrero', meta: 70 },
        { mes: 3, anio: 2026, nombre: 'Marzo', meta: 80 },
        { mes: 4, anio: 2026, nombre: 'Abril', meta: 85 },
        { mes: 5, anio: 2026, nombre: 'Mayo', meta: 90 },
        { mes: 6, anio: 2026, nombre: 'Junio', meta: 95 }
      ];

      const historico = mesesConfig.map(config => {
        // Fecha límite del mes (último día)
        const fechaLimite = new Date(config.anio, config.mes, 0, 23, 59, 59);
        
        // Contar reinscritos hasta esa fecha
        const reinscritosHastaMes = clasificados.filter(a => {
          if (a.clasificacion !== 'Reinscrito') return false;
          if (!a.fechaEstatus) return false;
          
          const fechaReinscripcion = new Date(a.fechaEstatus);
          return fechaReinscripcion <= fechaLimite;
        }).length;

        const totalAlumnos = clasificados.length;
        const porcentajeReal = totalAlumnos > 0 ? (reinscritosHastaMes / totalAlumnos) * 100 : 0;
        const cumplimiento = config.meta > 0 ? (porcentajeReal / config.meta) * 100 : 0;

        return {
          fecha: `${config.anio}-${String(config.mes).padStart(2, '0')}-01`,
          anio: config.anio,
          mes: config.mes,
          mes_nombre: config.nombre,
          unidad: unidad || 'Global',
          total_alumnos: totalAlumnos,
          reinscritos_acumulados: reinscritosHastaMes,
          porcentaje_real: Math.round(porcentajeReal * 100) / 100,
          meta: config.meta,
          porcentaje_cumplimiento: Math.round(cumplimiento * 100) / 100
        };
      });

      return NextResponse.json({
        tipo: 'mensual',
        unidad: unidad || 'Global',
        data: historico,
        total: historico.length
      });
    }

    // Tipo 2: Desglose por coordinadora en un mes específico
    if (tipo === 'coordinadoras') {
      if (!mes || !anio) {
        return NextResponse.json({
          error: 'Se requieren parámetros mes y anio para tipo coordinadoras'
        }, { status: 400 });
      }

      const mesNum = parseInt(mes);
      const anioNum = parseInt(anio);
      const fechaLimite = new Date(anioNum, mesNum, 0, 23, 59, 59);

      // Agrupar por grupo
      const gruposMap = new Map<string, any[]>();
      clasificados.forEach(alumno => {
        const grupo = alumno.grupo || 'Sin Grupo';
        if (!gruposMap.has(grupo)) {
          gruposMap.set(grupo, []);
        }
        gruposMap.get(grupo)!.push(alumno);
      });

      // Obtener coordinadoras
      const coordinadoras = await db.coordinadora.findMany({
        where: {
          unidad: unidad || '',
          activa: true
        }
      });

      const coordinadorasMap = new Map<string, any>();

      for (const [grupo, alumnos] of gruposMap.entries()) {
        // Buscar coordinadora del grupo
        let coordinadoraNombre = 'Sin Asignar';
        for (const coord of coordinadoras) {
          const gruposCoord = coord.grupos.split(',').map(g => g.trim());
          if (gruposCoord.includes(grupo)) {
            coordinadoraNombre = coord.nombre;
            break;
          }
        }

        // Contar reinscritos hasta la fecha límite
        const reinscritosHastaMes = alumnos.filter(a => {
          if (a.clasificacion !== 'Reinscrito') return false;
          if (!a.fechaEstatus) return false;
          
          const fechaReinscripcion = new Date(a.fechaEstatus);
          return fechaReinscripcion <= fechaLimite;
        }).length;

        // Agregar a coordinadora
        if (!coordinadorasMap.has(coordinadoraNombre)) {
          coordinadorasMap.set(coordinadoraNombre, {
            coordinadora: coordinadoraNombre,
            unidad: unidad || 'Global',
            anio: anioNum,
            mes: mesNum,
            mes_nombre: getMesNombre(mesNum),
            total_alumnos: 0,
            reinscritos: 0,
            grupos: []
          });
        }

        const coord = coordinadorasMap.get(coordinadoraNombre)!;
        coord.total_alumnos += alumnos.length;
        coord.reinscritos += reinscritosHastaMes;
        coord.grupos.push({
          grupo,
          total: alumnos.length,
          reinscritos: reinscritosHastaMes,
          porcentaje: alumnos.length > 0 ? Math.round((reinscritosHastaMes / alumnos.length) * 10000) / 100 : 0
        });
      }

      const data = Array.from(coordinadorasMap.values()).map(coord => ({
        ...coord,
        porcentaje_reinscritos: coord.total_alumnos > 0 
          ? Math.round((coord.reinscritos / coord.total_alumnos) * 10000) / 100
          : 0
      }));

      return NextResponse.json({
        tipo: 'coordinadoras',
        unidad: unidad || 'Global',
        mes: mesNum,
        anio: anioNum,
        data,
        total: data.length
      });
    }

    // Tipo 3: Reinscritos por mes (no acumulado, solo del mes)
    if (tipo === 'por_mes') {
      const mesesConfig = [
        { mes: 11, anio: 2025, nombre: 'Noviembre' },
        { mes: 12, anio: 2025, nombre: 'Diciembre' },
        { mes: 1, anio: 2026, nombre: 'Enero' },
        { mes: 2, anio: 2026, nombre: 'Febrero' },
        { mes: 3, anio: 2026, nombre: 'Marzo' },
        { mes: 4, anio: 2026, nombre: 'Abril' },
        { mes: 5, anio: 2026, nombre: 'Mayo' },
        { mes: 6, anio: 2026, nombre: 'Junio' }
      ];

      const historico = mesesConfig.map(config => {
        // Contar reinscritos SOLO en ese mes
        const reinscritosDelMes = clasificados.filter(a => {
          if (a.clasificacion !== 'Reinscrito') return false;
          if (!a.fechaEstatus) return false;
          
          const fechaReinscripcion = new Date(a.fechaEstatus);
          return fechaReinscripcion.getMonth() + 1 === config.mes && 
                 fechaReinscripcion.getFullYear() === config.anio;
        }).length;

        return {
          fecha: `${config.anio}-${String(config.mes).padStart(2, '0')}-01`,
          anio: config.anio,
          mes: config.mes,
          mes_nombre: config.nombre,
          unidad: unidad || 'Global',
          reinscritos_del_mes: reinscritosDelMes
        };
      });

      return NextResponse.json({
        tipo: 'por_mes',
        unidad: unidad || 'Global',
        data: historico,
        total: historico.length
      });
    }

    return NextResponse.json({
      error: 'Tipo de consulta no válido',
      tipos_disponibles: ['mensual', 'coordinadoras', 'por_mes']
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error en API histórico:', error);
    return NextResponse.json({
      error: 'Error obteniendo histórico',
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
