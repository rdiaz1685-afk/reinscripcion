import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación y permisos
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userRol = (session.user as any).rol;
    const userUnidad = (session.user as any).unidad;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string; // '25-26' o '26-27'
    const campus = formData.get('campus') as string; // Campus específico para el archivo

    if (!file) {
      return NextResponse.json({ error: 'No se encontró ningún archivo' }, { status: 400 });
    }

    if (!tipo || (tipo !== '25-26' && tipo !== '26-27')) {
      return NextResponse.json({ error: 'Tipo de archivo inválido' }, { status: 400 });
    }

    // Validar permisos: ADMIN_CAMPUS solo puede subir archivos de su campus
    if (userRol === 'ADMIN_CAMPUS') {
      if (!campus || campus.toUpperCase() !== userUnidad?.toUpperCase()) {
        return NextResponse.json({ 
          error: `Solo puedes subir archivos de tu campus (${userUnidad})` 
        }, { status: 403 });
      }
    }

    // Validar que sea un archivo Excel
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({
        error: 'Tipo de archivo no válido. Por favor sube un archivo Excel (.xlsx o .xls)'
      }, { status: 400 });
    }

    // Convertir el archivo a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Guardar el archivo con nombre de campus para evitar sobrescribir
    // Formato: CAMPUS_25-26.xlsx o CAMPUS_26-27.xlsx
    const campusName = campus || 'GENERAL';
    const fileName = `${campusName}_${tipo}.xlsx`;
    // Ruta configurable: Vercel usa /tmp, Render usa /data/upload, Railway usa /app/upload, local usa <cwd>/upload
    const uploadDir = process.env.VERCEL ? '/tmp' : process.env.RENDER ? '/data/upload' : process.env.RAILWAY_ENVIRONMENT ? '/app/upload' : join(process.cwd(), 'upload');
    const filePath = join(uploadDir, fileName);

    // Crear el directorio si no existe
    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);

    return NextResponse.json({
      message: `Archivo ${fileName} subido correctamente`,
      fileName: fileName,
      size: file.size
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    return NextResponse.json({
      error: 'Error al subir el archivo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
