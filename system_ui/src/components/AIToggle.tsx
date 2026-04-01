'use client';

import { useState, useEffect } from 'react';
import { getAISettings, updateAISettings, checkLocalAIServer } from '@/lib/actions';
import { Sparkles, Monitor, Activity, Check, AlertCircle, ChevronDown, ChevronUp, Settings } from 'lucide-react';

export default function AIToggle() {
    const [settings, setSettings] = useState<any>(null);
    const [isLocalOnline, setIsLocalOnline] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const refresh = async () => {
        const [s, h] = await Promise.all([
            getAISettings(),
            checkLocalAIServer()
        ]);
        setSettings(s);
        setIsLocalOnline(h.online);
    };

    useEffect(() => {
        refresh();
        const timer = setInterval(() => {
            checkLocalAIServer().then(h => setIsLocalOnline(h.online));
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    const updateProvider = async (key: string, provider: 'gemini' | 'lmstudio') => {
        setIsUpdating(true);
        const newSettings = { ...settings };
        if (key === 'global') {
            newSettings.active_provider = provider;
        } else {
            if (!newSettings.providers) newSettings.providers = {};
            newSettings.providers[key] = provider;
        }
        await updateAISettings(newSettings);
        setSettings(newSettings);
        setIsUpdating(false);
    };

    if (!settings) return null;

    const actionItems = [
        { key: 'translation', label: 'Translation' },
        { key: 'evaluation', label: 'Evaluation' },
        { key: 'opinion', label: 'News Opinion' },
        { key: 'feedback', label: 'AI Feedback' },
        { key: 'identity', label: 'Identity Analysis' },
    ];

    return (
        <div className="ai-toggle-container glass shadow-lg">
            <div className="toggle-header">
                <span className="label">AI Provider</span>
                {isLocalOnline ? (
                    <span className="status-badge online"><Activity size={10} /> Local Ready</span>
                ) : (
                    <span className="status-badge offline"><AlertCircle size={10} /> Local Offline</span>
                )}
            </div>

            <div className="toggle-switch main-switch">
                <button 
                    className={`toggle-option ${settings.active_provider === 'gemini' ? 'active' : ''}`}
                    onClick={() => updateProvider('global', 'gemini')}
                    disabled={isUpdating}
                >
                    <Sparkles size={14} />
                    <span>Gemini</span>
                    {settings.active_provider === 'gemini' && <Check size={12} className="check-icon" />}
                </button>
                <button 
                    className={`toggle-option ${settings.active_provider === 'lmstudio' ? 'active' : ''}`}
                    onClick={() => updateProvider('global', 'lmstudio')}
                    disabled={isUpdating}
                >
                    <Monitor size={14} />
                    <span>Local</span>
                    {settings.active_provider === 'lmstudio' && <Check size={12} className="check-icon" />}
                </button>
            </div>

            <button 
                className="advanced-trigger"
                onClick={() => setShowAdvanced(!showAdvanced)}
            >
                <Settings size={12} />
                <span>Detailed Settings</span>
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showAdvanced && (
                <div className="advanced-panel">
                    {actionItems.map(item => {
                        const currentProvider = settings.providers?.[item.key] || settings.active_provider;
                        return (
                            <div key={item.key} className="action-row">
                                <span className="action-label">{item.label}</span>
                                <div className="mini-toggle">
                                    <button 
                                        className={`mini-option ${currentProvider === 'gemini' ? 'active-gemini' : ''}`}
                                        onClick={() => updateProvider(item.key, 'gemini')}
                                        disabled={isUpdating}
                                    >
                                        G
                                    </button>
                                    <button 
                                        className={`mini-option ${currentProvider === 'lmstudio' ? 'active-local' : ''}`}
                                        onClick={() => updateProvider(item.key, 'lmstudio')}
                                        disabled={isUpdating}
                                    >
                                        L
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                .ai-toggle-container {
                    padding: 0.75rem;
                    border-radius: 12px;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    margin-bottom: 0.5rem;
                }
                .toggle-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--muted);
                }
                .status-badge {
                    font-size: 0.65rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.1rem 0.4rem;
                    border-radius: 4px;
                }
                .online {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }
                .offline {
                    background: rgba(239, 68, 68, 0.1);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }
                .toggle-switch {
                    display: flex;
                    gap: 0.25rem;
                    background: rgba(0, 0, 0, 0.2);
                    padding: 0.2rem;
                    border-radius: 8px;
                }
                .toggle-option {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.4rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--muted);
                    transition: all 0.2s;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    position: relative;
                }
                .toggle-option:hover:not(.active):not(:disabled) {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                }
                .toggle-option.active {
                    background: var(--primary);
                    color: white;
                    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
                }
                .toggle-option.active:nth-child(2) {
                    background: #8b5cf6;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
                }
                .check-icon {
                    position: absolute;
                    right: 4px;
                    top: 50%;
                    transform: translateY(-50%);
                    opacity: 0.8;
                }
                .advanced-trigger {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    margin-top: 0.75rem;
                    padding-top: 0.5rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: none;
                    border-left: none;
                    border-right: none;
                    border-bottom: none;
                    color: var(--muted);
                    font-size: 0.65rem;
                    gap: 0.4rem;
                    cursor: pointer;
                }
                .advanced-trigger:hover {
                    color: white;
                }
                .advanced-panel {
                    margin-top: 0.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }
                .action-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.2rem 0;
                }
                .action-label {
                    font-size: 0.65rem;
                    color: rgba(255, 255, 255, 0.6);
                }
                .mini-toggle {
                    display: flex;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                    padding: 1px;
                }
                .mini-option {
                    width: 20px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.55rem;
                    font-weight: 800;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.3);
                    cursor: pointer;
                    border-radius: 3px;
                }
                .active-gemini {
                    background: var(--primary);
                    color: white;
                }
                .active-local {
                    background: #8b5cf6;
                    color: white;
                }
            `}</style>
        </div>
    );
}
