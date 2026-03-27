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
    doc.setFontSize(18)
    doc.setTextColor(0, 51, 102) // Azul
    doc.text('Reporte de Reinscripción por Grupo', 105, 20, { align: 'center' })
    
    // Subtítulo con ciclo y fecha
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100) // Gris
    const fechaHora = new Date().toLocaleString('es-MX', { 
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    })
    doc.text(`Ciclo Escolar 2025-2026 - 2026-2027 | Generado: ${fechaHora}`, 105, 27, { align: 'center' })
    
    let yPos = 40

    // Campus
    if (data.unidad) {
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text(`Campus: ${data.unidad.toUpperCase()}`, 20, yPos)
      yPos += 10
    }

    // Resumen General
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen General', 20, yPos)
    yPos += 8
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    // Tabla de resumen
    const resumen = data.resumen || {}
    const resumenData = [
      ['Total Alumnos', String(resumen.totalClasificados || 0)],
      ['Reinscritos', `${resumen.reinscritos || 0} (${resumen.porcentajeActual || 0}%)`],
      ['Bajas por Transferencia', String(resumen.bajasTransferencia || 0)],
      ['Bajas Reales', String(resumen.bajasReales || 0)],
      ['Por Reinscribir', String(resumen.porReinscribir || 0)],
      ['Nuevos', String(resumen.nuevos || 0)]
    ]
    
    resumenData.forEach(([label, value]) => {
      doc.text(label, 20, yPos)
      doc.text(value, 120, yPos, { align: 'right' })
      yPos += 6
    })
    
    yPos += 10

    // Desglose por Grupo
    if (data.porGrupo && data.porGrupo.length > 0) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Desglose por Grupo', 20, yPos)
      yPos += 8
      
      // Encabezados de tabla
      doc.setFontSize(8)
      doc.setTextColor(255, 255, 255)
      doc.setFillColor(0, 51, 102) // Azul oscuro
      doc.rect(15, yPos - 4, 180, 6, 'F')
      
      doc.text('Grupo', 17, yPos)
      doc.text('Total', 38, yPos)
      doc.text('Reinsc.', 52, yPos)
      doc.text('Transf.', 68, yPos)
      doc.text('Bajas', 84, yPos)
      doc.text('Pend.', 98, yPos)
      doc.text('Nuevos', 112, yPos)
      doc.text('T.Ef.*', 128, yPos)
      doc.text('Avance*', 145, yPos)
      doc.text('Meta', 165, yPos)
      yPos += 7
      
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')

      // Datos
      data.porGrupo.forEach((grupo: any, index: number) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        
        // Alternar color de fondo para filas
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 245)
          doc.rect(15, yPos - 4, 180, 5, 'F')
        }
        
        doc.text(grupo.grupo || 'Sin Grupo', 17, yPos)
        doc.text(String(grupo.total || 0), 38, yPos)
        doc.text(String(grupo.reinscritos || 0), 52, yPos)
        doc.text(String(grupo.bajasTransferencia || 0), 68, yPos)
        doc.text(String(grupo.bajasReales || 0), 84, yPos)
        doc.text(String(grupo.porReinscribir || 0), 98, yPos)
        doc.text(String(grupo.nuevos || 0), 112, yPos)
        doc.text(String(grupo.totalEfectivo || 0), 128, yPos)
        doc.text(`${grupo.porcentaje || 0}%`, 145, yPos)
        doc.text(String(grupo.meta || 0), 165, yPos)
        yPos += 5
      })
      
      // Nota al pie
      yPos += 5
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text('* Total Efectivo = Total Inicial - Transferencias. El Avance se calcula sobre el Total Efectivo,', 20, yPos)
      yPos += 3
      doc.text('descontando las transferencias del denominador (criterio autorizado por Dirección Administrativa).', 20, yPos)
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
