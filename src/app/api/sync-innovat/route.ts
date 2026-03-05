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

                // Si la descarga fue exitosa, disparar el procesamiento automático
                if (archivosDescargados.length > 0) {
                    send({ type: 'processing', message: '⚙️ Procesando datos descargados...' });

                    // Llamar al endpoint de importación existente para cada par de archivos
                    // (esto actualiza la BD que alimenta el dashboard)
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

                    try {
                        const importRes = await fetch(`${baseUrl}/api/import`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ source: 'innovat-sync', files: archivosDescargados }),
                        });

                        if (importRes.ok) {
                            send({ type: 'ready', message: '🚀 Dashboard actualizado automáticamente.' });
                        } else {
                            send({ type: 'ready', message: '✅ Archivos listos. Procesa los datos desde Config.' });
                        }
                    } catch {
                        send({ type: 'ready', message: '✅ Archivos descargados. Procesa los datos desde Config.' });
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
