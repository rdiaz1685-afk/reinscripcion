import { NextRequest, NextResponse } from 'next/server'
const PdfPrinter = require('pdfmake')

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener métricas
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    const metricasRes = await fetch(`${baseUrl}/api/metricas?${request.nextUrl.searchParams.toString()}`)

    if (!metricasRes.ok) {
      const errorText = await metricasRes.text()
      return NextResponse.json({ error: 'No se pudieron obtener las métricas', details: errorText }, { status: 500 })
    }

    const { resumen, porGrupo } = await metricasRes.json()

    // 2. Definición de fuentes usando las estándar integradas (no requieren archivos .ttf)
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    }
    
    const printer = new PdfPrinter(fonts)

    // 3. Construir tabla de grupos
    const body: any[] = [
      [
        { text: 'Grupo', style: 'tableHeader' },
        { text: 'Total Inicial', style: 'tableHeader' },
        { text: 'Reinscritos', style: 'tableHeader' },
        { text: 'Transf.', style: 'tableHeader' },
        { text: 'Bajas', style: 'tableHeader' },
        { text: 'Pendientes', style: 'tableHeader' },
        { text: 'Nuevos', style: 'tableHeader' },
        { text: 'Total Ef.*', style: 'tableHeader' },
        { text: 'Avance*', style: 'tableHeader' },
        { text: 'Meta', style: 'tableHeader' }
      ]
    ]

    porGrupo.forEach((grupo: any, index: number) => {
      const fillColor = index % 2 === 0 ? '#ffffff' : '#f5f5f5'
      const total_efectivo = grupo.totalEfectivo ?? (grupo.total - grupo.bajasTransferencia)
      const meta_text = grupo.meta ? (grupo.tipoMeta === 'porcentaje' ? `${grupo.valorMeta}%` : `${grupo.meta}`) : '-'
      
      body.push([
        { text: grupo.grupo || '', fillColor, alignment: 'left' },
        { text: grupo.total.toString(), fillColor },
        { text: grupo.reinscritos.toString(), fillColor },
        { text: grupo.bajasTransferencia.toString(), fillColor },
        { text: grupo.bajasReales.toString(), fillColor },
        { text: grupo.porReinscribir.toString(), fillColor },
        { text: grupo.nuevos.toString(), fillColor },
        { text: total_efectivo.toString(), fillColor },
        { text: `${grupo.porcentaje || 0}%`, fillColor },
        { text: meta_text, fillColor }
      ])
    })

    // 4. Configurar el Documento PDF
    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: { font: 'Helvetica', fontSize: 9, alignment: 'center' },
      content: [
        { text: 'Reporte de Reinscripción por Grupo', style: 'header' },
        { text: `Ciclo Escolar 2025-2026 - 2026-2027 | Generado: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`, style: 'subheader' },
        
        { text: 'Resumen General', style: 'sectionHeader', alignment: 'left' },
        {
          table: {
            widths: [140, 100],
            body: [
               [{ text: 'Total Alumnos', alignment: 'left' }, resumen.total?.toString() || '0'],
               [{ text: 'Reinscritos', alignment: 'left' }, `${resumen.reinscritos || 0} (${resumen.porcentajeActual || 0}%)`],
               [{ text: 'Bajas por Transferencia', alignment: 'left' }, resumen.bajasTransferencia?.toString() || '0'],
               [{ text: 'Bajas Reales', alignment: 'left' }, resumen.bajasReales?.toString() || '0'],
               [{ text: 'Por Reinscribir', alignment: 'left' }, resumen.porReinscribir?.toString() || '0'],
               [{ text: 'Nuevos', alignment: 'left' }, resumen.nuevos?.toString() || '0'],
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20]
        },

        { text: 'Desglose por Grupo', style: 'sectionHeader', alignment: 'left' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: body
          },
          layout: {
             fillColor: function (rowIndex: number) { return (rowIndex === 0) ? '#1f4e79' : null; },
             hLineColor: function () { return '#cccccc' },
             vLineColor: function () { return '#cccccc' }
          },
          margin: [0, 0, 0, 15]
        },

        { text: '* Total Efectivo = Total Inicial − Transferencias. El Avance se calcula sobre el Total Efectivo, descontando las transferencias del denominador (criterio autorizado por Dirección Administrativa).', fontSize: 8, color: 'gray', alignment: 'left', margin: [0, 0, 0, 15] }
      ],
      styles: {
        header: { fontSize: 20, bold: true, alignment: 'center', color: '#1f4e79', margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, alignment: 'center', color: 'gray', margin: [0, 0, 0, 20] },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 0, 0, 10] },
        tableHeader: { bold: true, fontSize: 9, color: 'white', alignment: 'center', margin: [0, 5, 0, 5] }
      }
    }

    // 5. Generar PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const chunks: Buffer[] = []
    
    return new Promise((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
      pdfDoc.on('end', () => {
        const result = Buffer.concat(chunks)
        resolve(new NextResponse(result, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="Reporte_Reinscripcion_por_Grupo.pdf"',
            'Content-Length': result.length.toString()
          }
        }))
      })
      pdfDoc.on('error', reject)
      pdfDoc.end()
    })

  } catch (error: any) {
    console.error('Error al exportar PDF nativo:', error)
    return NextResponse.json(
      { error: 'Error interno al generar el PDF', details: String(error) },
      { status: 500 }
    )
  }
}
