import { NextRequest, NextResponse } from 'next/server'
import { GET as getMetricas } from '../../metricas/route'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import fs from 'fs'

const execPromise = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener métricas de forma interna
    const metricasRes = await getMetricas(request)

    if (metricasRes.status !== 200) {
      const errorText = await metricasRes.text()
      return NextResponse.json({ error: 'No se pudieron obtener las métricas', details: errorText }, { status: 500 })
    }

    const data = await metricasRes.json()

    // 2. Preparar directorios temporales
    const tmpDir = path.join(process.cwd(), 'upload', 'pdf')
    
    if (!fs.existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true })
    }

    const timestamp = Date.now()
    const jsonPath = path.join(tmpDir, `data_${timestamp}.json`)
    const pdfPath = path.join(tmpDir, `reporte_${timestamp}.pdf`)

    // 3. Escribir JSON
    await writeFile(jsonPath, JSON.stringify(data), 'utf-8')

    // 4. Ejecutar el script nativo de node aislado (bypass de webpack)
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_report.js')
    
    try {
      await execPromise(`node "${scriptPath}" "${jsonPath}" "${pdfPath}"`)
    } catch (execError: any) {
      console.error('Error al ejecutar node nativo:', execError)
      return NextResponse.json(
        { error: 'Error interno en script de node', details: execError.message || String(execError) },
        { status: 500 }
      )
    }

    // 5. Leer el PDF generado
    const pdfBuffer = await readFile(pdfPath)

    // 6. Limpieza (no bloqueante)
    Promise.all([
      unlink(jsonPath).catch(console.error),
      unlink(pdfPath).catch(console.error)
    ])

    // 7. Retornar el PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Reporte_Reinscripcion_por_Grupo.pdf"',
        'Content-Length': pdfBuffer.length.toString()
      }
    })

  } catch (error: any) {
    console.error('Error al exportar PDF nativo aislado:', error)
    return NextResponse.json(
      { error: 'Error general al generar el PDF', details: String(error) },
      { status: 500 }
    )
  }
}
