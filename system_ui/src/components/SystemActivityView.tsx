'use client';

import { useState, useEffect, useRef } from 'react';
import { getSystemLogs, clearSystemLogs } from '@/lib/actions';
import { Terminal, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function SystemActivityView({ isBusy }: { isBusy?: boolean }) {
    const [logs, setLogs] = useState<string>('');
    const [isPolling, setIsPolling] = useState(true);
    const [lastFetch, setLastFetch] = useState<Date>(new Date());
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        const data = await getSystemLogs(200);
        setLogs(data);
        setLastFetch(new Date());
    };

    useEffect(() => {
        fetchLogs();
        if (!isPolling) return;

        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, [isPolling]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleClear = async () => {
        if (!confirm('本当にログを消去しますか？')) return;
        await clearSystemLogs();
        setLogs('');
    };

    const logLines = logs.split('\n').filter(l => l.trim() !== '');

    return (
        <div className="activity-view animate-fade-in">
            <div className="activity-header glass">
                <div className="title-area">
                    <Terminal size={18} className="text-secondary" />
                    <h3>Runtime Activity</h3>
                    <div className={`status-dot ${isPolling ? 'active' : ''}`} />
                </div>
                <div className="actions">
                    <button 
                        className="btn-icon" 
                        onClick={() => setIsPolling(!isPolling)}
                        title={isPolling ? "Pause Polling" : "Resume Polling"}
                    >
                        <RefreshCw size={14} className={isPolling ? 'spin' : ''} />
                    </button>
                    <button 
                        className="btn-icon delete" 
                        onClick={handleClear}
                        title="Clear Logs"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="console-wrapper glass" ref={scrollRef} style={{ position: 'relative' }}>
                {isBusy && <div className="activity-progress-bar" />}
                {logLines.length === 0 ? (
                    <div className="empty-logs">
                        <Terminal size={48} opacity={0.1} />
                        <p>No activity recorded yet.</p>
                    </div>
                ) : (
                    <div className="console-lines">
                        {logLines.map((line, i) => {
                            const isError = line.includes('[ERROR]') || line.includes('FAIL:') || line.includes('Error:');
                            const isSuccess = line.includes('DONE:') || line.includes('Success');
                            const isAction = line.includes('ACTION [');
                            const isMeta = line.startsWith('---');

                            return (
                                <div key={i} className={`log-line ${isError ? 'error' : ''} ${isSuccess ? 'success' : ''} ${isAction ? 'action' : ''} ${isMeta ? 'meta' : ''}`}>
                                    {isError && <AlertCircle size={10} className="line-icon" />}
                                    {isSuccess && <CheckCircle size={10} className="line-icon" />}
                                    <span className="line-text">{line}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="activity-footer">
                <span className="last-sync">Last updated: {lastFetch.toLocaleTimeString()}</span>
                <span className="hint">Pipeline logs and AI responses are captured here in real-time.</span>
            </div>

            <style jsx>{`
                .activity-view {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    height: calc(100vh - 200px);
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .activity-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1.25rem;
                    border-radius: 12px;
                }
                .title-area {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .title-area h3 {
                    margin: 0;
                    font-size: 0.9rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #475569;
                    position: relative;
                }
                .status-dot.active {
                    background: #10b981;
                    box-shadow: 0 0 8px #10b981;
                }
                .status-dot.active::after {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: 50%;
                    border: 1px solid #10b981;
                    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                @keyframes ping {
                    75%, 100% { transform: scale(2.5); opacity: 0; }
                }

                .actions {
                    display: flex;
                    gap: 0.5rem;
                }
                .btn-icon {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: var(--muted);
                    padding: 0.4rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-icon:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }
                .btn-icon.delete:hover {
                    color: #ef4444;
                    border-color: rgba(239, 68, 68, 0.2);
                    background: rgba(239, 68, 68, 0.05);
                }

                .console-wrapper {
                    flex: 1;
                    background: rgba(2, 6, 23, 0.7);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 1.25rem;
                    overflow-y: auto;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 0.85rem;
                    line-height: 1.5;
                    box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
                }
                .console-wrapper::-webkit-scrollbar {
                    width: 6px;
                }
                .console-wrapper::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }

                .empty-logs {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    color: var(--muted);
                }

                .log-line {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                    padding: 0.15rem 0;
                    color: #cbd5e1;
                    word-break: break-all;
                }
                .line-icon {
                    margin-top: 0.35rem;
                    flex-shrink: 0;
                }
                .error { color: #f87171; background: rgba(239, 68, 68, 0.05); padding-left: 0.25rem; }
                .success { color: #34d399; }
                .action { color: #818cf8; font-weight: 600; }
                .meta { color: #94a3b8; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.03); margin-top: 0.5rem; padding-top: 0.5rem; }

                .activity-footer {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.7rem;
                    color: var(--muted);
                    padding: 0 0.5rem;
                }
                .hint { opacity: 0.6; }

                .activity-progress-bar {
                    height: 2px;
                    width: 100%;
                    background: rgba(255,255,255,0.05);
                    position: absolute;
                    top: 0;
                    left: 0;
                    overflow: hidden;
                    border-radius: 12px 12px 0 0;
                }
                .activity-progress-bar::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    width: 30%;
                    background: linear-gradient(90deg, transparent, var(--primary), transparent);
                    animation: progress-scan 1.5s infinite ease-in-out;
                }
                @keyframes progress-scan {
                    0% { left: -30%; }
                    100% { left: 100%; }
                }

                .spin { animation: spin 2s linear infinite; }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
