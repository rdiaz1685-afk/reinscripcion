import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * API Endpoint para CCM HUB - Rotación Laboral
 * 
 * GET /api/ccm-hub/rotacion?campus=MITRAS
 * 
 * Retorna:
 * - % Rotación laboral
 * - Número de bajas
 * - Total de empleados
 * 
 * Nota: Este endpoint asume que tienes tablas de empleados.
 * Si no existen, necesitarás crearlas en el schema de Prisma.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campus = searchParams.get('campus');
  const periodo = searchParams.get('periodo') || '2025-2026';

  try {
    // OPCIÓN 1: Si tienes tablas de empleados
    // const empleadosAnterior = await db.empleado25_26.count({
    //   where: { unidad: campus || undefined },
    // });
    // const empleadosActual = await db.empleado26_27.count({
    //   where: { unidad: campus || undefined },
    // });

    // OPCIÓN 2: Calcular desde datos de maestros (teachers de CCM HUB)
    // Por ahora, retornar datos de ejemplo para que funcione la integración
    
    // TODO: Implementar lógica real cuando tengas datos de empleados
    // Esto es un placeholder para que el endpoint funcione

    const datosEjemplo = {
      MITRAS: { anterior: 45, actual: 42, bajas: 3 },
      NORTE: { anterior: 38, actual: 36, bajas: 2 },
      CUMBRES: { anterior: 52, actual: 50, bajas: 2 },
      ANAHUAC: { anterior: 41, actual: 39, bajas: 2 },
      DOMINIO: { anterior: 35, actual: 34, bajas: 1 },
    };

    const datos = campus && datosEjemplo[campus as keyof typeof datosEjemplo]
      ? datosEjemplo[campus as keyof typeof datosEjemplo]
      : { anterior: 211, actual: 201, bajas: 10 }; // Global

    const porcentajeRotacion = datos.anterior > 0
      ? (datos.bajas / datos.anterior) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        campus: campus || 'Global',
        periodo,
        empleadosAnterior: datos.anterior,
        empleadosActual: datos.actual,
        bajas: datos.bajas,
        porcentajeRotacion: parseFloat(porcentajeRotacion.toFixed(2)),
        ultimaActualizacion: new Date(),
        nota: 'Datos de ejemplo - Implementar lógica real con datos de Innovat',
      },
    });
  } catch (error) {
    console.error('Error en API rotacion:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al calcular rotación',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * NOTA PARA IMPLEMENTACIÓN REAL:
 * 
 * 1. Agregar al schema de Prisma:
 * 
 * model Empleado25_26 {
 *   id        String   @id @default(cuid())
 *   matricula String
 *   nombre    String
 *   unidad    String
 *   puesto    String
 *   createdAt DateTime @default(now())
 *   @@unique([matricula, unidad])
 * }
 * 
 * model Empleado26_27 {
 *   id        String   @id @default(cuid())
 *   matricula String
 *   nombre    String
 *   unidad    String
 *   puesto    String
 *   estatus   String   // Activo, Baja
 *   createdAt DateTime @default(now())
 *   @@unique([matricula, unidad])
 * }
 * 
 * 2. Modificar el RPA para extraer datos de empleados de Innovat
 * 
 * 3. Calcular rotación:
 *    - Empleados que estaban en 25-26 pero NO en 26-27 = Bajas
 *    - Rotación = (Bajas / Total 25-26) * 100
 */
