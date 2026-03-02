import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    // Primero obtener las métricas
    const baseUrl = `http://localhost:${process.env.PORT || 8080}`
const metricasRes = await fetch(`${baseUrl}/api/metricas`)
    
    if (!metricasRes.ok) {
      return NextResponse.json({ error: 'No se pudieron obtener las métricas' }, { status: 500 })
    }
    
    const metricas = await metricasRes.json()
    
    // Crear directorio temporal si no existe
    const tmpDir = path.join(process.cwd(), 'tmp')
    try {
      await fs.mkdir(tmpDir, { recursive: true })
    } catch {
      // Directorio ya existe
    }
    
    // Generar nombre de archivo único
    const timestamp = Date.now()
    const outputPath = path.join(tmpDir, `reporte_reinscripcion_${timestamp}.pdf`)
    
    // Preparar datos para el script Python
    const jsonData = JSON.stringify({
      resumen: metricas.resumen,
      porGrupo: metricas.porGrupo
    })
    
    // Ruta al script Python
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_report_pdf.py')
    
    // Ejecutar script Python
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" '${jsonData.replace(/'/g, "'\"'\"'")}' "${outputPath}"`,
      { maxBuffer: 1024 * 1024 * 10 }
    )
    
    if (stderr && !stderr.includes('PDF generado')) {
      console.error('Error en script Python:', stderr)
    }
    
    // Verificar que el archivo fue creado
    try {
      await fs.access(outputPath)
    } catch {
      return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 })
    }
    
    // Leer el archivo PDF
    const pdfBuffer = await fs.readFile(outputPath)
    
    // Eliminar archivo temporal
    await fs.unlink(outputPath).catch(() => {})
    
    // Devolver el PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Reporte_Reinscripcion_por_Grupo.pdf"',
        'Content-Length': pdfBuffer.length.toString()
      }
    })
    
  } catch (error) {
    console.error('Error al exportar PDF:', error)
    return NextResponse.json(
      { error: 'Error interno al generar el PDF' },
      { status: 500 }
    )
  }
}
