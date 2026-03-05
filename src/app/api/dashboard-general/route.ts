import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        // 1. Obtener los últimos snapshots para cada unidad (campus)
        // Usamos una query para obtener el registro más reciente por unidad
        const units = await db.snapshotMetricas.findMany({
            distinct: ['unidad'],
            orderBy: {
                fecha: 'desc'
            }
        });

        // 2. Obtener historial global (últimos 30 snapshots para la gráfica de tendencia)
        const historyGlobal = await db.snapshotMetricas.findMany({
            where: { unidad: 'Global' },
            orderBy: { fecha: 'asc' },
            take: 100 // Ajustar según necesidad
        });

        // 3. Obtener historial por campus si se requiere (para comparar)
        const campusHistory = await db.snapshotMetricas.findMany({
            where: { unidad: { not: 'Global' } },
            orderBy: { fecha: 'asc' },
        });

        // Agrupar historial por campus para gráficas comparativas
        const historyByCampus: Record<string, any[]> = {};
        campusHistory.forEach(s => {
            if (!historyByCampus[s.unidad]) historyByCampus[s.unidad] = [];
            historyByCampus[s.unidad].push({
                fecha: s.fecha,
                reinscritos: s.reinscritos,
                porcentaje: s.porcentajeCumplimiento,
                total: s.total
            });
        });

        return NextResponse.json({
            resumenActual: units.find(u => u.unidad === 'Global') || null,
            porCampus: units.filter(u => u.unidad !== 'Global'),
            historialGlobal: historyGlobal,
            historialPorCampus: historyByCampus
        });
    } catch (error) {
        console.error('Error en API Dashboard General:', error);
        return NextResponse.json({ error: 'Error al obtener datos del dashboard general' }, { status: 500 });
    }
}
