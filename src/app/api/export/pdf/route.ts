import { NextRequest, NextResponse } from 'next/server'
import { GET as getMetricas } from '../../metricas/route'
import PDFDocument from 'pdfkit'

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener métricas de forma interna
    const metricasRes = await getMetricas(request)

    if (metricasRes.status !== 200) {
      const errorText = await metricasRes.text()
      return NextResponse.json({ error: 'No se pudieron obtener las métricas', details: errorText }, { status: 500 })
    }

    const data = await metricasRes.json()

    // 2. Generar PDF directamente con pdfkit
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    // 3. Contenido del PDF
    doc.fontSize(20).text('Reporte de Reinscripción por Grupo', { align: 'center' })
    doc.moveDown()
    doc.fontSize(12).text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, { align: 'right' })
    doc.moveDown(2)

    // Información general
    if (data.unidad) {
      doc.fontSize(14).text(`Campus: ${data.unidad}`, { underline: true })
      doc.moveDown()
    }

    // Resumen de métricas
    doc.fontSize(12).text('Resumen General:', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(10)
    doc.text(`Total Alumnos 25-26: ${data.total25_26 || 0}`)
    doc.text(`Total Alumnos 26-27: ${data.total26_27 || 0}`)
    doc.text(`Total Clasificados: ${data.totalClasificados || 0}`)
    doc.moveDown(2)

    // Tabla de grupos
    if (data.porGrupo && data.porGrupo.length > 0) {
      doc.fontSize(12).text('Detalle por Grupo:', { underline: true })
      doc.moveDown(0.5)
      
      // Encabezados
      const startY = doc.y
      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Grupo', 50, startY, { width: 100, continued: true })
      doc.text('Pendientes', 150, startY, { width: 80, continued: true })
      doc.text('Nuevos', 230, startY, { width: 80, continued: true })
      doc.text('Total', 310, startY, { width: 80, continued: true })
      doc.text('Avance', 390, startY, { width: 80 })
      
      doc.moveDown(0.5)
      doc.font('Helvetica')

      // Datos
      data.porGrupo.forEach((grupo: any) => {
        const y = doc.y
        if (y > 700) {
          doc.addPage()
        }
        
        doc.text(grupo.grupo || 'Sin Grupo', 50, doc.y, { width: 100, continued: true })
        doc.text(String(grupo.pendientes || 0), 150, doc.y, { width: 80, continued: true })
        doc.text(String(grupo.nuevos || 0), 230, doc.y, { width: 80, continued: true })
        doc.text(String(grupo.total || 0), 310, doc.y, { width: 80, continued: true })
        doc.text(`${grupo.avance || 0}%`, 390, doc.y, { width: 80 })
        doc.moveDown(0.3)
      })
    }

    doc.end()

    // 4. Esperar a que el PDF se genere
    const pdfBuffer = await pdfPromise

    // 5. Convertir a base64 y retornar como JSON
    const pdfBase64 = pdfBuffer.toString('base64')
    
    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      filename: 'Reporte_Reinscripcion_por_Grupo.pdf'
    })

  } catch (error: any) {
    console.error('Error al exportar PDF:', error)
    return NextResponse.json(
      { error: 'Error general al generar el PDF', details: String(error) },
      { status: 500 }
    )
  }
}
