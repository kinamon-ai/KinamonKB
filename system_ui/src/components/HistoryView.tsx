'use client';

import { useState, useEffect } from 'react';
import {
    HistoryItem,
    getHistory,
    restoreFromTrash,
    deleteFromTrash
} from '@/lib/actions';
import {
    CheckCircle,
    Trash2,
    ExternalLink,
    RotateCcw,
    X,
    Share2,
    Calendar,
    Bot,
    Loader2,
    Archive,
    Filter
} from 'lucide-react';

type HistoryFilter = 'all' | 'decided' | 'trash';

export default function HistoryView() {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<HistoryFilter>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const loadHistory = async () => {
        setLoading(true);
        const data = await getHistory(filter);
        setItems(data);
        setLoading(false);
    };

    useEffect(() => {
        loadHistory();
    }, [filter]);

    const handleRestore = async (id: string) => {
        if (!confirm('この記事を元の場所に戻しますか？')) return;
        await restoreFromTrash(id);
        loadHistory();
    };

    const handlePermanentDelete = async (id: string) => {
        if (!confirm('完全に削除しますか？この操作は取り消せません。')) return;
        await deleteFromTrash(id);
        loadHistory();
    };

    const decidedCount = items.filter(i => i.type === 'decided').length;
    const trashCount = items.filter(i => i.type === 'trash').length;

    return (
        <div className="history-container animate-fade-in">
            <div className="history-header">
                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <Archive size={14} /> All
                        <span className="tab-count">{decidedCount + trashCount}</span>
                    </button>
                    <button
                        className={`filter-tab decided ${filter === 'decided' ? 'active' : ''}`}
                        onClick={() => setFilter('decided')}
                    >
                        <CheckCircle size={14} /> Posted
                        {decidedCount > 0 && <span className="tab-count">{decidedCount}</span>}
                    </button>
                    <button
                        className={`filter-tab trash ${filter === 'trash' ? 'active' : ''}`}
                        onClick={() => setFilter('trash')}
                    >
                        <Trash2 size={14} /> Trash
                        {trashCount > 0 && <span className="tab-count">{trashCount}</span>}
                    </button>
                </div>
            </div>

            <div className="history-list">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spin" size={32} />
                        <p>Loading history...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="empty-state glass">
                        <Archive size={48} opacity={0.3} />
                        <h3>No History Yet</h3>
                        <p>{filter === 'trash' ? 'Trash is empty.' : 'No completed tasks found.'}</p>
                    </div>
                ) : (
                    items.map(item => (
                        <div
                            key={`${item.type}-${item.id}`}
                            className={`history-card glass ${item.type === 'trash' ? 'trash-card' : 'decided-card'} ${expandedId === item.id ? 'expanded' : ''}`}
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        >
                            <div className="card-row">
                                <div className="card-icon">
                                    {item.type === 'decided' ? (
                                        item.tweetId
                                            ? <Share2 size={16} className="icon-posted" />
                                            : <CheckCircle size={16} className="icon-decided" />
                                    ) : (
                                        <Trash2 size={16} className="icon-trash" />
                                    )}
                                </div>
                                <div className="card-main">
                                    <h3>{item.title}</h3>
                                    <div className="card-meta">
                                        <span><Calendar size={12} /> {item.date}</span>
                                        {item.bot && <span><Bot size={12} /> {item.bot}</span>}
                                        {item.type === 'decided' && item.choice && (
                                            <span className="choice-badge">{item.choice}案</span>
                                        )}
                                        {item.tweetId && (
                                            <a
                                                href={`https://x.com/i/web/status/${item.tweetId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="tweet-link"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Share2 size={10} /> View on X <ExternalLink size={10} />
                                            </a>
                                        )}
                                        {item.type === 'trash' && (
                                            <span className="trash-badge">
                                                {item.trashedFrom ? `from ${item.trashedFrom}` : 'trashed'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {expandedId === item.id && (
                                <div className="card-expanded animate-slide-down" onClick={e => e.stopPropagation()}>
                                    {item.finalPost && (
                                        <div className="expanded-section">
                                            <label>Final Post</label>
                                            <blockquote>{item.finalPost}</blockquote>
                                        </div>
                                    )}
                                    {item.feedback && (
                                        <div className="expanded-section">
                                            <label>Feedback</label>
                                            <p>{item.feedback}</p>
                                        </div>
                                    )}
                                    <div className="expanded-meta">
                                        {item.approvedAt && <span>Approved: {item.approvedAt}</span>}
                                        {item.postedAt && <span>Posted: {item.postedAt}</span>}
                                        {item.sourceUrl && (
                                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="source-link">
                                                Source <ExternalLink size={10} />
                                            </a>
                                        )}
                                    </div>
                                    {item.type === 'trash' && (
                                        <div className="trash-actions">
                                            <button className="btn-restore" onClick={() => handleRestore(item.id)}>
                                                <RotateCcw size={14} /> Restore
                                            </button>
                                            <button className="btn-permanent-delete" onClick={() => handlePermanentDelete(item.id)}>
                                                <X size={14} /> Delete Permanently
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
                .history-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    height: 100%;
                }
                .filter-tabs {
                    display: flex;
                    gap: 0.5rem;
                }
                .filter-tab {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--muted);
                    background: rgba(255,255,255,0.03);
                    border: 1px solid var(--border);
                    transition: all 0.2s;
                }
                .filter-tab:hover { background: rgba(255,255,255,0.06); }
                .filter-tab.active {
                    background: rgba(79, 70, 229, 0.1);
                    color: var(--primary);
                    border-color: rgba(79, 70, 229, 0.3);
                }
                .filter-tab.decided.active {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border-color: rgba(16, 185, 129, 0.3);
                }
                .filter-tab.trash.active {
                    background: rgba(248, 113, 113, 0.1);
                    color: #f87171;
                    border-color: rgba(248, 113, 113, 0.3);
                }
                .tab-count {
                    font-size: 0.7rem;
                    background: rgba(255,255,255,0.1);
                    padding: 0.1rem 0.4rem;
                    border-radius: 8px;
                    min-width: 18px;
                    text-align: center;
                }

                .history-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    padding-bottom: 2rem;
                }
                .history-card {
                    padding: 1rem 1.25rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border-left-width: 3px;
                    border-left-style: solid;
                }
                .history-card:hover {
                    transform: translateY(-1px);
                    background: rgba(255,255,255,0.04);
                }
                .decided-card { border-left-color: #10b981; }
                .trash-card { border-left-color: #f87171; }
                .history-card.expanded {
                    background: rgba(255,255,255,0.03);
                }

                .card-row {
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }
                .card-icon {
                    padding-top: 0.15rem;
                    flex-shrink: 0;
                }
                .icon-posted { color: #1da1f2; }
                .icon-decided { color: #10b981; }
                .icon-trash { color: #f87171; opacity: 0.7; }
                .card-main {
                    flex: 1;
                    min-width: 0;
                }
                .card-main h3 {
                    font-size: 0.95rem;
                    margin-bottom: 0.35rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .card-meta {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.75rem;
                    color: var(--muted);
                    flex-wrap: wrap;
                    align-items: center;
                }
                .card-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
                .choice-badge {
                    background: rgba(79, 70, 229, 0.15);
                    color: var(--primary);
                    padding: 0.1rem 0.4rem;
                    border-radius: 4px;
                    font-weight: 700;
                    font-size: 0.7rem;
                }
                .trash-badge {
                    background: rgba(248, 113, 113, 0.1);
                    color: #f87171;
                    padding: 0.1rem 0.4rem;
                    border-radius: 4px;
                    font-size: 0.7rem;
                }
                .tweet-link {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: #1da1f2;
                    text-decoration: none;
                    font-weight: 600;
                }
                .tweet-link:hover { text-decoration: underline; }

                .card-expanded {
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .expanded-section label {
                    font-size: 0.7rem;
                    color: var(--muted);
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05rem;
                    display: block;
                    margin-bottom: 0.3rem;
                }
                .expanded-section blockquote {
                    border-left: 3px solid var(--primary);
                    padding-left: 0.75rem;
                    color: rgba(255,255,255,0.85);
                    font-size: 0.9rem;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    margin: 0;
                }
                .expanded-section p {
                    font-size: 0.85rem;
                    color: var(--muted);
                }
                .expanded-meta {
                    display: flex;
                    gap: 1.5rem;
                    font-size: 0.75rem;
                    color: var(--muted);
                    flex-wrap: wrap;
                }
                .source-link {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: var(--primary);
                    text-decoration: none;
                }
                .source-link:hover { text-decoration: underline; }

                .trash-actions {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 0.25rem;
                }
                .btn-restore {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.25);
                    transition: all 0.2s;
                }
                .btn-restore:hover {
                    background: rgba(16, 185, 129, 0.2);
                }
                .btn-permanent-delete {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #f87171;
                    background: transparent;
                    border: 1px solid rgba(248, 113, 113, 0.15);
                    transition: all 0.2s;
                }
                .btn-permanent-delete:hover {
                    background: rgba(248, 113, 113, 0.1);
                    border-color: rgba(248, 113, 113, 0.3);
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
