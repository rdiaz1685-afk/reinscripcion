import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Función para parsear fecha de Excel
function parseDate(dateValue: any): Date | null {
  if (!dateValue) return null
  
  // Si ya es un objeto Date
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue
  }
  
  // Si es un número (serial de Excel)
  if (typeof dateValue === 'number') {
    // Excel serial date: días desde 1/1/1900 (con ajuste por bug de 1900)
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
    return isNaN(date.getTime()) ? null : date
  }
  
  // Si es string en formato DD/MM/YYYY o DD-MM-YYYY
  const dateStr = dateValue.toString()
  
  // Formato DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const day = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const year = parseInt(parts[2])
      const date = new Date(year, month, day)
      return isNaN(date.getTime()) ? null : date
    }
  }
  
  // Formato DD-MM-YYYY
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const day = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const year = parseInt(parts[2])
      const date = new Date(year, month, day)
      return isNaN(date.getTime()) ? null : date
    }
  }
  
  return null
}

// Clasificar alumno según estatus y comentario
function clasificarAlumno(
  estatus: string,
  comentario: string | null,
  esNuevo: boolean
): string {
  const estatusLower = estatus?.toLowerCase() || ''
  const comentarioLower = comentario?.toLowerCase() || ''
  
  if (estatusLower === 'reinscrito') return 'Reinscrito'
  
  // Inscrito = Nuevo ingreso confirmado con pago
  if (estatusLower === 'inscrito') return 'Nuevo'
  
  // Proceso = Candidato, aún sin pago confirmado
  if (estatusLower === 'proceso') return 'Candidato'
  
  if (estatusLower === 'baja') {
    if (comentarioLower.includes('transferencia')) {
      return 'Baja Transferencia'
    }
    if (comentarioLower.includes('correo')) {
      return 'Baja Real'
    }
    return 'Baja Real'
  }
  
  if (estatusLower === 'pendiente') return 'Por Reinscribir'
  
  // Para alumnos que no estaban en 25-26 pero tienen otro estatus
  if (esNuevo) return 'Nuevo'
  
  return 'Por Reinscribir'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tipo } = body // '25-26' o '26-27' o 'procesar'
    
    if (tipo === 'procesar') {
      return await procesarDatos()
    }
    
    const fileName = tipo === '25-26' ? '25-26.xlsx' : '26-27.xlsx'
    // Ruta configurable: Railway usa /app/upload, local usa /home/z/my-project/upload
    const uploadDir = process.env.RAILWAY_ENVIRONMENT ? '/app/upload' : join(process.cwd(), 'upload')
    const filePath = join(uploadDir, fileName)
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: `Archivo ${fileName} no encontrado en ${filePath}` }, { status: 404 })
    }
    
    // Leer el archivo como buffer
    const fileBuffer = readFileSync(filePath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | null)[][]
    
    // Saltar las primeras 5 filas (encabezados)
    const rows = data.slice(5)
    
    console.log('=== Importando archivo:', fileName)
    console.log('Total filas:', data.length)
    console.log('Filas de datos:', rows.length)
    
    // Debug: mostrar contenido de las primeras filas
    if (rows.length > 0) {
      console.log('Primera fila completa:', JSON.stringify(rows[0]))
      console.log('Columna F (fecha) primera fila:', rows[0][5], '| Tipo:', typeof rows[0][5])
    }
    
    if (tipo === '25-26') {
      // Limpiar tabla antes de importar
      await db.alumno25_26.deleteMany({})
      
      let count = 0
      for (const row of rows) {
        if (!row[2]) continue // Sin matrícula
        
        await db.alumno25_26.create({
          data: {
            matricula: String(row[2] || ''),
            unidad: String(row[0] || ''),
            grado: String(row[1] || ''),
            nombre: String(row[3] || ''),
            grupo: String(row[4] || ''),
          }
        })
        count++
      }
      
      return NextResponse.json({ 
        message: `Datos 25-26 importados correctamente (${count} registros)`,
        count 
      })
    } else {
      // Limpiar tabla antes de importar
      await db.alumno26_27.deleteMany({})
      
      let count = 0
      let fechaEstatusCount = 0
      let fechasEncontradas: Record<string, number> = {}
      
      for (const row of rows) {
        if (!row[2]) continue // Sin matrícula
        
        // Debug: mostrar contenido de las primeras 3 filas
        if (count < 3) {
          console.log(`Fila ${count}:`, JSON.stringify(row))
          console.log(`  Columna F (fecha):`, row[5], '| Tipo:', typeof row[5])
        }
        
        // Parsear fecha
        const fechaEstatus = parseDate(row[5])
        
        if (fechaEstatus) {
          fechaEstatusCount++
          const fechaStr = fechaEstatus.toISOString().split('T')[0]
          fechasEncontradas[fechaStr] = (fechasEncontradas[fechaStr] || 0) + 1
        }
        
        await db.alumno26_27.create({
          data: {
            matricula: String(row[2] || ''),
            unidad: String(row[0] || ''),
            grado: String(row[1] || ''),
            nombre: String(row[3] || ''),
            estatus: String(row[4] || ''),
            fechaEstatus: fechaEstatus,
            comentario: row[6] ? String(row[6]) : null,
          }
        })
        count++
      }
      
      // Resumen de importación 26-27
      console.log('=== Resumen importación 26-27 ===')
      console.log('Total registros:', count)
      console.log('Registros con fecha:', fechaEstatusCount)
      console.log('Fechas encontradas:', Object.keys(fechasEncontradas).length)
      console.log('Distribución de fechas:', fechasEncontradas)
      
      return NextResponse.json({ 
        message: `Datos 26-27 importados correctamente (${count} registros, ${fechaEstatusCount} con fecha)`,
        count,
        conFecha: fechaEstatusCount,
        fechas: fechasEncontradas
      })
    }
  } catch (error) {
    console.error('Error en importación:', error)
    return NextResponse.json({ 
      error: 'Error al procesar la importación',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function procesarDatos() {
  try {
    // Obtener todos los alumnos de ambos ciclos
    const alumnos25_26 = await db.alumno25_26.findMany()
    const alumnos26_27 = await db.alumno26_27.findMany()
    
    // Crear mapas por matrícula
    const map25_26 = new Map(alumnos25_26.map(a => [a.matricula, a]))
    const map26_27 = new Map(alumnos26_27.map(a => [a.matricula, a]))
    
    // Limpiar tabla de clasificados
    await db.alumnoClasificado.deleteMany({})
    
    // Procesar alumnos del 25-26 (base)
    for (const alumno of alumnos25_26) {
      const alumno26 = map26_27.get(alumno.matricula)
      
      if (alumno26) {
        const clasificacion = clasificarAlumno(
          alumno26.estatus,
          alumno26.comentario,
          false
        )
        
        await db.alumnoClasificado.create({
          data: {
            matricula: alumno.matricula,
            nombre: alumno.nombre,
            grupo: alumno.grupo,
            grado: alumno.grado,
            unidad: alumno.unidad,
            estatus: alumno26.estatus,
            fechaEstatus: alumno26.fechaEstatus,
            comentario: alumno26.comentario,
            clasificacion: clasificacion,
          }
        })
      } else {
        // Alumno del 25-26 que no aparece en 26-27
        await db.alumnoClasificado.create({
          data: {
            matricula: alumno.matricula,
            nombre: alumno.nombre,
            grupo: alumno.grupo,
            grado: alumno.grado,
            unidad: alumno.unidad,
            estatus: 'Sin registro',
            clasificacion: 'Por Reinscribir',
          }
        })
      }
    }
    
    // Procesar alumnos nuevos del 26-27 (no estaban en 25-26)
    for (const alumno of alumnos26_27) {
      if (!map25_26.has(alumno.matricula)) {
        const clasificacion = clasificarAlumno(
          alumno.estatus,
          alumno.comentario,
          true
        )
        
        await db.alumnoClasificado.create({
          data: {
            matricula: alumno.matricula,
            nombre: alumno.nombre,
            grupo: alumno.grado || 'N/A',
            grado: alumno.grado,
            unidad: alumno.unidad,
            estatus: alumno.estatus,
            fechaEstatus: alumno.fechaEstatus,
            comentario: alumno.comentario,
            clasificacion: clasificacion,
          }
        })
      }
    }
    
    return NextResponse.json({ 
      message: 'Datos procesados y clasificados correctamente',
      total: await db.alumnoClasificado.count()
    })
  } catch (error) {
    console.error('Error en procesamiento:', error)
    return NextResponse.json({ 
      error: 'Error al procesar los datos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const count25_26 = await db.alumno25_26.count()
    const count26_27 = await db.alumno26_27.count()
    const countClasificados = await db.alumnoClasificado.count()
    
    return NextResponse.json({
      alumnos_25_26: count25_26,
      alumnos_26_27: count26_27,
      clasificados: countClasificados,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}
