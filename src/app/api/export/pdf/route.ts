import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    // Primero obtener las métricas
    const baseUrl = process.env.RAILWAY_ENVIRONMENT
      ? `http://localhost:${process.env.PORT || 8080}`
      : `http://localhost:3000`

    const metricasRes = await fetch(`${baseUrl}/api/metricas`)

    if (!metricasRes.ok) {
      const errorText = await metricasRes.text()
      console.error('Error al obtener métricas para PDF:', errorText)
      return NextResponse.json({ error: 'No se pudieron obtener las métricas' }, { status: 500 })
    }

    const metricas = await metricasRes.json()

    // Crear directorio temporal si no existe
    const tmpDir = path.join(process.cwd(), 'tmp')
    await fs.mkdir(tmpDir, { recursive: true })

    // Generar nombre de archivo único
    const timestamp = Date.now()
    const jsonPath = path.join(tmpDir, `data_${timestamp}.json`)
    const outputPath = path.join(tmpDir, `reporte_${timestamp}.pdf`)

    // Escribir JSON a archivo para evitar problemas de escape en la consola de Windows
    const jsonData = JSON.stringify({
      resumen: metricas.resumen,
      porGrupo: metricas.porGrupo
    })
    await fs.writeFile(jsonPath, jsonData, 'utf-8')

    // Ruta al script Python
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_report_pdf.py')

    // Ejecutar script Python (usando python en vez de python3 por compatibilidad)
    try {
      const { stdout, stderr } = await execAsync(
        `python "${scriptPath}" "${jsonPath}" "${outputPath}"`,
        { maxBuffer: 1024 * 1024 * 10 }
      )

      if (stderr && !stderr.includes('PDF generado')) {
        console.error('Stderr script Python:', stderr)
      }
    } catch (execError: any) {
      console.error('Error al ejecutar script Python:', execError)
      await fs.unlink(jsonPath).catch(() => { })
      return NextResponse.json({
        error: 'Error al ejecutar el generador de PDF',
        details: execError.message
      }, { status: 500 })
    }

    // Verificar que el archivo fue creado
    try {
      await fs.access(outputPath)
    } catch {
      await fs.unlink(jsonPath).catch(() => { })
      return NextResponse.json({ error: 'Error al generar el PDF (archivo no encontrado)' }, { status: 500 })
    }

    // Leer el archivo PDF
    const pdfBuffer = await fs.readFile(outputPath)

    // Eliminar archivos temporales
    await fs.unlink(jsonPath).catch(() => { })
    await fs.unlink(outputPath).catch(() => { })

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
