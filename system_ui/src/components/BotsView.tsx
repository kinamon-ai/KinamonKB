'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  getBotsData, 
  updateBotAttributes, 
  uploadBotPFP,
  BotAttributes,
  SNSAccount
} from '@/lib/actions';
import { 
  ChevronDown, 
  ChevronUp, 
  Save, 
  Cpu, 
  TrendingUp, 
  Palette, 
  Shield, 
  MessageSquare,
  User,
  RefreshCw,
  Plus,
  Trash2,
  Camera,
  Globe,
  Mail,
  Instagram,
  Twitter,
  ExternalLink,
  Brain,
  Zap,
  Fingerprint
} from 'lucide-react';

type BotInfo = {
  id: string;
  index: number;
  attributes: BotAttributes;
  persona: string;
  memory: string;
  toneVoice: string;
};

const SNS_PLATFORMS = ['X', 'SUNOAI', 'note', 'tictok', 'FB', 'discord', 'telegram', 'spotify', 'youtube'];

export default function BotsView() {
    const [bots, setBots] = useState<BotInfo[]>([]);
    const [expandedBot, setExpandedBot] = useState<string | null>(null);
    const [editAttributes, setEditAttributes] = useState<{[key: string]: BotAttributes}>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        setLoading(true);
        const data = await getBotsData();
        setBots(data.bots);
        
        const attrMap: {[key: string]: BotAttributes} = {};
        data.bots.forEach(bot => {
            attrMap[bot.id] = { ...bot.attributes };
        });
        setEditAttributes(attrMap);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveAttributes = async (botId: string) => {
        setSaving(botId);
        const attrs = editAttributes[botId];
        await updateBotAttributes(botId, attrs);
        
        // Update local bots state
        setBots(prev => prev.map(b => b.id === botId ? { ...b, attributes: attrs } : b));
        setSaving(null);
    };

    const handleFileUpload = async (botId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(botId);
        const formData = new FormData();
        formData.append('image', file);
        formData.append('botId', botId);

        const result = await uploadBotPFP(botId, formData);
        if (result.success && result.path) {
            setEditAttributes(prev => ({
                ...prev,
                [botId]: { ...prev[botId], pfp_path: result.path! }
            }));
            setBots(prev => prev.map(b => b.id === botId ? { 
                ...b, 
                attributes: { ...b.attributes, pfp_path: result.path! } 
            } : b));
        }
        setUploading(null);
    };

    const handleAddSNS = (botId: string) => {
        const current = editAttributes[botId];
        setEditAttributes({
            ...editAttributes,
            [botId]: {
                ...current,
                sns: [...current.sns, { platform: 'X', handle: '', url: '' }]
            }
        });
    };

    const handleRemoveSNS = (botId: string, index: number) => {
        const current = editAttributes[botId];
        const updatedSNS = [...current.sns];
        updatedSNS.splice(index, 1);
        setEditAttributes({
            ...editAttributes,
            [botId]: { ...current, sns: updatedSNS }
        });
    };

    const handleSNSChange = (botId: string, index: number, field: keyof SNSAccount, value: string) => {
        const current = editAttributes[botId];
        const updatedSNS = [...current.sns];
        updatedSNS[index] = { ...updatedSNS[index], [field]: value };
        setEditAttributes({
            ...editAttributes,
            [botId]: { ...current, sns: updatedSNS }
        });
    };

    const handleToneCommentChange = (botId: string, key: string, value: string) => {
        setEditAttributes(prev => {
            const curr = prev[botId] || bots.find(b => b.id === botId)?.attributes;
            if (!curr) return prev;
            return {
                ...prev,
                [botId]: {
                    ...curr,
                    tone_comments: {
                        ...(curr.tone_comments || {}),
                        [key]: value
                    }
                }
            };
        });
    };

    const getBotIcon = (id: string, colorClass: string, size: 'small' | 'medium' | 'large' = 'medium') => {
        const iconClass = `bot-icon-img ${colorClass} icon-${size}`;
        switch(id) {
            case 'bot_01_observer': return <Cpu className={iconClass} />;
            case 'bot_02_trader': return <TrendingUp className={iconClass} />;
            case 'bot_03_creator': return <Palette className={iconClass} />;
            case 'bot_04_auditor': return <Shield className={iconClass} />;
            case 'bot_05_wolf': return <MessageSquare className={iconClass} />;
            default: return <User className={iconClass} />;
        }
    };

    const getColorClass = (id: string) => {
        switch(id) {
            case 'bot_01_observer': return 'fox';
            case 'bot_02_trader': return 'eagle';
            case 'bot_03_creator': return 'cat';
            case 'bot_04_auditor': return 'owl';
            case 'bot_05_wolf': return 'wolf';
            default: return '';
        }
    };

    const parseToneVoice = (md: string) => {
        type ToneKey = keyof NonNullable<BotAttributes['tone_comments']>;
        const sections: { key: ToneKey, title: string, content: string }[] = [
            { key: 'style', title: '言語スタイル', content: '' },
            { key: 'voice', title: '発信トーン (Voice)', content: '' },
            { key: 'excerpts', title: '文体サンプル (Excerpts)', content: '' },
            { key: 'likes', title: '好きな言い回し', content: '' },
            { key: 'dislikes', title: '嫌いな言い回し', content: '' },
        ];
        let currentKey: ToneKey | '' = '';
        const lines = (md || '').split('\n');
        for (const line of lines) {
            if (line.startsWith('## 言語スタイル')) currentKey = 'style';
            else if (line.startsWith('## 発信トーン')) currentKey = 'voice';
            else if (line.startsWith('## 文体サンプル')) currentKey = 'excerpts';
            else if (line.startsWith('## 好きな言い回し')) currentKey = 'likes';
            else if (line.startsWith('## 嫌いな言い回し')) currentKey = 'dislikes';
            else if (currentKey) {
                const sec = sections.find(s => s.key === currentKey);
                if (sec) sec.content += line + '\n';
            }
        }
        return sections;
    };

    if (loading) {
        return (
            <div className="loading-state">
                <RefreshCw className="spin" size={32} />
                <span>Loading Bots Data...</span>
            </div>
        );
    }

    return (
        <div className="bots-view-container animate-fade-in">
            <div className="bots-list">
                {bots.map((bot) => {
                    const attrs = editAttributes[bot.id] || bot.attributes;
                    const colorClass = getColorClass(bot.id);
                    
                    return (
                        <div 
                            key={bot.id} 
                            className={`bot-card glass-morphism ${expandedBot === bot.id ? 'expanded' : ''}`}
                        >
                            <div 
                                className="bot-card-header"
                                onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)}
                            >
                                <div className="bot-identity">
                                    <div className={`bot-pfp-container ${colorClass}-bg ${uploading === bot.id ? 'pulsing' : ''}`}>
                                        {attrs.pfp_path ? (
                                            <img src={attrs.pfp_path} alt="Bot PFP" className="bot-pfp-img" />
                                        ) : (
                                            getBotIcon(bot.id, colorClass, 'medium')
                                        )}
                                        <label className="pfp-hover-overlay">
                                            <Camera size={18} />
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={(e) => handleFileUpload(bot.id, e)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </label>
                                    </div>
                                    <div className="bot-info">
                                        <div className="bot-name-row">
                                            <h3>{attrs.name || bot.id}</h3>
                                        </div>
                                        <div className="bot-meta-badges">
                                            <span className="bot-id-badge">{bot.id}</span>
                                            {attrs.google_account && (
                                                <span className="bot-account-badge">
                                                    <Mail size={10} /> {attrs.google_account}
                                                </span>
                                            )}
                                        </div>
                                        {/* Trait Icons Proposal */}
                                        <div className="bot-traits-row">
                                            <div className="trait-icon-box primary" title="Core Persona">
                                                {getBotIcon(bot.id, colorClass, 'small')}
                                            </div>
                                            <div className="trait-icon-box" title="Attribute: Highly Analytical">
                                                <Brain size={12} className="trait-svg" />
                                            </div>
                                            <div className="trait-icon-box" title="Attribute: Fast Execution">
                                                <Zap size={12} className="trait-svg" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="header-right">
                                    <div className="sns-preview">
                                        {attrs.sns.slice(0, 3).map((s, i) => (
                                            <span key={i} className="sns-tag">{s.platform}</span>
                                        ))}
                                        {attrs.sns.length > 3 && <span className="sns-tag">+{attrs.sns.length - 3}</span>}
                                    </div>
                                    <div className="expand-toggle">
                                        {expandedBot === bot.id ? <ChevronUp /> : <ChevronDown />}
                                    </div>
                                </div>
                            </div>

                            {expandedBot === bot.id && (
                                <div className="bot-card-content">
                                    {/* Action Header */}
                                    <div className="content-actions-header">
                                        <h4>Bot Identity & Attributes</h4>
                                        <button 
                                            className="save-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveAttributes(bot.id);
                                            }}
                                            disabled={saving === bot.id}
                                        >
                                            <Save size={14} />
                                            {saving === bot.id ? 'Saving...' : 'Save All Changes'}
                                        </button>
                                    </div>

                                    {/* Decomposed Form */}
                                    <div className="attributes-grid">
                                        <div className="form-group">
                                            <label>Display Name</label>
                                            <input 
                                                type="text" 
                                                value={attrs.name}
                                                onChange={(e) => setEditAttributes({
                                                    ...editAttributes,
                                                    [bot.id]: { ...attrs, name: e.target.value }
                                                })}
                                                placeholder="Name"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Theme Color (Hex)</label>
                                            <div className="color-input-wrapper">
                                                <input 
                                                    type="color" 
                                                    value={attrs.color || '#4f46e5'}
                                                    onChange={(e) => setEditAttributes({
                                                        ...editAttributes,
                                                        [bot.id]: { ...attrs, color: e.target.value }
                                                    })}
                                                />
                                                <input 
                                                    type="text" 
                                                    value={attrs.color}
                                                    onChange={(e) => setEditAttributes({
                                                        ...editAttributes,
                                                        [bot.id]: { ...attrs, color: e.target.value }
                                                    })}
                                                    className="color-text"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Google Account</label>
                                            <div className="input-with-icon">
                                                <Mail size={14} />
                                                <input 
                                                    type="email" 
                                                    value={attrs.google_account}
                                                    onChange={(e) => setEditAttributes({
                                                        ...editAttributes,
                                                        [bot.id]: { ...attrs, google_account: e.target.value }
                                                    })}
                                                    placeholder="example@gmail.com"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Character / Persona Brief</label>
                                            <input 
                                                type="text" 
                                                value={attrs.character}
                                                onChange={(e) => setEditAttributes({
                                                    ...editAttributes,
                                                    [bot.id]: { ...attrs, character: e.target.value }
                                                })}
                                                placeholder="E.g. Wisdom Fox"
                                            />
                                        </div>
                                        <div className="form-group full-width">
                                            <label>Hobby & Interests</label>
                                            <textarea 
                                                value={attrs.hobby}
                                                onChange={(e) => setEditAttributes({
                                                    ...editAttributes,
                                                    [bot.id]: { ...attrs, hobby: e.target.value }
                                                })}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="form-group full-width">
                                            <label>System Role & Stance</label>
                                            <textarea 
                                                value={attrs.role}
                                                onChange={(e) => setEditAttributes({
                                                    ...editAttributes,
                                                    [bot.id]: { ...attrs, role: e.target.value }
                                                })}
                                                rows={3}
                                            />
                                        </div>
                                    </div>

                                    {/* SNS Manager */}
                                    <div className="sns-manager-section">
                                        <div className="section-subtitle">
                                            <span>Active SNS Activities</span>
                                            <button className="add-sns-btn" onClick={() => handleAddSNS(bot.id)}>
                                                <Plus size={14} /> Add Platform
                                            </button>
                                        </div>
                                        
                                        <div className="sns-list">
                                            {attrs.sns.length === 0 && (
                                                <div className="empty-sns">No SNS accounts registered.</div>
                                            )}
                                            {attrs.sns.map((account, sIdx) => (
                                                <div key={sIdx} className="sns-item-row">
                                                    <select 
                                                        value={account.platform}
                                                        onChange={(e) => handleSNSChange(bot.id, sIdx, 'platform', e.target.value)}
                                                    >
                                                        {SNS_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Handle / ID" 
                                                        value={account.handle}
                                                        onChange={(e) => handleSNSChange(bot.id, sIdx, 'handle', e.target.value)}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Full URL" 
                                                        value={account.url}
                                                        onChange={(e) => handleSNSChange(bot.id, sIdx, 'url', e.target.value)}
                                                        className="url-input"
                                                    />
                                                    <button className="remove-sns-btn" onClick={() => handleRemoveSNS(bot.id, sIdx)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tone & Voice Modifier Section */}
                                    <div className="tone-manager-section">
                                        <div className="section-subtitle">
                                            <span>Tone & Voice Feedback</span>
                                        </div>
                                        <p className="tone-desc">Provide nuance comments to guide the next AI update of the core logic. The left side runs the current rule.</p>
                                        <div className="tone-grid">
                                            {parseToneVoice(bot.toneVoice).map(sec => (
                                                <div key={sec.key} className="tone-row">
                                                    <div className="tone-readonly glass-morphism">
                                                        <h5>{sec.title}</h5>
                                                        <pre>{sec.content.trim() || 'No data'}</pre>
                                                    </div>
                                                    <div className="tone-comment">
                                                        <textarea 
                                                            placeholder={`${sec.title} に対する変更要望や追加ニュアンスを指示...`}
                                                            value={attrs.tone_comments?.[sec.key] || ''}
                                                            onChange={(e) => handleToneCommentChange(bot.id, sec.key, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Persona & Memory Accordions */}
                                    <div className="accordions">
                                        <details className="detail-accordion">
                                            <summary>
                                                <span>Full Persona Logic (persona.md)</span>
                                                <ChevronDown size={14} className="acc-icon" />
                                            </summary>
                                            <div className="details-content">
                                                <pre>{bot.persona || '(No persona data found)'}</pre>
                                            </div>
                                        </details>

                                        <details className="detail-accordion">
                                            <summary>
                                                <span>Recent Growth & Memory (memory.md)</span>
                                                <ChevronDown size={14} className="acc-icon" />
                                            </summary>
                                            <div className="details-content">
                                                <pre>{bot.memory || '(No memory data found)'}</pre>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                .bots-view-container {
                    padding: 1rem 0;
                    width: 100%;
                }
                
                .bots-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .bot-card {
                    border-radius: 20px;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(30, 41, 59, 0.3);
                }
                .bot-card.expanded {
                    background: rgba(30, 41, 59, 0.5);
                    border-color: rgba(255, 255, 255, 0.15);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                }

                .bot-card-header {
                    padding: 1.5rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    user-select: none;
                }
                .bot-card-header:hover {
                    background: rgba(255, 255, 255, 0.03);
                }

                .bot-identity {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .bot-pfp-container {
                    position: relative;
                    width: 64px;
                    height: 64px;
                    min-width: 64px;
                    flex-shrink: 0;
                    border-radius: 50%;
                    background: rgba(15, 23, 42, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    transition: all 0.3s;
                }
                .bot-pfp-container.pulsing {
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(79, 70, 229, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
                }

                .bot-pfp-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .bot-icon-img {
                    opacity: 0.9;
                }
                .icon-small { width: 14px; height: 14px; opacity: 1; }
                .icon-medium { width: 32px; height: 32px; }

                .pfp-hover-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    cursor: pointer;
                    transition: opacity 0.2s;
                    color: white;
                }
                .bot-pfp-container:hover .pfp-hover-overlay {
                    opacity: 1;
                }
                .hidden { display: none; }

                .bot-name-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 0.2rem;
                }
                .bot-info h3 {
                    font-size: 1.35rem;
                    font-weight: 800;
                    color: white;
                    letter-spacing: -0.01em;
                }
                .bot-meta-badges {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .bot-id-badge {
                    font-size: 0.65rem;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 0.15rem 0.6rem;
                    border-radius: 6px;
                    color: rgba(255, 255, 255, 0.4);
                    font-family: 'JetBrains Mono', monospace;
                    text-transform: uppercase;
                }
                .bot-account-badge {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                }

                .bot-traits-row {
                    display: flex;
                    gap: 0.4rem;
                    margin-top: 0.5rem;
                }
                .trait-icon-box {
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .trait-icon-box:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-2px);
                }
                .trait-icon-box.primary {
                    background: rgba(15, 23, 42, 0.4);
                }
                .trait-svg {
                    color: rgba(255, 255, 255, 0.6);
                }

                .header-right {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                }
                .sns-preview {
                    display: flex;
                    gap: 0.5rem;
                }
                .sns-tag {
                    padding: 0.2rem 0.6rem;
                    background: rgba(79, 70, 229, 0.1);
                    color: #818cf8;
                    font-size: 0.7rem;
                    font-weight: 700;
                    border-radius: 6px;
                    border: 1px solid rgba(79, 70, 229, 0.2);
                }

                .bot-card-content {
                    padding: 2.5rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(15, 23, 42, 0.4);
                }

                .content-actions-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2.5rem;
                }
                .content-actions-header h4 {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: white;
                }

                .save-btn {
                    padding: 0.6rem 1.5rem;
                    background: linear-gradient(135deg, #4f46e5, #7c3aed);
                    color: white;
                    border-radius: 12px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    transition: all 0.2s;
                }
                .save-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.4);
                }

                .attributes-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                }
                .form-group.full-width { grid-column: span 2; }
                
                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .form-group input, .form-group textarea, .sns-item-row select, .sns-item-row input {
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 0.8rem 1rem;
                    color: white;
                    font-size: 0.95rem;
                    transition: border-color 0.2s;
                }
                .form-group input:focus { border-color: #4f46e5; outline: none; }

                .color-input-wrapper {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .color-input-wrapper input[type="color"] {
                    width: 36px;
                    height: 36px;
                    padding: 0;
                    border: none;
                    background: none;
                    cursor: pointer;
                    border-radius: 50%;
                    overflow: hidden;
                }
                .color-input-wrapper input[type="color"]::-webkit-color-swatch-wrapper {
                    padding: 0;
                }
                .color-input-wrapper input[type="color"]::-webkit-color-swatch {
                    border: none;
                    border-radius: 50%;
                }
                .color-text { flex: 1; font-family: 'JetBrains Mono', monospace; }

                .input-with-icon {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-with-icon :global(svg) {
                    position: absolute;
                    left: 1rem;
                    color: #64748b;
                }
                .input-with-icon input {
                    width: 100%;
                    padding-left: 2.75rem !important;
                }

                .sns-manager-section {
                    margin-bottom: 3rem;
                    padding: 2rem;
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .section-subtitle {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #94a3b8;
                }
                .add-sns-btn {
                    font-size: 0.8rem;
                    color: #818cf8;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: rgba(129, 140, 248, 0.1);
                    padding: 0.4rem 0.8rem;
                    border-radius: 8px;
                }

                .sns-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .sns-item-row {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .sns-item-row select { width: 120px; }
                .sns-item-row input { flex: 1; }
                .url-input { flex: 2 !important; }
                .remove-sns-btn {
                    padding: 0.6rem;
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                    border-radius: 8px;
                }

                .tone-manager-section {
                    margin-bottom: 3rem;
                }
                .tone-desc {
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.4);
                    margin-bottom: 1.5rem;
                    margin-top: -0.5rem;
                }
                .tone-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .tone-row {
                    display: flex;
                    gap: 1.5rem;
                    align-items: stretch;
                }
                .tone-readonly {
                    flex: 1;
                    padding: 1.25rem;
                    border-radius: 12px;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .tone-readonly h5 {
                    font-size: 0.85rem;
                    color: #818cf8;
                    margin-bottom: 0.75rem;
                }
                .tone-comment {
                    flex: 1;
                    display: flex;
                }
                .tone-comment textarea {
                    width: 100%;
                    resize: vertical;
                    min-height: 100px;
                    background: rgba(79, 70, 229, 0.05);
                    border: 1px dashed rgba(79, 70, 229, 0.3);
                    border-radius: 12px;
                    padding: 1rem;
                    color: white;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .tone-comment textarea:focus {
                    background: rgba(79, 70, 229, 0.1);
                    border-style: solid;
                    outline: none;
                }

                .accordions {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .detail-accordion {
                    border-radius: 12px;
                    background: rgba(0, 0, 0, 0.2);
                }
                .detail-accordion summary {
                    padding: 1rem 1.5rem;
                    cursor: pointer;
                    list-style: none;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #64748b;
                }
                .acc-icon { transition: transform 0.3s; }
                .detail-accordion[open] .acc-icon { transform: rotate(180deg); }
                .details-content {
                    padding: 1.5rem;
                    max-height: 400px;
                    overflow-y: auto;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }
                .details-content pre {
                    font-size: 0.85rem;
                    color: #94a3b8;
                    font-family: 'JetBrains Mono', monospace;
                    line-height: 1.6;
                }

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 500px;
                    gap: 1.5rem;
                    color: rgba(255, 255, 255, 0.4);
                }
                .spin { animation: spin 1s linear infinite; color: #4f46e5; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .fox-bg { box-shadow: 0 0 0 4px rgba(30, 41, 59, 0.8), 0 0 0 7px #f97316; }
                .eagle-bg { box-shadow: 0 0 0 4px rgba(30, 41, 59, 0.8), 0 0 0 7px #fbbf24; }
                .cat-bg { box-shadow: 0 0 0 4px rgba(30, 41, 59, 0.8), 0 0 0 7px #d946ef; }
                .owl-bg { box-shadow: 0 0 0 4px rgba(30, 41, 59, 0.8), 0 0 0 7px #10b981; }
                .wolf-bg { box-shadow: 0 0 0 4px rgba(30, 41, 59, 0.8), 0 0 0 7px #3b82f6; }
                
                .fox-bg :global(svg) { color: #f97316; }
                .eagle-bg :global(svg) { color: #fbbf24; }
                .cat-bg :global(svg) { color: #d946ef; }
                .owl-bg :global(svg) { color: #10b981; }
                .wolf-bg :global(svg) { color: #3b82f6; }

                .tone-readonly pre {
                    font-size: 0.8rem;
                    color: #cbd5e1;
                    white-space: pre-wrap;
                    line-height: 1.5;
                    font-family: 'Inter', sans-serif;
                }

                @media (max-width: 1024px) {
                    .attributes-grid {
                        grid-template-columns: 1fr;
                    }
                    .form-group.full-width {
                        grid-column: 1;
                    }
                    .tone-row {
                        flex-direction: column;
                    }
                    .bot-card-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1.25rem;
                    }
                    .bot-card-content {
                        padding: 1.5rem;
                    }
                    .header-right {
                        width: 100%;
                        justify-content: space-between;
                        padding-left: 0.5rem;
                    }
                    .sns-item-row {
                        flex-wrap: wrap;
                    }
                    .sns-item-row select, .sns-item-row input {
                        width: 100%;
                        flex: 1 1 100%;
                    }
                    .url-input {
                        flex: 1 1 100% !important;
                    }
                }
            `}</style>
        </div>
    );
}
