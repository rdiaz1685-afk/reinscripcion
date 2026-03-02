import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener todas las metas
export async function GET() {
  try {
    const metas = await db.metaReinscripcion.findMany({
      orderBy: [{ tipo: 'asc' }, { grupo: 'asc' }]
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
    const { tipo, grupo, tipoMeta, valorMeta } = body;
    
    console.log('Recibiendo solicitud de meta:', { tipo, grupo, tipoMeta, valorMeta });
    
    if (!tipo || valorMeta === undefined) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }
    
    if (tipo !== 'global' && tipo !== 'grupo') {
      return NextResponse.json({ error: 'Tipo debe ser "global" o "grupo"' }, { status: 400 });
    }
    
    if (tipo === 'grupo' && !grupo) {
      return NextResponse.json({ error: 'Grupo es requerido para metas por grupo' }, { status: 400 });
    }
    
    if (tipoMeta !== 'numero' && tipoMeta !== 'porcentaje') {
      return NextResponse.json({ error: 'tipoMeta debe ser "numero" o "porcentaje"' }, { status: 400 });
    }
    
    // Calcular meta absoluta si es porcentaje
    let metaAbsoluta: number;
    if (tipoMeta === 'porcentaje') {
      // Obtener total de alumnos
      const total = await db.alumnoClasificado.count();
      const totalGrupo = tipo === 'grupo' 
        ? await db.alumnoClasificado.count({ where: { grupo } })
        : total;
      metaAbsoluta = Math.round((Number(valorMeta) / 100) * (totalGrupo || total));
    } else {
      metaAbsoluta = Math.round(Number(valorMeta));
    }
    
    console.log('Meta calculada:', { metaAbsoluta, tipoMeta, valorMeta });
    
    // Buscar si ya existe una meta con el mismo tipo y grupo
    const grupoValue = tipo === 'global' ? null : grupo;
    const metaExistente = await db.metaReinscripcion.findFirst({
      where: {
        tipo,
        grupo: grupoValue
      }
    });
    
    let metaCreada;
    
    if (metaExistente) {
      // Actualizar
      metaCreada = await db.metaReinscripcion.update({
        where: { id: metaExistente.id },
        data: { 
          meta: metaAbsoluta,
          tipoMeta,
          valorMeta: Number(valorMeta)
        }
      });
    } else {
      // Crear nueva
      metaCreada = await db.metaReinscripcion.create({
        data: {
          tipo,
          grupo: grupoValue,
          meta: metaAbsoluta,
          tipoMeta,
          valorMeta: Number(valorMeta)
        }
      });
    }
    
    console.log('Meta guardada:', metaCreada);
    
    return NextResponse.json(metaCreada);
  } catch (error) {
    console.error('Error al guardar meta:', error);
    return NextResponse.json({ 
      error: 'Error al guardar meta',
      details: error instanceof Error ? error.message : 'Unknown error'
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
