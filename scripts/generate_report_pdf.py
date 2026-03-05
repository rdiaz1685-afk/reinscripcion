#!/usr/bin/env python3
"""
Generador de PDF para el reporte de reinscripción por grupo
"""

import sys
import json
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, Image
)

# Colores para la tabla
TABLE_HEADER_COLOR = colors.HexColor('#1F4E79')
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = colors.HexColor('#F5F5F5')

def create_pdf(data: dict, output_path: str):
    """Genera el PDF con el reporte de reinscripción"""
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title='Reporte_Reinscripcion_por_Grupo',
        author='Z.ai',
        creator='Z.ai',
        subject='Reporte de avance de reinscripción por grupo'
    )
    
    styles = getSampleStyleSheet()
    
    # Estilos personalizados usando Helvetica (fuente por defecto)
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=colors.HexColor('#1F4E79'),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        textColor=colors.grey,
        alignment=TA_CENTER,
        spaceAfter=30
    )
    
    header_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.white,
        alignment=TA_CENTER,
        leading=12
    )
    
    cell_style = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.black,
        alignment=TA_CENTER,
        leading=12
    )
    
    cell_left_style = ParagraphStyle(
        'TableCellLeft',
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.black,
        alignment=TA_LEFT,
        leading=12
    )
    
    story = []
    
    # Obtener hora local de Mexico (GMT-6)
    mexico_tz = ZoneInfo('America/Mexico_City')
    fecha_local = datetime.now(mexico_tz)
    fecha_formateada = fecha_local.strftime("%d/%m/%Y %H:%M")
    
    # Titulo
    story.append(Paragraph('Reporte de Reinscripcion por Grupo', title_style))
    story.append(Paragraph(
        f'Ciclo Escolar 2025-2026 - 2026-2027 | Generado: {fecha_formateada}',
        subtitle_style
    ))
    
    # Resumen general
    resumen = data.get('resumen', {})
    story.append(Paragraph('<b>Resumen General</b>', styles['Heading2']))
    story.append(Spacer(1, 10))
    
    summary_data = [
        ['Total Alumnos', str(resumen.get('total', 0))],
        ['Reinscritos', f"{resumen.get('reinscritos', 0)} ({resumen.get('porcentajeActual', 0)}%)"],
        ['Bajas por Transferencia', str(resumen.get('bajasTransferencia', 0))],
        ['Bajas Reales', str(resumen.get('bajasReales', 0))],
        ['Por Reinscribir', str(resumen.get('porReinscribir', 0))],
        ['Nuevos', str(resumen.get('nuevos', 0))],
    ]
    
    if resumen.get('meta', 0) > 0:
        meta_label = f"{resumen.get('valorMeta', 0)}{'%' if resumen.get('tipoMeta') == 'porcentaje' else ' alumnos'}"
        summary_data.append(['Meta', meta_label])
        summary_data.append(['Cumplimiento', f"{resumen.get('porcentajeCumplimiento', 0)}%"])
    
    summary_table = Table(summary_data, colWidths=[4*cm, 4*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0F0F0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Tabla de desglose por grupo
    story.append(Paragraph('<b>Desglose por Grupo</b>', styles['Heading2']))
    story.append(Spacer(1, 10))
    
    por_grupo = data.get('porGrupo', [])
    
    # Encabezados de la tabla
    headers = ['Grupo', 'Total', 'Reinscritos', 'Transf.', 'Bajas', 'Pendientes', 'Nuevos', 'Avance', 'Meta']
    
    # Construir datos de la tabla
    table_data = []
    # Fila de encabezados
    header_row = [Paragraph(f'<b>{h}</b>', header_style) for h in headers]
    table_data.append(header_row)
    
    # Filas de datos
    for grupo in por_grupo:
        row = [
            Paragraph(str(grupo.get('grupo', '')), cell_left_style),
            Paragraph(str(grupo.get('total', 0)), cell_style),
            Paragraph(str(grupo.get('reinscritos', 0)), cell_style),
            Paragraph(str(grupo.get('bajasTransferencia', 0)), cell_style),
            Paragraph(str(grupo.get('bajasReales', 0)), cell_style),
            Paragraph(str(grupo.get('porReinscribir', 0)), cell_style),
            Paragraph(str(grupo.get('nuevos', 0)), cell_style),
            Paragraph(f"{grupo.get('porcentaje', 0)}%", cell_style),
        ]
        
        # Meta
        if grupo.get('meta'):
            meta_text = f"{grupo.get('valorMeta')}%" if grupo.get('tipoMeta') == 'porcentaje' else str(grupo.get('meta'))
            row.append(Paragraph(meta_text, cell_style))
        else:
            row.append(Paragraph('-', cell_style))
        
        table_data.append(row)
    
    # Crear tabla
    col_widths = [2*cm, 1.5*cm, 2*cm, 1.5*cm, 1.5*cm, 2*cm, 1.5*cm, 1.5*cm, 1.5*cm]
    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Estilo de la tabla
    table_style = [
        # Encabezado
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        
        # Filas alternadas
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    
    # Aplicar colores alternados a las filas
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_style.append(('BACKGROUND', (0, i), (-1, i), TABLE_ROW_ODD))
        else:
            table_style.append(('BACKGROUND', (0, i), (-1, i), TABLE_ROW_EVEN))
    
    main_table.setStyle(TableStyle(table_style))
    story.append(main_table)
    story.append(Spacer(1, 20))
    
    # Leyenda de colores
    story.append(Paragraph('<b>Leyenda</b>', styles['Heading2']))
    story.append(Spacer(1, 10))
    
    legend_data = [
        [Paragraph('<font color="#22c55e">-</font> Reinscritos', cell_left_style),
         Paragraph('<font color="#f59e0b">-</font> Transferencias', cell_left_style),
         Paragraph('<font color="#ef4444">-</font> Bajas Reales', cell_left_style)],
        [Paragraph('<font color="#6b7280">-</font> Por Reinscribir', cell_left_style),
         Paragraph('<font color="#3b82f6">-</font> Nuevos', cell_left_style),
         '']
    ]
    
    legend_table = Table(legend_data, colWidths=[5*cm, 5*cm, 5*cm])
    legend_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    story.append(legend_table)
    
    # Footer
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        f'Documento generado automaticamente por Sistema de Reinscripcion - {fecha_formateada}',
        ParagraphStyle('Footer', fontName='Helvetica', fontSize=8, textColor=colors.grey, alignment=TA_CENTER)
    ))
    
    # Construir PDF
    doc.build(story)
    
    return output_path


def main():
    if len(sys.argv) < 3:
        print("Uso: python generate_report_pdf.py <json_data> <output_path>")
        sys.exit(1)
    
    json_input = sys.argv[1]
    output_path = sys.argv[2]
    
    try:
        if os.path.exists(json_input):
            with open(json_input, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = json.loads(json_input)
            
        result_path = create_pdf(data, output_path)
        print(f"PDF generado exitosamente: {result_path}")
    except Exception as e:
        print(f"Error al generar PDF: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
