'use client';

import { useState, useEffect } from 'react';
import { IdentityProposal, getIdentityProposals, applyProposalToPersona } from '@/lib/actions';
import { Brain, CheckCircle, XCircle, ChevronDown, ChevronUp, FileText, Loader } from 'lucide-react';

// Parse proposal content into individual items based on ## 提案 N: headings
function parseProposalItems(content: string): { title: string; body: string }[] {
    const sections = content.split(/^## 提案 \d+:/m).slice(1);
    const headers = [...content.matchAll(/^## 提案 \d+: (.+)$/gm)].map(m => m[1]);
    return sections.map((body, i) => ({
        title: headers[i] || `提案 ${i + 1}`,
        body: body.trim(),
    }));
}

export default function IdentityView() {
    const [proposals, setProposals] = useState<IdentityProposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProposal, setSelectedProposal] = useState<IdentityProposal | null>(null);
    const [itemStates, setItemStates] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState(false);

    useEffect(() => {
        getIdentityProposals().then(data => {
            setProposals(data);
            if (data.length > 0) setSelectedProposal(data[0]);
            setLoading(false);
        });
    }, []);

    // Reset states when proposal changes
    useEffect(() => {
        if (!selectedProposal) return;
        const items = parseProposalItems(selectedProposal.content);
        const initial: Record<string, 'pending' | 'approved' | 'rejected'> = {};
        const expanded: Record<string, boolean> = {};
        items.forEach((item, i) => {
            initial[i] = 'pending';
            expanded[i] = true;
        });
        setItemStates(initial);
        setExpandedItems(expanded);
        setApplied(false);
    }, [selectedProposal?.id]);

    const toggleExpand = (idx: number) => {
        setExpandedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const handleApprove = (idx: number) => {
        setItemStates(prev => ({ ...prev, [idx]: prev[idx] === 'approved' ? 'pending' : 'approved' }));
    };
    const handleReject = (idx: number) => {
        setItemStates(prev => ({ ...prev, [idx]: prev[idx] === 'rejected' ? 'pending' : 'rejected' }));
    };

    const handleApply = async () => {
        if (!selectedProposal) return;
        const items = parseProposalItems(selectedProposal.content);
        const approvedTexts = items
            .filter((_, i) => itemStates[i] === 'approved')
            .map(item => `**${item.title}**\n${item.body}`);

        if (approvedTexts.length === 0) return;

        setApplying(true);
        await applyProposalToPersona(selectedProposal.id, approvedTexts);
        setApplying(false);
        setApplied(true);
        // Refresh proposal list
        const fresh = await getIdentityProposals();
        setProposals(fresh);
        setSelectedProposal(fresh[0] ?? null);
    };

    const approvedCount = Object.values(itemStates).filter(s => s === 'approved').length;
    const pendingCount = Object.values(itemStates).filter(s => s === 'pending').length;

    if (loading) {
        return (
            <div className="identity-loading">
                <Loader size={32} className="spin" />
                <p>提案を読み込み中...</p>
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <div className="identity-empty glass animate-fade-in">
                <Brain size={48} className="brain-icon" />
                <h2>提案はまだありません</h2>
                <p>サイドバーの「Analyze Identity」ボタンを押すと、蓄積された選択パターンから <strong>Kina Fox</strong> への更新提案が生成されます。</p>
            </div>
        );
    }

    const items = selectedProposal ? parseProposalItems(selectedProposal.content) : [];

    return (
        <div className="identity-view animate-fade-in">
            {/* Proposal selector */}
            {proposals.length > 1 && (
                <div className="proposal-tabs glass">
                    {proposals.map(p => (
                        <div
                            key={p.id}
                            className={`proposal-tab ${selectedProposal?.id === p.id ? 'active' : ''} ${p.id.startsWith('applied_') ? 'applied' : ''}`}
                            onClick={() => setSelectedProposal(p)}
                        >
                            {p.id.startsWith('applied_') ? '✅' : '📋'} {p.date}
                        </div>
                    ))}
                </div>
            )}

            {selectedProposal && (
                <>
                    <div className="proposal-header">
                        <div>
                            <h2 className="gradient-text">Identity Proposal</h2>
                            <p className="proposal-meta">{selectedProposal.date} 生成 · {items.length} 件の提案</p>
                        </div>
                        <div className={`applied-badge ${applied || selectedProposal.id.startsWith('applied_') ? 'show' : ''}`}>
                            Applied ✅
                        </div>
                    </div>

                    {/* Status bar */}
                    <div className="status-bar glass">
                        <span className="approved-count">✅ 承認: {approvedCount}件</span>
                        <span className="pending-count">⏳ 未判断: {pendingCount}件</span>
                        <span className="rejected-count">❌ 棄却: {Object.values(itemStates).filter(s => s === 'rejected').length}件</span>
                    </div>

                    {/* Proposal items */}
                    <div className="items-list">
                        {items.map((item, idx) => (
                            <div key={idx} className={`proposal-item glass ${itemStates[idx]}`}>
                                <div className="item-header" onClick={() => toggleExpand(idx)}>
                                    <div className="item-status-indicator" />
                                    <h3>{item.title}</h3>
                                    <div className="item-actions">
                                        <button
                                            className={`action-btn approve ${itemStates[idx] === 'approved' ? 'active' : ''}`}
                                            onClick={e => { e.stopPropagation(); handleApprove(idx); }}
                                            disabled={applied || selectedProposal.id.startsWith('applied_')}
                                            title="承認"
                                        >
                                            <CheckCircle size={20} />
                                        </button>
                                        <button
                                            className={`action-btn reject ${itemStates[idx] === 'rejected' ? 'active' : ''}`}
                                            onClick={e => { e.stopPropagation(); handleReject(idx); }}
                                            disabled={applied || selectedProposal.id.startsWith('applied_')}
                                            title="棄却"
                                        >
                                            <XCircle size={20} />
                                        </button>
                                        {expandedItems[idx] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>
                                {expandedItems[idx] && (
                                    <div className="item-body">
                                        <pre>{item.body}</pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Final apply button */}
                    {!applied && !selectedProposal.id.startsWith('applied_') && (
                        <div className="apply-section glass">
                            <div className="apply-warning">
                                <FileText size={16} />
                                <span>承認した <strong>{approvedCount}件</strong> の提案を <code>persona.md</code> に反映します。この操作は元に戻せません。</span>
                            </div>
                            <button
                                className="apply-btn"
                                disabled={approvedCount === 0 || applying}
                                onClick={handleApply}
                            >
                                {applying ? <><Loader size={16} className="spin" /> 適用中...</> : <><CheckCircle size={18} /> persona.md に適用</>}
                            </button>
                        </div>
                    )}
                </>
            )}

            <style jsx>{`
        .identity-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .identity-loading, .identity-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          padding: 4rem 2rem;
          text-align: center;
        }
        .identity-empty h2 { font-size: 1.4rem; margin-bottom: 0.5rem; }
        .identity-empty p { color: var(--muted); max-width: 400px; line-height: 1.6; }
        .brain-icon { color: #a855f7; }
        .spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .proposal-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem;
          flex-wrap: wrap;
        }
        .proposal-tab {
          padding: 0.4rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--muted);
          transition: all 0.2s;
        }
        .proposal-tab.active {
          background: rgba(168, 85, 247, 0.15);
          color: #a855f7;
          font-weight: 600;
        }
        .proposal-tab.applied { opacity: 0.5; }

        .proposal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .proposal-header h2 { font-size: 1.8rem; }
        .proposal-meta { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; }
        .applied-badge {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 0.3rem 0.8rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 700;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .applied-badge.show { opacity: 1; }

        .status-bar {
          display: flex;
          gap: 1.5rem;
          padding: 0.75rem 1.25rem;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .approved-count { color: #10b981; }
        .pending-count { color: #f59e0b; }
        .rejected-count { color: #ef4444; }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .proposal-item {
          overflow: hidden;
          transition: all 0.3s;
          border: 2px solid transparent;
        }
        .proposal-item.approved {
          border-color: rgba(16, 185, 129, 0.4);
          background: rgba(16, 185, 129, 0.04);
        }
        .proposal-item.rejected {
          border-color: rgba(239, 68, 68, 0.3);
          opacity: 0.55;
        }
        .item-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1.25rem 1.5rem;
          cursor: pointer;
          user-select: none;
        }
        .item-status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #a855f7;
          flex-shrink: 0;
        }
        .proposal-item.approved .item-status-indicator { background: #10b981; }
        .proposal-item.rejected .item-status-indicator { background: #ef4444; }
        .item-header h3 { flex: 1; font-size: 1rem; }
        .item-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--muted);
        }
        .action-btn {
          background: transparent;
          padding: 4px;
          color: var(--muted);
          transition: color 0.2s;
        }
        .action-btn.approve:hover, .action-btn.approve.active { color: #10b981; }
        .action-btn.reject:hover, .action-btn.reject.active { color: #ef4444; }
        .item-body {
          padding: 0 1.5rem 1.25rem;
          border-top: 1px solid var(--border);
          padding-top: 1rem;
        }
        .item-body pre {
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--font-family);
          font-size: 0.9rem;
          color: var(--muted);
          line-height: 1.7;
        }

        .apply-section {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          border: 1px solid rgba(168, 85, 247, 0.2);
        }
        .apply-warning {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--muted);
          font-size: 0.9rem;
        }
        .apply-warning strong { color: white; }
        .apply-warning code {
          background: rgba(255,255,255,0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.85em;
        }
        .apply-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: white;
          padding: 0.75rem 2rem;
          font-weight: 700;
          font-size: 1rem;
          white-space: nowrap;
        }
        .apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .apply-btn:not(:disabled):hover { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); }
      `}</style>
        </div>
    );
}
