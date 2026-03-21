'use client';

import { useState, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type SyncStatus = 'idle' | 'running' | 'done' | 'error';

interface LogEntry {
    type: string;
    message: string;
    timestamp: Date;
}

interface InnovatSyncButtonProps {
    onSyncComplete?: () => void;  // Callback para refrescar el dashboard
    campus?: string[];             // Campus a sincronizar (todos por defecto)
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function InnovatSyncButton({
    onSyncComplete,
    campus,
}: InnovatSyncButtonProps) {
    const [status, setStatus] = useState<SyncStatus>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showPanel, setShowPanel] = useState(false);
    const [progress, setProgress] = useState(0);

    const addLog = useCallback((type: string, message: string) => {
        setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
    }, []);

    const startSync = useCallback(async () => {
        setStatus('running');
        setLogs([]);
        setShowPanel(true);
        setProgress(0);

        try {
            const response = await fetch('/api/sync-innovat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campus }),
            });

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // Total de pasos esperados (campus × ciclos + login + procesamiento)
            const totalCampus = campus?.length ?? 5;
            const totalSteps = 1 + (totalCampus * 2) + 2; // login + descargas + procesamiento
            let step = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        addLog(data.type, data.message);
                        step++;
                        setProgress(Math.min(Math.round((step / totalSteps) * 100), 95));

                        if (data.type === 'ready' || data.type === 'done') {
                            setProgress(100);
                            setStatus('done');
                            onSyncComplete?.();
                        }
                        if (data.type === 'fatal') {
                            setStatus('error');
                        }
                    } catch {
                        // ignorar líneas malformadas
                    }
                }
            }

            if (status !== 'done') setStatus('done');

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            addLog('fatal', `❌ ${msg}`);
            setStatus('error');
        }
    }, [campus, onSyncComplete, addLog, status]);

    // ─── Colores por tipo de log ─────────────────────────────────────────────
    const logColor = (type: string) => {
        switch (type) {
            case 'login': return 'text-blue-400';
            case 'campus': return 'text-yellow-300';
            case 'downloaded': return 'text-green-400';
            case 'processing': return 'text-purple-400';
            case 'ready':
            case 'done': return 'text-green-300 font-semibold';
            case 'error': return 'text-orange-400';
            case 'fatal': return 'text-red-400 font-semibold';
            default: return 'text-gray-300';
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="innovat-sync-wrapper">
            {/* Botón principal */}
            <button
                onClick={startSync}
                disabled={status === 'running'}
                className={`innovat-sync-btn ${status}`}
                title="Sincronizar datos desde Innovat automáticamente"
            >
                {status === 'running' ? (
                    <>
                        <span className="sync-spinner" />
                        Sincronizando...
                    </>
                ) : status === 'done' ? (
                    <>✅ Sincronizado</>
                ) : status === 'error' ? (
                    <>⚠️ Reintentar Sync</>
                ) : (
                    <>
                        {/* Ícono Innovat / refresh */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                        </svg>
                        Actualizar desde Innovat
                    </>
                )}
            </button>

            {/* Toggle del panel de log */}
            {logs.length > 0 && (
                <button
                    onClick={() => setShowPanel(p => !p)}
                    className="innovat-log-toggle"
                >
                    {showPanel ? '▲ Ocultar log' : '▼ Ver progreso'}
                </button>
            )}

            {/* Panel de progreso */}
            {showPanel && (
                <div className="innovat-log-panel">
                    {/* Barra de progreso */}
                    <div className="innovat-progress-bar-bg">
                        <div
                            className="innovat-progress-bar-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="innovat-progress-label">{progress}%</span>

                    {/* Logs */}
                    <div className="innovat-log-list">
                        {logs.map((log, i) => (
                            <div key={i} className={`innovat-log-entry ${logColor(log.type)}`}>
                                <span className="innovat-log-time">
                                    {log.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                        {status === 'running' && (
                            <div className="innovat-log-entry text-gray-500 animate-pulse">
                                ⏳ Esperando respuesta de Innovat...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Estilos inline para no depender de Tailwind para animaciones específicas */}
            <style jsx>{`
        .innovat-sync-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: fit-content;
        }

        .innovat-sync-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }

        .innovat-sync-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5);
        }

        .innovat-sync-btn:disabled {
          background: linear-gradient(135deg, #6b7280, #4b5563);
          cursor: not-allowed;
          box-shadow: none;
        }

        .innovat-sync-btn.done {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
        }

        .innovat-sync-btn.error {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
        }

        .sync-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .innovat-log-toggle {
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 11px;
          cursor: pointer;
          padding: 0;
          text-align: left;
        }

        .innovat-log-toggle:hover {
          color: #d1d5db;
        }

        .innovat-log-panel {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 12px;
          width: 420px;
          max-height: 280px;
          overflow-y: auto;
        }

        .innovat-progress-bar-bg {
          height: 4px;
          background: #1e293b;
          border-radius: 2px;
          margin-bottom: 4px;
          overflow: hidden;
        }

        .innovat-progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #10b981);
          border-radius: 2px;
          transition: width 0.4s ease;
        }

        .innovat-progress-label {
          font-size: 11px;
          color: #6b7280;
          display: block;
          margin-bottom: 8px;
        }

        .innovat-log-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .innovat-log-entry {
          display: flex;
          gap: 8px;
          font-size: 12px;
          font-family: 'Courier New', monospace;
        }

        .innovat-log-time {
          color: #4b5563;
          flex-shrink: 0;
        }
      `}</style>
        </div>
    );
}
