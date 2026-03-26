/**
 * API Route: /api/sync-innovat
 * 
 * Activa el agente de Innovat para descargar los reportes Excel
 * y procesar los datos automáticamente.
 * 
 * Usa Server-Sent Events (SSE) para enviar progreso en tiempo real al frontend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncFromInnovat, CAMPUS_LIST, SyncStep } from '@/lib/innovat-agent';

export const maxDuration = 300; // 5 minutos máximo (Railway / Vercel)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    // Soporte para SSE (progreso en tiempo real)
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            function send(data: object) {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
            }

            try {
                // Obtener campus opcionales del body
                const body = await request.json().catch(() => ({}));
                const campusList: string[] = body.campus || CAMPUS_LIST;

                send({ type: 'start', message: 'Iniciando sincronización con Innovat...', campus: campusList });

                const archivosDescargados = await syncFromInnovat(
                    campusList,
                    (step: SyncStep) => {
                        switch (step.type) {
                            case 'login':
                                send({ type: 'login', message: '🔐 Iniciando sesión en Innovat...' });
                                break;
                            case 'campus':
                                send({
                                    type: 'campus',
                                    message: `📥 Descargando ${step.campus} - Ciclo ${step.ciclo}...`,
                                    campus: step.campus,
                                    ciclo: step.ciclo,
                                });
                                break;
                            case 'downloaded':
                                send({
                                    type: 'downloaded',
                                    message: `✅ ${step.campus} ${step.ciclo} descargado`,
                                    path: step.path,
                                });
                                break;
                            case 'error':
                                send({ type: 'error', message: `⚠️ ${step.message}` });
                                break;
                            case 'done':
                                send({
                                    type: 'done',
                                    message: `🎉 Sincronización completa. ${step.files.length} archivos descargados.`,
                                    files: step.files,
                                });
                                break;
                            case 'debug':
                                send({ type: 'debug', message: step.message });
                                break;
                        }
                    }
                );

                // NUEVA ESTRATEGIA: Si se guardó en BD, no importar Excel
                // Detectar si se usó el fallback directo (archivos vacíos o "Procesado directamente en BD")
                const pathMod = await import('path');
                const fs = await import('fs/promises');
                
                let usaronFallbackDirecto = false;
                if (archivosDescargados.length > 0) {
                    try {
                        const primerArchivo = archivosDescargados[0];
                        const contenido = await fs.readFile(primerArchivo, 'utf-8');
                        usaronFallbackDirecto = contenido.includes('Procesado directamente en BD') || contenido.length < 100;
                    } catch {
                        usaronFallbackDirecto = true; // Si no se puede leer, asumir que se guardó en BD
                    }
                }
                
                if (usaronFallbackDirecto && archivosDescargados.length > 0) {
                    // Los datos ya fueron guardados directamente en la BD por el agente
                    send({ type: 'processing', message: '⚙️ Datos guardados en BD. Clasificando alumnos...' });
                    
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                    try {
                        const procRes = await fetch(`${baseUrl}/api/import`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'procesar' }),
                        });
                        if (procRes.ok) {
                            send({ type: 'ready', message: '🚀 Sincronización completa. Dashboard actualizado automáticamente.' });
                        } else {
                            send({ type: 'ready', message: '✅ Datos guardados. Usa "Procesar Datos" en Config para clasificar.' });
                        }
                    } catch {
                        send({ type: 'ready', message: '✅ Datos guardados. Usa "Procesar Datos" en Config para clasificar.' });
                    }
                } else if (archivosDescargados.length > 0) {
                    // Flujo tradicional con Excel (solo si hay archivos Excel reales)
                    send({ type: 'processing', message: '⚙️ Importando archivos descargados...' });

                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                    const pathMod = await import('path');

                    // Paso 1: Importar cada archivo usando solo el nombre base (no ruta absoluta)
                    let importadosOk = 0;
                    send({ type: 'processing', message: `📂 Importando ${archivosDescargados.length} archivos...` });
                    
                    for (const filePath of archivosDescargados) {
                        const fileName = pathMod.basename(filePath);
                        const tipo = fileName.includes('25-26') ? '25-26' : '26-27';
                        send({ type: 'processing', message: `📥 Importando ${fileName}...` });
                        
                        try {
                            const importRes = await fetch(`${baseUrl}/api/import`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fileName, tipo }),
                            });
                            
                            if (importRes.ok) {
                                const data = await importRes.json();
                                send({ type: 'processing', message: `✅ ${fileName}: ${data.message || 'Importado'}` });
                                importadosOk++;
                            } else {
                                const err = await importRes.json().catch(() => ({}));
                                const errorMsg = err.error || err.details || importRes.statusText;
                                send({ type: 'error', message: `⚠️ ${fileName}: ${errorMsg}` });
                                console.error(`Error importando ${fileName}:`, err);
                            }
                        } catch (e) {
                            send({ type: 'error', message: `⚠️ ${fileName}: ${e}` });
                            console.error(`Excepción importando ${fileName}:`, e);
                        }
                    }
                    
                    send({ type: 'processing', message: `📊 Importados: ${importadosOk}/${archivosDescargados.length}` });

                    // Paso 2: Disparar el procesamiento/clasificación solo si se importó algo
                    if (importadosOk > 0) {
                        send({ type: 'processing', message: '⚙️ Clasificando y procesando datos...' });
                        try {
                            const procRes = await fetch(`${baseUrl}/api/import`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'procesar' }),
                            });
                            if (procRes.ok) {
                                send({ type: 'ready', message: '🚀 Sincronización completa. Dashboard actualizado automáticamente.' });
                            } else {
                                send({ type: 'ready', message: '✅ Archivos importados. Usa "Procesar Datos" en Config para clasificar.' });
                            }
                        } catch {
                            send({ type: 'ready', message: '✅ Archivos importados. Usa "Procesar Datos" en Config para clasificar.' });
                        }
                    } else {
                        send({ type: 'ready', message: '⚠️ No se pudo importar ningún archivo. Revisa los logs.' });
                    }
                }

            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Error desconocido';
                send({ type: 'fatal', message: `❌ Error crítico: ${msg}` });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

// GET: Estado del agente (para saber si está disponible)
export async function GET() {
    return NextResponse.json({
        available: true,
        campus: CAMPUS_LIST,
        message: 'Agente de Innovat disponible. Usa POST para iniciar sincronización.',
    });
}
