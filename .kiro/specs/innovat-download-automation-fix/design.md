# Innovat Download Automation Fix - Bugfix Design

## Overview

El bug se manifiesta cuando el sistema intenta descargar archivos Excel para el ciclo escolar 2026-2027 (ciclo futuro). El interceptor de red no captura la respuesta del servidor dentro del timeout de 30 segundos, y el sistema de fallback que escanea IDs del 1 al 80 no encuentra el unit ID correcto cuando busca con `Estatus: -1`.

**Evidencia del testing exploratorio**:
- ✅ Ciclo 2025-2026: Funciona para todos los campus (MITRAS, NORTE, CUMBRES, ANAHUAC, DOMINIO)
- ❌ Ciclo 2026-2027: Falla para todos los campus con error "No se encontró unit ID para [CAMPUS] entre 1-80"
- ✅ Selección de campus/ciclo: Funciona correctamente (dropdown, opciones, clicks, header update)
- ❌ Descarga con fallback: El escaneo con `Estatus: -1` no encuentra datos

La estrategia de fix consiste en:
1. Aumentar el timeout del interceptor de 30s a 60s para dar más tiempo al servidor
2. Extender el rango de escaneo de IDs de 1-80 a 1-150 para cubrir más unidades
3. Probar múltiples valores de Estatus (-1, 0, 1, 2) en el fallback para ciclo 2026-2027
4. Agregar retry logic si el primer intento con Estatus: -1 falla
5. Mejorar el logging para diagnosticar por qué el interceptor no captura la respuesta

## Glossary

- **Bug_Condition (C)**: La condición que activa el bug - cuando el sistema intenta descargar datos del ciclo 2026-2027 para cualquier campus y tanto el interceptor como el fallback fallan
- **Property (P)**: El comportamiento deseado - el sistema debe poder descargar archivos Excel para el ciclo 2026-2027 usando el interceptor o el fallback
- **Preservation**: El comportamiento existente que debe mantenerse - el ciclo 2025-2026 (que funciona) debe seguir funcionando, y todos los demás pasos del flujo (login, selección campus/ciclo, navegación) deben permanecer sin cambios
- **descargarConInterceptor**: La función en `src/lib/innovat-agent.ts` (líneas 302-510) que maneja la descarga de archivos Excel usando interceptor de red y fallback
- **Interceptor de red**: Estrategia primaria que escucha respuestas HTTP a `/api/gralalumnos` y convierte JSON a Excel
- **Sistema de fallback**: Estrategia secundaria que hace fetch directo escaneando IDs del 1 al 80 cuando el interceptor falla
- **Estatus**: Parámetro en el request body que filtra alumnos por estatus (1 = activos ciclo actual, -1 = todos para ciclo futuro, 0 = inactivos, 2 = egresados)

## Bug Details

### Bug Condition

El bug se manifiesta cuando el sistema intenta descargar datos del ciclo escolar 2026-2027 para cualquier campus. La función `descargarConInterceptor` no logra capturar la respuesta del servidor con el interceptor de red (timeout de 30s), y el sistema de fallback no encuentra el unit ID correcto escaneando IDs del 1 al 80 con `Estatus: -1`.

**Evidencia del testing exploratorio**:
1. El interceptor espera 30 segundos pero no captura respuesta del servidor para ciclo 2026-2027
2. El fallback escanea IDs 1-80 con `Estatus: -1` pero no encuentra datos para ningún campus
3. El mensaje de error es "No se encontró unit ID para [CAMPUS] entre 1-80"
4. El mismo código funciona perfectamente para ciclo 2025-2026 con `Estatus: 1`

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { campus: string, ciclo: string, page: Page }
  OUTPUT: boolean
  
  RETURN input.ciclo = '2026-2027'
         AND interceptorTimedOut(input.page, 30000)
         AND NOT fallbackFoundUnitId(input.campus, input.ciclo, 1, 80, -1)
END FUNCTION
```

### Examples

- **MITRAS 2026-2027**: Interceptor timeout después de 30s, fallback escanea IDs 1-80 con Estatus:-1, no encuentra datos, error "No se encontró unit ID para MITRAS entre 1-80"
- **NORTE 2026-2027**: Mismo comportamiento - interceptor timeout, fallback no encuentra unit ID
- **CUMBRES 2026-2027**: Mismo comportamiento - interceptor timeout, fallback no encuentra unit ID
- **ANAHUAC 2026-2027**: Mismo comportamiento - interceptor timeout, fallback no encuentra unit ID
- **MITRAS 2025-2026**: ✅ Funciona correctamente - interceptor captura respuesta o fallback encuentra unit ID con Estatus:1

### Root Cause Analysis

Basado en el testing exploratorio y el análisis del código, los problemas más probables son:

1. **Timeout del Interceptor Demasiado Corto**: El timeout de 30 segundos puede no ser suficiente para que el servidor de Innovat procese y devuelva datos del ciclo 2026-2027, especialmente si el servidor necesita generar o calcular datos para un ciclo futuro que aún no está completamente poblado

2. **Rango de Escaneo de IDs Insuficiente**: El fallback escanea IDs del 1 al 80, pero los unit IDs para el ciclo 2026-2027 pueden estar fuera de ese rango (por ejemplo, IDs 81-150 o superiores) si Innovat asigna IDs diferentes para ciclos futuros

3. **Valor de Estatus Incorrecto para Ciclo Futuro**: El código usa `Estatus: -1` para ciclo 2026-2027, pero el servidor de Innovat puede requerir un valor diferente (0, 1, 2, o ningún filtro) para devolver datos de ciclos futuros

4. **Servidor No Tiene Datos para Ciclo Futuro**: Es posible que el servidor de Innovat simplemente no tenga datos de alumnos para el ciclo 2026-2027 aún, o que esos datos estén en una ubicación/endpoint diferente

5. **Interceptor No Captura Respuesta por Timing**: La respuesta del servidor puede llegar después de que el interceptor se desregistra, o puede haber múltiples requests/responses y el interceptor captura la incorrecta

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- El ciclo 2025-2026 (que actualmente funciona para todos los campus) debe seguir descargando correctamente
- El proceso de login con credenciales debe continuar funcionando exactamente igual
- La selección de campus/ciclo en el dropdown debe permanecer sin cambios (ya funciona correctamente)
- La navegación a "Escolar → Información Alumnos → General de alumnos" debe permanecer sin cambios
- El interceptor de red para ciclo 2025-2026 debe continuar funcionando como antes
- El procesamiento secuencial de múltiples campus debe mantenerse sin interferencia entre ellos

**Scope:**
Todos los inputs que involucran el ciclo 2025-2026 deben ser completamente no afectados por este fix. Solo el ciclo 2026-2027 debe cambiar su comportamiento (de fallar a funcionar).

## Hypothesized Root Cause

Basado en el análisis del código y el testing exploratorio, las causas más probables son:

1. **Timeout del Interceptor Insuficiente**: El servidor de Innovat tarda más de 30 segundos en procesar y devolver datos para el ciclo 2026-2027, causando que el interceptor se desregistre antes de capturar la respuesta

2. **Rango de IDs Insuficiente en Fallback**: Los unit IDs para ciclo 2026-2027 están fuera del rango 1-80 que escanea el fallback, posiblemente en el rango 81-150 o superior

3. **Valor de Estatus Incorrecto**: El servidor requiere un valor de Estatus diferente a -1 para devolver datos de ciclo 2026-2027 (posiblemente 1, 0, 2, o sin filtro de estatus)

## Correctness Properties

Property 1: Bug Condition - Download Works for Ciclo 2026-2027

_For any_ input donde el sistema intenta descargar datos del ciclo 2026-2027 para cualquier campus, la función `descargarConInterceptor` fija SHALL capturar la respuesta del servidor con el interceptor (con timeout extendido) O encontrar el unit ID correcto con el fallback (con rango extendido y valores de Estatus alternativos), y generar exitosamente el archivo Excel.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Ciclo 2025-2026 Continues Working

_For any_ input que involucra el ciclo 2025-2026 (que actualmente funciona), el código fijo SHALL producir exactamente el mismo comportamiento que el código original, preservando toda la funcionalidad existente para el ciclo actual.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Asumiendo que nuestro análisis de root cause es correcto:

**File**: `src/lib/innovat-agent.ts`

**Function**: `descargarConInterceptor` (líneas 302-510)

**Specific Changes**:

1. **Aumentar Timeout del Interceptor**: Cambiar de 30s a 60s
2. **Extender Rango de Escaneo**: Cambiar de 1-80 a 1-150
3. **Probar Múltiples Valores de Estatus**: Para ciclo 2026-2027, probar -1, 1, 0, 2
4. **Mejorar Logging**: Agregar logs de progreso del escaneo
5. **Agregar Retry Logic**: Reintentar click en GENERAR si el interceptor falla

## Testing Strategy

### Exploratory Bug Condition Checking

**Goal**: Confirmar el bug en el código NO FIJO

**RESULTADO**: ✅ Bug confirmado - todos los campus fallan para ciclo 2026-2027

### Fix Checking

**Goal**: Verificar que el fix funciona para ciclo 2026-2027

### Preservation Checking

**Goal**: Verificar que ciclo 2025-2026 sigue funcionando
