import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * API pública para Looker Studio (histórico dinámico basado en fechas)
 * GET /api/looker?type=historico&unidad=MITRAS
 * GET /api/looker?type=coordinadoras&unidad=MITRAS&mes=11&anio=2025
 * 
 * Retorna datos en formato JSON para ser consumidos por Looker Studio
 * Usa el enfoque de histórico dinámico basado en fechas de reinscripción
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'historico';
    const unidad = searchParams.get('unidad');
    const mes = searchParams.get('mes');
    const anio = searchParams.get('anio');

    // Redirigir a la nueva API de histórico
    const params = new URLSearchParams();
    if (unidad) params.append('unidad', unidad);
    if (mes) params.append('mes', mes);
    if (anio) params.append('anio', anio);

    // Tipo 1: Histórico mensual acumulado
    if (type === 'historico') {
      params.append('tipo', 'mensual');
      const url = `/api/historico?${params.toString()}`;
      
      // Hacer request interno
      const baseUrl = request.url.split('/api/')[0];
      const response = await fetch(`${baseUrl}${url}`);
      const data = await response.json();
      
      return NextResponse.json(data);
    }

    // Tipo 2: Desglose por coordinadora
    if (type === 'coordinadoras') {
      params.append('tipo', 'coordinadoras');
      const url = `/api/historico?${params.toString()}`;
      
      const baseUrl = request.url.split('/api/')[0];
      const response = await fetch(`${baseUrl}${url}`);
      const data = await response.json();
      
      return NextResponse.json(data);
    }

    // Tipo 3: Desglose mensual (para gráficas)
    if (type === 'desglose_mensual') {
      params.append('tipo', 'mensual');
      const url = `/api/historico?${params.toString()}`;
      
      const baseUrl = request.url.split('/api/')[0];
      const response = await fetch(`${baseUrl}${url}`);
      const data = await response.json();
      
      return NextResponse.json(data);
    }

    return NextResponse.json({
      error: 'Tipo de consulta no válido',
      tipos_disponibles: ['historico', 'coordinadoras', 'desglose_mensual'],
      nota: 'Esta API ahora usa histórico dinámico basado en fechas de reinscripción'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error en API Looker:', error);
    return NextResponse.json({
      error: 'Error obteniendo datos',
      details: error.message
    }, { status: 500 });
  }
}
