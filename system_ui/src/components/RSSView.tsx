'use client';

import { useState, useEffect } from 'react';
import { getRSSSources, getRSSSourceContent, deleteRSSSource, RSSSourceFile } from '@/lib/actions';
import { FileCode, Trash2, RefreshCw, Clock, ExternalLink, Database, Search, FileText, Code } from 'lucide-react';

export default function RSSView() {
    const [sources, setSources] = useState<RSSSourceFile[]>([]);
    const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSources = async () => {
        setIsLoading(true);
        const data = await getRSSSources();
        setSources(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchSources();
    }, []);

    const handleSelectFile = async (filename: string) => {
        setSelectedFilename(filename);
        setIsLoading(true);
        try {
            const data = await getRSSSourceContent(filename);
            setContent(data);
        } catch (e) {
            setContent('Failed to load content.');
        }
        setIsLoading(false);
    };

    const handleDelete = async (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this XML source?')) return;
        await deleteRSSSource(filename);
        if (selectedFilename === filename) {
            setSelectedFilename(null);
            setContent('');
        }
        fetchSources();
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (dateStr: string) => {
        if (dateStr.length !== 8) return dateStr;
        return `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
    };

    const formatTime = (timeStr: string) => {
        if (timeStr.length !== 6) return timeStr;
        return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
    };

    const filteredSources = sources.filter(s => 
        s.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.feedUrl.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="rss-view animate-fade-in">
            <div className="rss-sidebar">
                <div className="sidebar-header glass">
                    <div className="title-area">
                        <Database size={18} className="text-secondary" />
                        <h3>RSS Raw Sources</h3>
                    </div>
                    <button className="btn-icon" onClick={fetchSources} title="Refresh">
                        <RefreshCw size={14} className={isLoading && !selectedFilename ? 'spin' : ''} />
                    </button>
                </div>

                <div className="search-box glass">
                    <Search size={14} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search feeds..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="source-list">
                    {filteredSources.length === 0 ? (
                        <div className="empty-list">
                            <FileCode size={32} opacity={0.2} />
                            <p>No XML files found.</p>
                        </div>
                    ) : (
                        filteredSources.map((source) => (
                            <div 
                                key={source.id} 
                                className={`source-item glass ${selectedFilename === source.filename ? 'active' : ''}`}
                                onClick={() => handleSelectFile(source.filename)}
                            >
                                <div className="item-main">
                                    <div className="item-info">
                                        <span className="feed-url" title={source.feedUrl}>
                                            {source.feedUrl.replace('https://', '').replace('www.', '')}
                                        </span>
                                        <div className="meta-row">
                                            <span className="timestamp">
                                                <Clock size={10} />
                                                {formatDate(source.date)} {formatTime(source.time)}
                                            </span>
                                            <span className="size">{formatSize(source.size)}</span>
                                        </div>
                                    </div>
                                    <button 
                                        className="delete-btn" 
                                        onClick={(e) => handleDelete(source.filename, e)}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="rss-viewer glass">
                {selectedFilename ? (
                    <div className="viewer-container">
                        <div className="viewer-header">
                            <div className="file-info">
                                <Code size={16} className="text-primary" />
                                <h4>{selectedFilename}</h4>
                            </div>
                            <div className="header-actions">
                                <span className="format-badge">XML</span>
                            </div>
                        </div>
                        <div className="content-area">
                            {isLoading ? (
                                <div className="loading-overlay">
                                    <RefreshCw className="spin" />
                                    <span>Retrieving raw data...</span>
                                </div>
                            ) : (
                                <pre className="xml-preview">
                                    <code>{content}</code>
                                </pre>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="viewer-placeholder">
                        <FileText size={64} opacity={0.05} />
                        <h3>Select a source to view raw XML</h3>
                        <p>Detailed FetchRSS behavior is preserved here for debugging and analysis.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .rss-view {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    gap: 1.5rem;
                    height: calc(100vh - 180px);
                    max-width: 1600px;
                    margin: 0 auto;
                }

                /* Sidebar */
                .rss-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    height: 100%;
                }
                .sidebar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                }
                .title-area {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }
                .title-area h3 {
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    padding: 0.6rem 0.8rem;
                    border-radius: 10px;
                    gap: 0.6rem;
                }
                .search-box input {
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 0.85rem;
                    width: 100%;
                    outline: none;
                }
                .search-icon { color: var(--muted); }

                .source-list {
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                    padding-right: 0.4rem;
                }
                .source-list::-webkit-scrollbar { width: 4px; }
                .source-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

                .source-item {
                    padding: 0.75rem;
                    border-radius: 10px;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                }
                .source-item:hover {
                    background: rgba(255,255,255,0.05);
                    transform: translateX(4px);
                }
                .source-item.active {
                    background: rgba(var(--primary-rgb), 0.1);
                    border-color: rgba(var(--primary-rgb), 0.3);
                }
                .item-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.5rem;
                }
                .item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    overflow: hidden;
                }
                .feed-url {
                    font-size: 0.8rem;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: var(--secondary);
                }
                .meta-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 0.7rem;
                    color: var(--muted);
                }
                .timestamp {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
                .delete-btn {
                    background: transparent;
                    border: none;
                    color: var(--muted);
                    padding: 0.25rem;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.2s;
                }
                .source-item:hover .delete-btn { opacity: 1; }
                .delete-btn:hover { color: #f87171; }

                /* Viewer */
                .rss-viewer {
                    border-radius: 12px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    background: rgba(2, 6, 23, 0.4);
                }
                .viewer-placeholder {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: var(--muted);
                    gap: 1rem;
                    text-align: center;
                }
                .viewer-placeholder h3 { font-size: 1.1rem; color: #94a3b8; }
                .viewer-placeholder p { font-size: 0.85rem; max-width: 300px; line-height: 1.5; }

                .viewer-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .viewer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .file-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .file-info h4 { margin: 0; font-size: 0.95rem; font-family: 'JetBrains Mono', monospace; }
                .format-badge {
                    background: rgba(14, 165, 233, 0.2);
                    color: #38bdf8;
                    font-size: 0.65rem;
                    font-weight: 800;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                }

                .content-area {
                    flex: 1;
                    overflow: auto;
                    position: relative;
                }
                .xml-preview {
                    margin: 0;
                    padding: 1.5rem;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 0.85rem;
                    line-height: 1.6;
                    color: #cbd5e1;
                }
                .xml-preview code {
                    display: block;
                    white-space: pre-wrap;
                    word-break: break-all;
                }

                .loading-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(2, 6, 23, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    z-index: 10;
                }

                .empty-list {
                    padding: 3rem 1rem;
                    text-align: center;
                    color: var(--muted);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }
                .empty-list p { font-size: 0.85rem; }

                .btn-icon {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: var(--muted);
                    padding: 0.4rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-icon:hover { background: rgba(255,255,255,0.1); color: white; }
                .spin { animation: spin 2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
