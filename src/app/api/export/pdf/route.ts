import { NextRequest, NextResponse } from 'next/server'
import { GET as getMetricas } from '../../metricas/route'
import { jsPDF } from 'jspdf'

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener métricas de forma interna
    const metricasRes = await getMetricas(request)

    if (metricasRes.status !== 200) {
      const errorText = await metricasRes.text()
      return NextResponse.json({ error: 'No se pudieron obtener las métricas', details: errorText }, { status: 500 })
    }

    const data = await metricasRes.json()

    // 2. Crear PDF con jsPDF
    const doc = new jsPDF()
    
    // 3. Contenido del PDF
    // Título
    doc.setFontSize(20)
    doc.text('Reporte de Reinscripción por Grupo', 105, 20, { align: 'center' })
    
    // Fecha
    doc.setFontSize(10)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 200, 30, { align: 'right' })
    
    let yPos = 45

    // Campus
    if (data.unidad) {
      doc.setFontSize(14)
      doc.text(`Campus: ${data.unidad}`, 20, yPos)
      yPos += 10
    }

    // Resumen
    doc.setFontSize(12)
    doc.text('Resumen General:', 20, yPos)
    yPos += 7
    
    doc.setFontSize(10)
    doc.text(`Total Alumnos 25-26: ${data.total25_26 || 0}`, 20, yPos)
    yPos += 6
    doc.text(`Total Alumnos 26-27: ${data.total26_27 || 0}`, 20, yPos)
    yPos += 6
    doc.text(`Total Clasificados: ${data.totalClasificados || 0}`, 20, yPos)
    yPos += 15

    // Tabla de grupos
    if (data.porGrupo && data.porGrupo.length > 0) {
      doc.setFontSize(12)
      doc.text('Detalle por Grupo:', 20, yPos)
      yPos += 10
      
      // Encabezados
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Grupo', 20, yPos)
      doc.text('Pendientes', 70, yPos)
      doc.text('Nuevos', 110, yPos)
      doc.text('Total', 150, yPos)
      doc.text('Avance', 180, yPos)
      yPos += 7
      
      doc.setFont('helvetica', 'normal')

      // Datos
      data.porGrupo.forEach((grupo: any) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        
        doc.text(grupo.grupo || 'Sin Grupo', 20, yPos)
        doc.text(String(grupo.pendientes || 0), 70, yPos)
        doc.text(String(grupo.nuevos || 0), 110, yPos)
        doc.text(String(grupo.total || 0), 150, yPos)
        doc.text(`${grupo.avance || 0}%`, 180, yPos)
        yPos += 6
      })
    }

    // 4. Convertir a base64
    const pdfBase64 = doc.output('datauristring').split(',')[1]
    
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
