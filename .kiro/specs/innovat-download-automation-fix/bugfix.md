# Bugfix Requirements Document

## Introduction

El agente de automatización de Innovat (`src/lib/innovat-agent.ts`) descarga archivos Excel con información de alumnos desde el sistema Innovat para 5 campus diferentes (DOMINIO, MITRAS, NORTE, CUMBRES, ANAHUAC) y 2 ciclos escolares (2025-2026, 2026-2027). El proceso tiene dos estrategias de descarga: (1) interceptor de red que captura la respuesta JSON del botón GENERAR, y (2) sistema de fallback que hace fetch directo escaneando IDs del 1 al 80.

**Problema identificado mediante testing exploratorio**: La descarga de archivos Excel falla para TODOS los campus cuando se intenta descargar datos del ciclo escolar 2026-2027. El interceptor de red no captura la respuesta (timeout de 30s), y el sistema de fallback no encuentra el unit ID correcto en el rango 1-80 cuando busca con `Estatus: -1` (el estatus usado para ciclo futuro 2026-2027).

El impacto es que el ciclo 2025-2026 funciona correctamente para todos los campus, pero el ciclo 2026-2027 falla completamente, bloqueando la sincronización de datos de alumnos para el próximo año escolar.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el sistema intenta descargar datos del ciclo 2026-2027 para cualquier campus (MITRAS, NORTE, CUMBRES, ANAHUAC, DOMINIO) THEN el interceptor de red no captura la respuesta del servidor dentro del timeout de 30 segundos

1.2 WHEN el interceptor falla y el sistema activa el fallback de fetch directo THEN el escaneo de IDs del 1 al 80 con `Estatus: -1` no encuentra el unit ID correcto para ningún campus del ciclo 2026-2027

1.3 WHEN el sistema busca con `Estatus: -1` (usado para ciclo futuro) THEN el servidor de Innovat no devuelve datos o devuelve respuestas vacías para los IDs escaneados

1.4 WHEN el escaneo completa sin encontrar el unit ID correcto THEN el sistema reporta error "No se encontró unit ID para [CAMPUS] entre 1-80" y no se genera el archivo Excel

### Expected Behavior (Correct)

2.1 WHEN el sistema intenta descargar datos del ciclo 2026-2027 para cualquier campus THEN el sistema SHALL poder descargar exitosamente el archivo Excel usando el interceptor o el sistema de fallback

2.2 WHEN el interceptor de red falla para ciclo 2026-2027 THEN el sistema de fallback SHALL encontrar el unit ID correcto escaneando con los parámetros apropiados (Estatus correcto, rango de IDs extendido si es necesario)

2.3 WHEN el sistema escanea IDs para encontrar el campus correcto THEN SHALL usar una estrategia que funcione tanto para ciclo actual (2025-2026) como para ciclo futuro (2026-2027)

2.4 WHEN el sistema encuentra el unit ID correcto THEN SHALL descargar los datos y generar el archivo Excel con la información de alumnos del campus y ciclo correspondiente

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el sistema descarga datos del ciclo 2025-2026 para cualquier campus THEN el sistema SHALL CONTINUE TO descargar correctamente los archivos Excel sin regresiones (este ciclo actualmente funciona)

3.2 WHEN el agente hace login en Innovat con credenciales válidas THEN el sistema SHALL CONTINUE TO autenticarse correctamente

3.3 WHEN el agente selecciona campus y ciclo en el dropdown del header THEN el sistema SHALL CONTINUE TO seleccionar correctamente (esta funcionalidad ya funciona bien)

3.4 WHEN el agente navega a "Escolar → Información Alumnos → General de alumnos" THEN el sistema SHALL CONTINUE TO navegar correctamente a esa sección

3.5 WHEN el interceptor de red captura respuestas JSON exitosamente THEN el sistema SHALL CONTINUE TO convertir los datos a formato Excel correctamente

3.6 WHEN se procesan múltiples campus en secuencia THEN el sistema SHALL CONTINUE TO procesar cada uno independientemente sin interferencia entre ellos
