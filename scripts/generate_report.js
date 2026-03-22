const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

function createPdf(data, outputPath) {
  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    }
  };

  const printer = new PdfPrinter(fonts);

  const resumen = data.resumen || {};
  const porGrupo = data.porGrupo || [];

  const body = [
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
  ];

  porGrupo.forEach((grupo, index) => {
    const fillColor = index % 2 === 0 ? '#ffffff' : '#f5f5f5';
    const total_efectivo = grupo.totalEfectivo ?? (grupo.total - grupo.bajasTransferencia);
    const meta_text = grupo.meta ? (grupo.tipoMeta === 'porcentaje' ? `${grupo.valorMeta}%` : `${grupo.meta}`) : '-';
    
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
    ]);
  });

  const docDefinition = {
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
           fillColor: function (rowIndex) { return (rowIndex === 0) ? '#1f4e79' : null; },
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
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const stream = fs.createWriteStream(outputPath);
  
  pdfDoc.pipe(stream);
  pdfDoc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    pdfDoc.on('error', reject);
  });
}

function main() {
  if (process.argv.length < 4) {
    console.error("Uso: node generate_report.js <json_data> <output_path>");
    process.exit(1);
  }
  
  const jsonInput = process.argv[2];
  const outputPath = process.argv[3];
  
  try {
    let data;
    if (fs.existsSync(jsonInput)) {
      data = JSON.parse(fs.readFileSync(jsonInput, 'utf-8'));
    } else {
      data = JSON.parse(jsonInput);
    }
    
    createPdf(data, outputPath).then(() => {
      console.log(`PDF generado exitosamente: ${outputPath}`);
      process.exit(0);
    }).catch(err => {
      console.error(`Error al generar PDF STREAM: ${err}`);
      process.exit(1);
    });
  } catch (e) {
    console.error(`Error de script general: ${e}`);
    process.exit(1);
  }
}

main();
