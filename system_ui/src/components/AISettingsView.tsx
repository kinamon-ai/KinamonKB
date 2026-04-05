'use client';

import { useState, useEffect } from 'react';
import { getAISettings, updateAISettings, checkLocalAIServer } from '@/lib/actions';
import { 
    Sparkles, 
    Monitor, 
    Activity, 
    Check, 
    AlertCircle, 
    Settings, 
    Cpu, 
    Zap, 
    MessageSquare, 
    Save,
    RotateCcw
} from 'lucide-react';

export default function AISettingsView() {
    const [settings, setSettings] = useState<any>(null);
    const [isLocalOnline, setIsLocalOnline] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const refresh = async () => {
        const [s, h] = await Promise.all([
            getAISettings(),
            checkLocalAIServer()
        ]);
        // Ensure context_lengths exists
        if (!s.context_lengths) {
            s.context_lengths = {
                classify: 1000,
                evaluate: 1500,
                brief: 3000
            };
        }
        setSettings(s);
        setIsLocalOnline(h.online);
    };

    useEffect(() => {
        refresh();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            await updateAISettings(settings);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            setSaveStatus('error');
        }
        setIsSaving(false);
    };

    const updateContextLength = (key: string, val: number) => {
        setSettings({
            ...settings,
            context_lengths: {
                ...settings.context_lengths,
                [key]: val
            }
        });
    };

    const updateProvider = (key: string, provider: 'gemini' | 'lmstudio') => {
        const newSettings = { ...settings };
        if (key === 'global') {
            newSettings.active_provider = provider;
        } else {
            if (!newSettings.providers) newSettings.providers = {};
            newSettings.providers[key] = provider;
        }
        setSettings(newSettings);
    };

    if (!settings) return (
        <div className="settings-loading">
            <RotateCcw className="spin" /> Loading Settings...
        </div>
    );

    const actionItems = [
        { key: 'translation', label: 'Headline Translation' },
        { key: 'evaluation', label: 'Relevance Check (Step 3a/c)' },
        { key: 'opinion', label: 'Opinion Generation (Step 5b)' },
        { key: 'feedback', label: 'Persona Learning' },
        { key: 'identity', label: 'Identity Analysis' },
    ];

    return (
        <div className="ai-settings-view animate-fade-in">
            <div className="settings-grid">
                {/* ─── AI Provider Matrix ─── */}
                <section className="settings-card glass">
                    <div className="card-header">
                        <Cpu className="header-icon" />
                        <div>
                            <h3>AI Models & Providers</h3>
                            <p>Configure which LLM handles each part of the pipeline.</p>
                        </div>
                    </div>

                    <div className="provider-status">
                        <div className={`status-pill ${isLocalOnline ? 'online' : 'offline'}`}>
                            {isLocalOnline ? <Activity size={12} /> : <AlertCircle size={12} />}
                            {isLocalOnline ? 'Local LMStudio Online' : 'Local LMStudio Offline'}
                        </div>
                    </div>

                    <div className="matrix-list">
                        <div className="matrix-row global">
                            <span className="row-label">Default Provider</span>
                            <div className="switch-group">
                                <button 
                                    className={`switch-btn gemini ${settings.active_provider === 'gemini' ? 'active' : ''}`}
                                    onClick={() => updateProvider('global', 'gemini')}
                                >
                                    <Sparkles size={14} /> Gemini
                                </button>
                                <button 
                                    className={`switch-btn local ${settings.active_provider === 'lmstudio' ? 'active' : ''}`}
                                    onClick={() => updateProvider('global', 'lmstudio')}
                                >
                                    <Monitor size={14} /> Local
                                </button>
                            </div>
                        </div>

                        <div className="divider" />
                        
                        {actionItems.map(item => {
                            const current = settings.providers?.[item.key] || settings.active_provider;
                            return (
                                <div key={item.key} className="matrix-row">
                                    <span className="row-label">{item.label}</span>
                                    <div className="switch-group mini">
                                        <button 
                                            className={`switch-btn gemini ${current === 'gemini' ? 'active' : ''}`}
                                            onClick={() => updateProvider(item.key, 'gemini')}
                                        >
                                            Gemini
                                        </button>
                                        <button 
                                            className={`switch-btn local ${current === 'lmstudio' ? 'active' : ''}`}
                                            onClick={() => updateProvider(item.key, 'lmstudio')}
                                        >
                                            Local
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ─── Context Length Controls ─── */}
                <section className="settings-card glass">
                    <div className="card-header">
                        <Zap className="header-icon" />
                        <div>
                            <h3>Pipeline Precision</h3>
                            <p>Control how much article content is analyzed at each step.</p>
                        </div>
                    </div>

                    <div className="controls-list">
                        <div className="control-item">
                            <div className="control-info">
                                <label>Step 3a: Classification Depth</label>
                                <span>{settings.context_lengths.classify} characters</span>
                            </div>
                            <input 
                                type="range" 
                                min="200" 
                                max="3000" 
                                step="100"
                                value={settings.context_lengths.classify}
                                onChange={(e) => updateContextLength('classify', parseInt(e.target.value))}
                            />
                            <p className="desc">Length of English content used to identify topics and assign bots.</p>
                        </div>

                        <div className="control-item">
                            <div className="control-info">
                                <label>Step 3c: Evaluation Depth</label>
                                <span>{settings.context_lengths.evaluate} characters</span>
                            </div>
                            <input 
                                type="range" 
                                min="500" 
                                max="5000" 
                                step="100"
                                value={settings.context_lengths.evaluate}
                                onChange={(e) => updateContextLength('evaluate', parseInt(e.target.value))}
                            />
                            <p className="desc">Depth of content used for the A/B/C relevance check.</p>
                        </div>

                        <div className="control-item">
                            <div className="control-info">
                                <label>Step 5a: Briefing Depth</label>
                                <span>{settings.context_lengths.brief} bytes</span>
                            </div>
                            <input 
                                type="range" 
                                min="1000" 
                                max="15000" 
                                step="500"
                                value={settings.context_lengths.brief}
                                onChange={(e) => updateContextLength('brief', parseInt(e.target.value))}
                            />
                            <p className="desc">Total content size compressed into the structured brief.</p>
                        </div>
                    </div>

                    <div className="alert-box">
                        <MessageSquare size={14} />
                        <div>
                            <strong>Quality vs. Performance</strong>
                            <p>Higher context produces better results but may trigger rate limits or OOM on local models (4096 ctx).</p>
                        </div>
                    </div>
                </section>
            </div>

            <div className="settings-actions">
                <button 
                    className={`save-btn ${saveStatus === 'success' ? 'success' : ''}`}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <RotateCcw className="spin" size={18} />
                    ) : saveStatus === 'success' ? (
                        <Check size={18} />
                    ) : (
                        <Save size={18} />
                    )}
                    {isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved Successfully' : 'Save Changes'}
                </button>
            </div>

            <style jsx>{`
                .ai-settings-view {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 2rem;
                }
                .settings-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }
                .settings-card {
                    padding: 1.5rem;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .card-header {
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }
                .header-icon {
                    color: var(--primary);
                    flex-shrink: 0;
                }
                .card-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: white;
                }
                .card-header p {
                    margin: 0.25rem 0 0;
                    font-size: 0.8rem;
                    color: var(--muted);
                }
                .provider-status {
                    margin-bottom: 0.5rem;
                }
                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 99px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .online { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .offline { background: rgba(239, 68, 68, 0.1); color: #f87171; }

                .matrix-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .matrix-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .row-label {
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.8);
                }
                .switch-group {
                    display: flex;
                    background: rgba(0, 0, 0, 0.3);
                    padding: 0.25rem;
                    border-radius: 8px;
                    gap: 0.25rem;
                }
                .switch-btn {
                    border: none;
                    background: transparent;
                    color: var(--muted);
                    font-size: 0.8rem;
                    font-weight: 600;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .switch-btn:hover { color: white; background: rgba(255, 255, 255, 0.05); }
                .switch-btn.active.gemini { background: var(--primary); color: white; }
                .switch-btn.active.local { background: #8b5cf6; color: white; }

                .mini .switch-btn {
                    padding: 0.25rem 0.75rem;
                    font-size: 0.7rem;
                }

                .divider {
                    height: 1px;
                    background: rgba(255, 255, 255, 0.1);
                    margin: 0.5rem 0;
                }

                .controls-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .control-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .control-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .control-info label {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: white;
                }
                .control-info span {
                    font-size: 0.75rem;
                    font-family: monospace;
                    color: var(--primary);
                }
                .desc {
                    margin: 0;
                    font-size: 0.7rem;
                    color: var(--muted);
                }
                input[type="range"] {
                    width: 100%;
                    accent-color: var(--primary);
                }

                .alert-box {
                    margin-top: auto;
                    background: rgba(79, 70, 229, 0.05);
                    border: 1px solid rgba(79, 70, 229, 0.2);
                    border-radius: 8px;
                    padding: 0.75rem;
                    display: flex;
                    gap: 0.75rem;
                    color: rgba(255, 255, 255, 0.8);
                }
                .alert-box strong { font-size: 0.8rem; display: block; margin-bottom: 0.1rem; }
                .alert-box p { margin: 0; font-size: 0.7rem; color: var(--muted); }

                .settings-actions {
                    margin-top: 2rem;
                    display: flex;
                    justify-content: flex-end;
                }
                .save-btn {
                    background: var(--primary);
                    color: white;
                    border: none;
                    padding: 0.75rem 2rem;
                    border-radius: 8px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                }
                .save-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
                    background: #5a52ff;
                }
                .save-btn.success {
                    background: #10b981;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                }
                .save-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .settings-loading {
                    height: 400px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    color: var(--muted);
                }

                @media (max-width: 900px) {
                    .settings-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
