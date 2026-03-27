import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // TODO: Descomentar cuando NextAuth funcione correctamente en Vercel
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    // }
    // const userRol = (session.user as any).rol;
    // const userUnidad = (session.user as any).unidad;

    // Temporalmente permitir sin autenticación
    const userRol = 'DIRECTOR_GENERAL' as 'DIRECTOR_GENERAL' | 'ADMIN_CAMPUS';
    const userUnidad: string | undefined = undefined;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string; // '25-26' o '26-27'

    if (!file) {
      return NextResponse.json({ error: 'No se encontró ningún archivo' }, { status: 400 });
    }

    if (!tipo || (tipo !== '25-26' && tipo !== '26-27')) {
      return NextResponse.json({ error: 'Tipo de archivo inválido' }, { status: 400 });
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

    // Guardar el archivo con nombre genérico (como en localhost)
    const fileName = `${tipo}.xlsx`;
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
