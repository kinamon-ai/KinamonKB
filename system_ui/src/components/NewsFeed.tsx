'use client';

import { useState, useEffect } from 'react';
import {
    NewsCandidate,
    getCandidates,
    fetchRSSAction,
    addManualNews,
    processCandidates,
    getRSSFeeds,
    addRSSFeed,
    removeRSSFeed
} from '@/lib/actions';
import {
    Rss,
    Plus,
    Link as LinkIcon,
    CheckSquare,
    Square,
    Play,
    Loader2,
    Globe,
    ExternalLink,
    FileText,
    Settings,
    Trash2,
    Languages
} from 'lucide-react';

export default function NewsFeed() {
    const [candidates, setCandidates] = useState<NewsCandidate[]>([]);
    const [rssFeeds, setRssFeeds] = useState<string[]>([]);
    const [decisions, setDecisions] = useState<Record<string, 'A'|'B'|'C'>>({});
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [processing, setProcessing] = useState(false);

    // UI states
    const [showManual, setShowManual] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Manual form
    const [manualTitle, setManualTitle] = useState('');
    const [manualUrl, setManualUrl] = useState('');
    const [manualContent, setManualContent] = useState('');

    // RSS form
    const [newRssUrl, setNewRssUrl] = useState('');

    const loadData = async () => {
        setLoading(true);
        const [cData, fData] = await Promise.all([getCandidates(), getRSSFeeds()]);
        setCandidates(cData);
        setRssFeeds(fData);
        // Initialize decisions based on AI evaluation
        const initialDecisions: Record<string, 'A'|'B'|'C'> = {};
        cData.forEach((c: NewsCandidate) => {
            initialDecisions[c.id] = c.evaluation || 'B';
        });
        setDecisions(initialDecisions);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleFetchRSS = async () => {
        setFetching(true);
        await fetchRSSAction();
        await loadData();
        setFetching(false);
    };

    const handleAddRss = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRssUrl) return;
        await addRSSFeed(newRssUrl);
        setNewRssUrl('');
        const updated = await getRSSFeeds();
        setRssFeeds(updated);
    };

    const handleRemoveRss = async (url: string) => {
        await removeRSSFeed(url);
        const updated = await getRSSFeeds();
        setRssFeeds(updated);
    };

    const handleSetDecision = (id: string, val: 'A'|'B'|'C') => {
        setDecisions(prev => ({...prev, [id]: val}));
    };

    const handleAddManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualTitle) return;
        await addManualNews(manualTitle, manualUrl, manualContent);
        setManualTitle('');
        setManualUrl('');
        setManualContent('');
        setShowManual(false);
        loadData();
    };

    const handleProcess = async () => {
        if (candidates.length === 0) return;
        setProcessing(true);
        const decisionsArray = Object.entries(decisions).map(([id, decision]) => ({ id, decision }));
        await processCandidates(decisionsArray);
        await loadData();
        setProcessing(false);
    };

    return (
        <div className="news-feed-container animate-fade-in">
            <div className="feed-header">
                <div className="header-info">
                    <h2><Rss size={20} /> News Feed</h2>
                    <p><Languages size={12} /> Headlines are auto-translated to Japanese.</p>
                </div>
                <div className="header-actions">
                    <button
                        className={`btn-settings ${showSettings ? 'active' : ''}`}
                        onClick={() => {
                            setShowSettings(!showSettings);
                            setShowManual(false);
                        }}
                    >
                        <Settings size={16} /> Manage Feeds
                    </button>
                    <button
                        className="btn-fetch"
                        onClick={handleFetchRSS}
                        disabled={fetching}
                    >
                        {fetching ? <Loader2 className="spin" size={16} /> : <Rss size={16} />}
                        Fetch RSS
                    </button>
                    <button
                        className="btn-add-manual"
                        onClick={() => {
                            setShowManual(!showManual);
                            setShowSettings(false);
                        }}
                    >
                        <Plus size={16} />
                        Manual Add
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="rss-settings glass animate-slide-down">
                    <h3><Settings size={16} /> RSS Feed Subscriptions</h3>
                    <div className="rss-list">
                        {rssFeeds.map((url: string) => (
                            <div key={url} className="rss-item">
                                <Globe size={14} className="icon-url" />
                                <span className="rss-url">{url}</span>
                                <button className="btn-remove-rss" onClick={() => handleRemoveRss(url)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <form className="rss-add-form" onSubmit={handleAddRss}>
                        <input
                            type="text"
                            placeholder="Add new RSS URL..."
                            value={newRssUrl}
                            onChange={e => setNewRssUrl(e.target.value)}
                        />
                        <button type="submit">Add Feed</button>
                    </form>
                </div>
            )}

            {showManual && (
                <form className="manual-form glass animate-slide-down" onSubmit={handleAddManual}>
                    <h3>New Candidate</h3>
                    <div className="form-grid">
                        <div className="field">
                            <label>Title</label>
                            <input
                                type="text"
                                value={manualTitle}
                                onChange={e => setManualTitle(e.target.value)}
                                placeholder="Enter article title..."
                                required
                            />
                        </div>
                        <div className="field">
                            <label>URL (Optional)</label>
                            <input
                                type="text"
                                value={manualUrl}
                                onChange={e => setManualUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <div className="field">
                        <label>Content (Optional)</label>
                        <textarea
                            value={manualContent}
                            onChange={e => setManualContent(e.target.value)}
                            placeholder="Paste article text here..."
                        />
                    </div>
                    <div className="form-actions">
                        <button type="button" onClick={() => setShowManual(false)} className="btn-cancel">Cancel</button>
                        <button type="submit" className="btn-confirm">Add to Feed</button>
                    </div>
                </form>
            )}

            <div className="feed-controls glass">
                <div className="control-left">
                    <span className="selected-count">Total Candidates: {candidates.length}</span>
                </div>
                <button
                    className="btn-process"
                    disabled={candidates.length === 0 || processing}
                    onClick={handleProcess}
                >
                    {processing ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
                    Apply Decisions
                </button>
            </div>

            <div className="candidates-list">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spin" size={32} />
                        <p>Loading candidates...</p>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="empty-state glass">
                        <Globe size={48} opacity={0.3} />
                        <h3>Feed is Empty</h3>
                        <p>No new news found. Try fetching RSS or add manual entries.</p>
                    </div>
                ) : (
                    candidates.map((candidate: NewsCandidate) => (
                        <div
                            key={candidate.id}
                            className={`candidate-card eval-${decisions[candidate.id]} glass`}
                        >
                            <div className="eval-selector" onClick={e => e.stopPropagation()}>
                                <button className={`eval-btn a ${decisions[candidate.id] === 'A' ? 'active' : ''}`} onClick={() => handleSetDecision(candidate.id, 'A')}>A 採用</button>
                                <button className={`eval-btn b ${decisions[candidate.id] === 'B' ? 'active' : ''}`} onClick={() => handleSetDecision(candidate.id, 'B')}>B 保留</button>
                                <button className={`eval-btn c ${decisions[candidate.id] === 'C' ? 'active' : ''}`} onClick={() => handleSetDecision(candidate.id, 'C')}>C 削除</button>
                            </div>
                            <div className="card-content">
                                <h3>{candidate.title}</h3>
                                {candidate.reason && (
                                    <p className="ai-reason"><span className="ai-badge">AI</span>{candidate.reason}</p>
                                )}
                                <div className="card-meta">
                                    {candidate.url && (
                                        <a
                                            href={candidate.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="meta-link"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <LinkIcon size={12} /> Source <ExternalLink size={10} />
                                        </a>
                                    )}
                                    <span className="meta-date"><FileText size={12} /> {candidate.date}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
                .news-feed-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    height: 100%;
                }
                .feed-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header-info h2 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.25rem;
                }
                .header-info p {
                    color: var(--muted);
                    font-size: 0.85rem;
                }
                .header-actions {
                    display: flex;
                    gap: 0.75rem;
                }
                .btn-settings {
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--muted);
                    border: 1px solid var(--border);
                }
                .btn-settings.active {
                    background: rgba(79, 70, 229, 0.1);
                    color: var(--primary);
                    border-color: rgba(79, 70, 229, 0.3);
                }
                .rss-settings {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    border-color: rgba(79, 70, 229, 0.2);
                    background: rgba(79, 70, 229, 0.03);
                }
                .rss-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .rss-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(0,0,0,0.2);
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    border: 1px solid var(--border);
                }
                .rss-url {
                    flex: 1;
                    font-size: 0.85rem;
                    font-family: monospace;
                    color: var(--muted);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .btn-remove-rss {
                    color: #f87171;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                }
                .btn-remove-rss:hover { opacity: 1; }
                .rss-add-form {
                    display: flex;
                    gap: 0.5rem;
                }
                .rss-add-form input {
                    flex: 1;
                    font-size: 0.85rem;
                }
                .rss-add-form button {
                    background: var(--primary);
                    color: white;
                    padding: 0 1rem;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                }
                .btn-fetch, .btn-add-manual {
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .btn-fetch {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }
                .btn-add-manual {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                    border: 1px solid var(--border);
                }
                
                .manual-form {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .field label {
                    font-size: 0.75rem;
                    color: var(--muted);
                    font-weight: 600;
                }
                input, textarea {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    color: white;
                    padding: 0.6rem 0.8rem;
                    font-size: 0.9rem;
                }
                textarea { min-height: 80px; }
                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                }
                .btn-cancel {
                    padding: 0.5rem 1rem;
                    color: var(--muted);
                }
                .btn-confirm {
                    padding: 0.5rem 1.25rem;
                    background: var(--primary);
                    color: white;
                    border-radius: 6px;
                    font-weight: 600;
                }

                .feed-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1.25rem;
                    background: rgba(79, 70, 229, 0.05);
                    border-color: rgba(79, 70, 229, 0.2);
                }
                .control-left {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }
                .select-all-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: transparent;
                    color: white;
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                .selected-count {
                    font-size: 0.85rem;
                    color: var(--primary);
                    font-weight: 700;
                }
                .btn-process {
                    background: var(--primary);
                    color: white;
                    padding: 0.6rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .btn-process:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .candidates-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    padding-bottom: 2rem;
                }
                .candidate-card {
                    display: flex;
                    gap: 1.5rem;
                    padding: 1rem;
                    transition: all 0.2s;
                    border-width: 2px;
                    border-left-width: 4px;
                }
                .candidate-card.eval-A { border-left-color: #10b981; background: rgba(16, 185, 129, 0.03); }
                .candidate-card.eval-B { border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.03); }
                .candidate-card.eval-C { border-left-color: #ef4444; background: rgba(239, 68, 68, 0.03); }
                
                .eval-selector {
                    display: flex;
                    flex-direction: column;
                    gap: 0.3rem;
                    min-width: 80px;
                }
                .eval-btn {
                    padding: 0.3rem;
                    font-size: 0.75rem;
                    border-radius: 4px;
                    border: 1px solid var(--border);
                    background: rgba(0,0,0,0.2);
                    color: var(--muted);
                    font-weight: 600;
                }
                .eval-btn:hover { background: rgba(255,255,255,0.05); }
                .eval-btn.a.active { background: #10b981; color: white; border-color: #10b981; }
                .eval-btn.b.active { background: #f59e0b; color: white; border-color: #f59e0b; }
                .eval-btn.c.active { background: #ef4444; color: white; border-color: #ef4444; }
                
                .ai-reason {
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.8);
                    margin-bottom: 0.5rem;
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                }
                .ai-badge {
                    background: var(--primary);
                    color: white;
                    font-size: 0.6rem;
                    font-weight: 800;
                    padding: 0.1rem 0.3rem;
                    border-radius: 3px;
                }
                .card-content {
                    flex: 1;
                    min-width: 0;
                }
                .card-content h3 {
                    font-size: 1rem;
                    margin-bottom: 0.4rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .card-meta {
                    display: flex;
                    gap: 1.5rem;
                    font-size: 0.75rem;
                    color: var(--muted);
                }
                .meta-link {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    color: var(--primary);
                    text-decoration: none;
                }
                .meta-link:hover { text-decoration: underline; }
                .meta-date {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                }

                .loading-state, .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    padding: 4rem 2rem;
                    text-align: center;
                    color: var(--muted);
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes slide-down {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-down { animation: slide-down 0.3s ease-out; }
            `}</style>
        </div>
    );
}
