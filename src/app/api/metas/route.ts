import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener todas las metas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const unidad = searchParams.get('unidad');
    const mes = searchParams.get('mes') ? parseInt(searchParams.get('mes')!) : undefined;

    const where: any = {};
    if (unidad) where.unidadAsignada = unidad;
    if (mes) where.mes = mes;

    const metas = await db.metaReinscripcion.findMany({
      where,
      // @ts-ignore
      orderBy: [{ mes: 'desc' }, { tipo: 'asc' }, { grupo: 'asc' }]
    });

    return NextResponse.json(metas);
  } catch (error) {
    console.error('Error al obtener metas:', error);
    return NextResponse.json({ error: 'Error al obtener metas' }, { status: 500 });
  }
}

// POST - Crear o actualizar meta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tipo, unidadAsignada, grupo, mes, tipoMeta, valorMeta, creadaPorRol } = body;

    if (!tipo || valorMeta === undefined || !creadaPorRol || !mes) {
      return NextResponse.json({ error: 'Faltan campos requeridos (tipo, valorMeta, creadaPorRol, mes)' }, { status: 400 });
    }

    // Calcular meta absoluta
    let metaAbsoluta: number;
    if (tipoMeta === 'porcentaje') {
      const where: any = {};
      if (unidadAsignada) where.unidad = unidadAsignada;
      if (tipo === 'grupo' && grupo) where.grupo = grupo;

      const totalAlumnos = await db.alumnoClasificado.count({ where });
      // Si no hay alumnos clasificados aún, intentar contar de la base 25-26
      const totalBase = totalAlumnos || await db.alumno25_26.count({ where });

      metaAbsoluta = Math.round((Number(valorMeta) / 100) * (totalBase || 0));
    } else {
      metaAbsoluta = Math.round(Number(valorMeta));
    }

    const data = {
      tipo,
      unidadAsignada,
      grupo: tipo === 'grupo' ? grupo : null,
      mes: parseInt(mes),
      meta: metaAbsoluta,
      tipoMeta,
      valorMeta: Number(valorMeta),
      creadaPorRol
    };

    console.log('Guardando meta:', data);
    const mesFinal = parseInt(String(mes));

    const metaGuardada = await (db.metaReinscripcion as any).upsert({
      where: {
        meta_unique: {
          tipo,
          unidadAsignada: unidadAsignada || '',
          grupo: grupo || '',
          mes: mesFinal,
          creadaPorRol
        }
      },
      update: {
        meta: metaAbsoluta,
        tipoMeta,
        valorMeta: Number(valorMeta)
      },
      create: {
        tipo,
        unidadAsignada: unidadAsignada || '',
        grupo: grupo || '',
        mes: mesFinal,
        meta: metaAbsoluta,
        tipoMeta,
        valorMeta: Number(valorMeta),
        creadaPorRol
      }
    });

    return NextResponse.json(metaGuardada);
  } catch (error) {
    console.error('Error detallado al guardar meta:', error);
    return NextResponse.json({
      error: 'Error al guardar meta',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// DELETE - Eliminar meta
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await db.metaReinscripcion.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Meta eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar meta:', error);
    return NextResponse.json({ error: 'Error al eliminar meta' }, { status: 500 });
  }
}
