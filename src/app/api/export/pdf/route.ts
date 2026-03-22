import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    // Primero obtener las métricas usando el protocol y host de la petición original
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    const metricasRes = await fetch(`${baseUrl}/api/metricas`)

    if (!metricasRes.ok) {
      const errorText = await metricasRes.text()
      console.error(`Error al obtener métricas para PDF de ${baseUrl}:`, errorText)
      return NextResponse.json({ error: 'No se pudieron obtener las métricas', details: errorText }, { status: 500 })
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

    // Ejecutar script Python: intenta 'python3' primero (estándar en Linux/Render Docker)
    try {
      // Usa cross-platform 'python3' o 'python'
      const pythonCmd = process.env.NODE_ENV === 'production' ? 'python3' : 'python'
      const { stdout, stderr } = await execAsync(
        `${pythonCmd} "${scriptPath}" "${jsonPath}" "${outputPath}"`,
        { maxBuffer: 1024 * 1024 * 10 }
      )

      if (stderr && !stderr.includes('PDF generado')) {
        console.error('Stderr script Python:', stderr)
      }
    } catch (execError: any) {
      console.error('Error al ejecutar script Python:', execError)
      await fs.unlink(jsonPath).catch(() => { })
      
      // Intenta con "python" regular como fallback por si acaso
      try {
        await execAsync(`python "${scriptPath}" "${jsonPath}" "${outputPath}"`, { maxBuffer: 1024 * 1024 * 10 })
      } catch (fallbackError: any) {
        console.error('Error Fallback script Python:', fallbackError)
        return NextResponse.json({
          error: 'Error al ejecutar el generador de PDF (Python no encontrado o error en script)',
          details: execError.message || String(execError),
          fallback: fallbackError.message
        }, { status: 500 })
      }
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
