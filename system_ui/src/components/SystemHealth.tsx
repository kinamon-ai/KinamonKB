'use client';

import { useState, useEffect } from 'react';
import { getSystemHealth, SystemHealthData } from '@/lib/actions';
import { LayoutDashboard, Cpu, HardDrive, Server, Activity, ServerCrash, Clock, RefreshCw } from 'lucide-react';

export default function SystemHealth() {
    const [data, setData] = useState<SystemHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadHealth = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        const health = await getSystemHealth();
        setData(health);
        setLoading(false);
        if (isRefresh) setRefreshing(false);
    };

    useEffect(() => {
        loadHealth();
        // Refresh every minute automatically
        const interval = setInterval(() => loadHealth(), 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !data) {
        return (
            <div className="health-container loading-state">
                <RefreshCw className="spin" size={32} />
                <p>Gathering system metrics...</p>
            </div>
        );
    }

    const { os, storage } = data;
    const gbTotal = (os.totalMem / (1024 * 1024 * 1024)).toFixed(1);
    const gbFree = (os.freeMem / (1024 * 1024 * 1024)).toFixed(1);
    const memPercent = Math.round(((os.totalMem - os.freeMem) / os.totalMem) * 100);

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        if (d > 0) return `${d}d ${h}h`;
        return `${h}h ${m}m`;
    };

    return (
        <div className="health-container animate-fade-in">
            <div className="health-header">
                <div className="title-area">
                    <h2><LayoutDashboard size={20} /> System Health</h2>
                    <p className="subtitle">Real-time KinamonKB telemetry</p>
                </div>
                <button
                    className="btn-refresh"
                    onClick={() => loadHealth(true)}
                    disabled={refreshing}
                >
                    <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                    {refreshing ? 'Syncing...' : 'Refresh'}
                </button>
            </div>

            <div className="metrics-grid">
                {/* OS/Server Metrics */}
                <div className="metric-card glass">
                    <div className="card-top">
                        <Cpu className="metric-icon" size={20} />
                        <h3>Server Load</h3>
                    </div>
                    <div className="metric-value">
                        {os.loadAvg[0].toFixed(2)} <span className="label">1m avg</span>
                    </div>
                    <div className="metric-sub">
                        5m: {os.loadAvg[1].toFixed(2)} · 15m: {os.loadAvg[2].toFixed(2)}
                    </div>
                </div>

                <div className="metric-card glass">
                    <div className="card-top">
                        <Activity className="metric-icon" size={20} />
                        <h3>Memory Usage</h3>
                    </div>
                    <div className="metric-value">
                        {memPercent}% <span className="label">Used</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${memPercent}%`, background: memPercent > 85 ? '#ef4444' : memPercent > 70 ? '#f59e0b' : '#10b981' }}></div>
                    </div>
                    <div className="metric-sub">
                        {gbFree}GB free / {gbTotal}GB total
                    </div>
                </div>

                <div className="metric-card glass">
                    <div className="card-top">
                        <Server className="metric-icon" size={20} />
                        <h3>Uptime</h3>
                    </div>
                    <div className="metric-value">
                        {formatUptime(os.uptime)}
                    </div>
                    <div className="metric-sub">
                        Host: {os.hostname} ({os.platform})
                    </div>
                </div>
            </div>

            {/* Knowledge Base Storage */}
            <div className="storage-section glass">
                <div className="section-header">
                    <HardDrive size={18} />
                    <h3>Knowledge Base Storage</h3>
                </div>
                <div className="storage-grid">
                    <div className="storage-item">
                        <div className="s-label">News Candidates</div>
                        <div className="s-val">{storage.candidates}</div>
                    </div>
                    <div className="storage-item">
                        <div className="s-label">Pending Approval</div>
                        <div className="s-val">{storage.pending}</div>
                    </div>
                    <div className="storage-item">
                        <div className="s-label">On Hold</div>
                        <div className="s-val text-warning">{storage.held}</div>
                    </div>
                    <div className="storage-item">
                        <div className="s-label">Post Queue</div>
                        <div className="s-val text-info">{storage.queue}</div>
                    </div>
                    <div className="storage-item">
                        <div className="s-label">Posted History</div>
                        <div className="s-val text-success">{storage.decided}</div>
                    </div>
                    <div className="storage-item">
                        <div className="s-label">Trash</div>
                        <div className="s-val text-danger">{storage.trash}</div>
                    </div>
                    <div className="storage-item">
                        <div className="s-label">Identity Proposals</div>
                        <div className="s-val text-purple">{storage.proposals}</div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .health-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    height: 100%;
                }
                .loading-state {
                    align-items: center;
                    justify-content: center;
                    color: var(--muted);
                }
                .health-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .title-area h2 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.2rem;
                }
                .subtitle {
                    font-size: 0.85rem;
                    color: var(--muted);
                }
                .btn-refresh {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border);
                    color: var(--muted);
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .btn-refresh:not(:disabled):hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }
                .btn-refresh:disabled {
                    opacity: 0.6;
                    cursor: wait;
                }
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1.5rem;
                }
                .metric-card {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    border-top: 3px solid var(--primary);
                }
                .card-top {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--muted);
                }
                .card-top h3 {
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05rem;
                }
                .metric-icon { color: var(--primary); }
                .metric-value {
                    font-size: 2rem;
                    font-weight: 800;
                    line-height: 1;
                    letter-spacing: -0.05rem;
                }
                .metric-value .label {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--muted);
                    letter-spacing: 0;
                }
                .progress-bar {
                    height: 6px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                    overflow: hidden;
                    margin: 0.25rem 0;
                }
                .progress-fill {
                    height: 100%;
                    transition: width 0.5s ease-in-out;
                }
                .metric-sub {
                    font-size: 0.8rem;
                    color: var(--muted);
                }

                .storage-section {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #fff;
                    font-weight: 600;
                }
                .storage-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 1rem;
                }
                .storage-item {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 1rem;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .s-label {
                    font-size: 0.75rem;
                    color: var(--muted);
                    font-weight: 600;
                }
                .s-val {
                    font-size: 1.5rem;
                    font-weight: 800;
                }
                .text-warning { color: #f59e0b; }
                .text-info { color: #0ea5e9; }
                .text-success { color: #10b981; }
                .text-danger { color: #f87171; }
                .text-purple { color: #a855f7; }

                .spin { animation: spin 1s linear infinite; }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
