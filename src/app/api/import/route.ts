import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

function parseDate(excelDate: any): Date | null {
  if (!excelDate) return null;

  if (excelDate instanceof Date) return excelDate;

  // Si es un número (formato interno de Excel)
  if (typeof excelDate === 'number') {
    return new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  }

  // Si es un string, intentar varios formatos
  if (typeof excelDate === 'string') {
    const s = excelDate.trim();
    if (!s) return null;

    // Intentar Parse nativo
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    // Intentar formato DD/MM/YYYY o DD-MM-YYYY
    const parts = s.split(/[\/-]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);

      // Asumimos DD/MM/YYYY
      let day = p0, month = p1 - 1, year = p2;

      // Si el año es de 2 dígitos (ej: 25)
      if (year < 100) year += 2000;

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
  }

  return null;
}

function clasificarAlumno(estatus: string | null, comentario: string | null, esNuevoDesde26: boolean): string {
  const s = (estatus || '').toLowerCase().trim();
  const c = (comentario || '').toLowerCase().trim();

  if (esNuevoDesde26) {
    if (s.includes('inscrito') || s.includes('reinscrito') || s.includes('nuevo')) {
      return 'Nuevo';
    }
    return 'Candidato';
  }

  // Estrictamente 'reinscrito' para no tomar fechas genéricas de otros estatus
  if (s === 'reinscrito') {
    return 'Reinscrito';
  }

  if (s.includes('baja') || s.includes('retirado')) {
    if (c.includes('transferencia') || c.includes('plantel') || c.includes('unidad')) {
      return 'Baja Transferencia';
    }
    return 'Baja Real';
  }

  return 'Por Reinscribir';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, tipo, action, source, files } = body;

    console.log('API Import Request:', { action, tipo, fileName, source, filesCount: files?.length });

    // CASO A: Sincronización Automática (Batch)
    if (source === 'innovat-sync' && Array.isArray(files)) {
      console.log('🚀 Iniciando procesamiento batch desde Innovat-Sync...');
      let totalImported = 0;

      for (const f of files) {
        try {
          // Determinar tipo (25-26 o 26-27) basado en el nombre del archivo
          const t = f.includes('25_26') ? '25-26' : '26-27';
          const res = await realizarImportacion(f, t);
          totalImported += res.count;
          console.log(`✅ Archivo batch procesado: ${f} (${res.count} registros)`);
        } catch (err) {
          console.error(`❌ Error en archivo batch ${f}:`, err);
        }
      }

      // IMPORTANTE: Al finalizar el lote, procesar y clasificar automáticamente
      await procesarDatos();
      return NextResponse.json({
        message: 'Sincronización y procesamiento completado',
        imported: totalImported,
        action: 'auto-classified'
      });
    }

    // CASO B: Procesar datos (Unión de tablas y clasificación)
    if (action === 'procesar') {
      return await procesarDatos();
    }

    // CASO C: Reset de base de datos
    if (tipo === 'reset' || action === 'reset') {
      await db.alumnoClasificado.deleteMany({});
      await db.alumno25_26.deleteMany({});
      await db.alumno26_27.deleteMany({});
      return NextResponse.json({ message: 'Base de datos reseteada correctamente' });
    }

    // CASO D: Importación manual de archivo único
    if (!fileName) {
      return NextResponse.json({
        error: 'No se especificó el archivo',
        details: 'El servidor recibió una solicitud de importación sin nombre de archivo.'
      }, { status: 400 });
    }

    const result = await realizarImportacion(fileName, tipo);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error Crítico en Importación:', error);
    return NextResponse.json({
      error: 'Error en importación',
      details: error.message || String(error),
      stack: error.stack
    }, { status: 500 });
  }
}

/**
 * Función interna que realiza la lectura y carga de un archivo Excel a la BD
 */
async function realizarImportacion(fileName: string, tipo: string) {
  const uploadDir = process.env.RAILWAY_ENVIRONMENT ? '/app/upload' : join(process.cwd(), 'upload');
  const filePath = join(uploadDir, String(fileName));

  if (!existsSync(filePath)) {
    throw new Error(`Archivo ${fileName} no encontrado en ${filePath}`);
  }

  const fileBuffer = readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  // Buscar encabezados
  let bestHeaderIndex = -1;
  let maxMatches = 0;
  const targetTerms = ['matricula', 'unidad', 'campus', 'nombre', 'grupo', 'grado', 'estatus', 'expediente'];

  for (let i = 0; i < Math.min(data.length, 50); i++) {
    const row = data[i];
    if (!row) continue;
    let currentMatches = 0;
    const rowTerms = row.map(cell => String(cell || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    targetTerms.forEach(term => { if (rowTerms.some(rt => rt.includes(term))) currentMatches++; });
    if (currentMatches > maxMatches) {
      maxMatches = currentMatches;
      bestHeaderIndex = i;
    }
  }

  const headerIndex = maxMatches >= 2 ? bestHeaderIndex : 0;
  const headers = data[headerIndex].map(h => String(h || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  const findCol = (terms: string[]) => {
    let idx = headers.findIndex(h => h && terms.some(t => h === t.toLowerCase()));
    if (idx === -1) idx = headers.findIndex(h => h && terms.some(t => t.length > 3 && h.includes(t.toLowerCase())));
    return idx;
  };

  const colIdx = {
    unidad: findCol(['unidad', 'campus', 'plantel', 'sucursal', 'sede', 'centro']),
    matricula: findCol(['matricula', 'id', 'expediente', 'clave', 'codigo']),
    nombre: findCol(['nombre', 'alumno', 'estudiante', 'beneficiario']),
    grupo: findCol(['grupo', 'seccion', 'clase', 'maestra', 'asignacion']),
    grado: findCol(['grado', 'nivel', 'ano', 'ciclo']),
    estatus: findCol(['estatus', 'status', 'clasificacion', 'estado', 'situacion']),
    fecha: findCol(['fecha', 'date', 'momento']),
    comentario: findCol(['comentario', 'observacion', 'notas', 'detalle'])
  };

  if (colIdx.matricula === -1) {
    throw new Error('No se encontró la columna de MATRICULA en el archivo.');
  }

  const rows = data.slice(headerIndex + 1);
  let count = 0;
  const unidadesInFile = new Set<string>();

  if (tipo === '25-26') {
    for (const row of rows) {
      const u = colIdx.unidad !== -1 ? String(row[colIdx.unidad] || '').trim() : '';
      const m = colIdx.matricula !== -1 ? String(row[colIdx.matricula] || '').trim() : '';
      if (m) unidadesInFile.add(u);
    }
    if (unidadesInFile.size > 0) await db.alumno25_26.deleteMany({ where: { unidad: { in: Array.from(unidadesInFile) } } });

    for (const row of rows) {
      const matricula = colIdx.matricula !== -1 ? String(row[colIdx.matricula] || '').trim() : '';
      if (!matricula) continue;
      const studentData = {
        matricula,
        unidad: colIdx.unidad !== -1 ? String(row[colIdx.unidad] || '').trim() : '',
        grado: colIdx.grado !== -1 ? String(row[colIdx.grado] || '') : '',
        nombre: colIdx.nombre !== -1 ? String(row[colIdx.nombre] || '') : '',
        grupo: colIdx.grupo !== -1 ? String(row[colIdx.grupo] || '') : 'Sin Grupo',
      };
      await (db.alumno25_26 as any).upsert({
        where: { matricula_unidad: { matricula, unidad: studentData.unidad } },
        update: studentData, create: studentData
      });
      count++;
    }
  } else {
    for (const row of rows) {
      const u = colIdx.unidad !== -1 ? String(row[colIdx.unidad] || '').trim() : '';
      const m = colIdx.matricula !== -1 ? String(row[colIdx.matricula] || '').trim() : '';
      if (m) unidadesInFile.add(u);
    }
    if (unidadesInFile.size > 0) await db.alumno26_27.deleteMany({ where: { unidad: { in: Array.from(unidadesInFile) } } });

    for (const row of rows) {
      const matricula = colIdx.matricula !== -1 ? String(row[colIdx.matricula] || '').trim() : '';
      if (!matricula) continue;
      const studentData = {
        matricula,
        unidad: colIdx.unidad !== -1 ? String(row[colIdx.unidad] || '').trim() : '',
        grado: colIdx.grado !== -1 ? String(row[colIdx.grado] || '') : '',
        nombre: colIdx.nombre !== -1 ? String(row[colIdx.nombre] || '') : '',
        estatus: colIdx.estatus !== -1 ? String(row[colIdx.estatus] || 'Pendiente') : 'Pendiente',
        fechaEstatus: colIdx.fecha !== -1 ? parseDate(row[colIdx.fecha]) : null,
        comentario: colIdx.comentario !== -1 ? String(row[colIdx.comentario] || '') : '',
      };
      await (db.alumno26_27 as any).upsert({
        where: { matricula_unidad: { matricula, unidad: studentData.unidad } },
        update: studentData, create: studentData
      });
      count++;
    }
  }

  return { message: `Importados ${count} registros de ${fileName}`, unidades: Array.from(unidadesInFile), count };
}

async function procesarDatos() {
  const alumnos25 = await db.alumno25_26.findMany();
  const alumnos26 = await db.alumno26_27.findMany();
  const map26 = new Map(alumnos26.map(a => [`${a.matricula}_${a.unidad}`, a]));

  await db.alumnoClasificado.deleteMany({});
  const insertados: any[] = [];

  for (const a25 of alumnos25) {
    const key = `${a25.matricula}_${a25.unidad}`;
    const a26 = map26.get(key);

    const data = {
      matricula: a25.matricula,
      nombre: a25.nombre,
      grupo: a25.grupo,
      grado: a25.grado,
      unidad: a25.unidad,
      estatus: a26?.estatus || 'Sin registro',
      fechaEstatus: a26?.fechaEstatus || null,
      comentario: a26?.comentario || '',
      clasificacion: clasificarAlumno(a26?.estatus || '', a26?.comentario || '', false)
    };

    try {
      await (db.alumnoClasificado as any).upsert({
        where: { matricula_unidad: { matricula: data.matricula, unidad: data.unidad } },
        update: data,
        create: data
      });
      insertados.push(data);
    } catch (err: any) {
      console.error(`Error procesando a25 ${data.matricula}:`, err);
    }
  }

  const map25Keys = new Set(alumnos25.map(a => `${a.matricula}_${a.unidad}`));
  for (const a26 of alumnos26) {
    if (!map25Keys.has(`${a26.matricula}_${a26.unidad}`)) {
      const data = {
        matricula: a26.matricula,
        nombre: a26.nombre,
        grupo: 'Nuevo Ingreso',
        grado: a26.grado,
        unidad: a26.unidad,
        estatus: a26.estatus,
        fechaEstatus: a26.fechaEstatus,
        comentario: a26.comentario,
        clasificacion: clasificarAlumno(a26.estatus, a26.comentario, true)
      };

      try {
        await (db.alumnoClasificado as any).upsert({
          where: { matricula_unidad: { matricula: data.matricula, unidad: data.unidad } },
          update: data,
          create: data
        });
        insertados.push(data);
      } catch (err: any) {
        console.error(`Error procesando a26 ${data.matricula}:`, err);
      }
    }
  }

  return NextResponse.json({ message: 'Procesado completo', total: insertados.length });
}

export async function GET(request: NextRequest) {
  try {
    const unidad = request.nextUrl.searchParams.get('unidad');

    const normalizeText = (text: string) =>
      text?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() || "";

    if (!unidad) {
      const alumnos_25_26 = await db.alumno25_26.count();
      const alumnos_26_27 = await db.alumno26_27.count();
      const clasificados = await db.alumnoClasificado.count();
      return NextResponse.json({ alumnos_25_26, alumnos_26_27, clasificados });
    }

    // Si hay unidad, filtrar (SQLite doesn't support case/accent insensitive out of box for UTF-8)
    const normUserUnidad = normalizeText(unidad);

    const [all2526, all2627, allClas] = await Promise.all([
      db.alumno25_26.findMany({ select: { unidad: true } }),
      db.alumno26_27.findMany({ select: { unidad: true } }),
      db.alumnoClasificado.findMany({ select: { unidad: true } })
    ]);

    return NextResponse.json({
      alumnos_25_26: all2526.filter(a => normalizeText(a.unidad) === normUserUnidad).length,
      alumnos_26_27: all2627.filter(a => normalizeText(a.unidad) === normUserUnidad).length,
      clasificados: allClas.filter(a => normalizeText(a.unidad) === normUserUnidad).length
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener conteos' }, { status: 500 });
  }
}
