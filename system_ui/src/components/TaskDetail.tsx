'use client';

import { useState, useEffect } from 'react';
import { Task, decideTask, holdTask, postToX } from '@/lib/actions';
import { Send, Clock, Edit3, Pause, RotateCcw, Share2 } from 'lucide-react';

export default function TaskDetail({ task, onComplete, fromHeld = false, fromQueue = false }: { task: Task, onComplete: () => void, fromHeld?: boolean, fromQueue?: boolean }) {
  const [choice, setChoice] = useState<'A' | 'B' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [postEdit, setPostEdit] = useState('');
  const [includeLink, setIncludeLink] = useState(true);
  const [hashtags, setHashtags] = useState('#KinamonKB #AI');
  const [forceUnique, setForceUnique] = useState(false);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<{ tweetId?: string; error?: string } | null>(null);

  const extractChoice = (id: 'A' | 'B') => {
    const regex = new RegExp(`### 【${id}案】(.*?)\n([\\s\\S]*?)(?=\\n###|$)`, 'i');
    const match = task.content.match(regex);
    return {
      title: match?.[1] || `${id}案`,
      details: match?.[2] || 'Details not found',
      post: task.content.match(new RegExp(`> (.*)`, 'g'))?.[id === 'A' ? 0 : 1]?.replace('> ', '') || ''
    };
  };

  const choiceA = extractChoice('A');
  const choiceB = extractChoice('B');

  // Extract source URL from the header
  const getSourceUrl = () => {
    const match = task.content.match(/\*\*ソースURL\*\*: `?(https?:\/\/[^\s`]+)`?/);
    return match ? match[1] : '';
  };

  const constructFullPost = (body: string, showLink: boolean, tags: string, unique: boolean) => {
    const link = getSourceUrl();
    let full = body.trim();
    if (showLink && link) {
      full += `\n\n${link}`;
    }
    if (tags.trim()) {
      full += `\n\n${tags.trim()}`;
    }
    if (unique) {
      // Add a small timestamp for uniqueness
      const now = new Date();
      full += `\n\n[ID: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}]`;
    }
    return full;
  };

  // Load existing selection if in Queue mode
  useEffect(() => {
    if (fromQueue) {
      const selectedMatch = task.content.match(/- \*\*選択\*\*: ([AB])/);
      const postMatch = task.content.match(/- \*\*最終ポスト\*\*: \n> ([\s\S]*?)(?=\n- \*\*コメント\*\*|$)/);
      const feedbackMatch = task.content.match(/- \*\*コメント\*\*: (.*)/);

      const selected = selectedMatch?.[1] as 'A' | 'B' | null;
      setChoice(selected);
      if (postMatch) {
        const fullPost = postMatch[1].split('\n').map(line => line.replace(/^> /, '')).join('\n').trim();
        setPostEdit(fullPost);

        // Try to reverse engineer what's what to keep UI sync
        const link = getSourceUrl();
        setIncludeLink(fullPost.includes(link));
      }
      if (feedbackMatch) {
        setFeedback(feedbackMatch[1]);
      }
    } else {
      // Reset for pending
      setChoice(null);
      setFeedback('');
      setPostEdit('');
      setIncludeLink(true);
      setForceUnique(false);
    }
  }, [task.id, fromQueue]);

  const handleChoiceSelect = (id: 'A' | 'B') => {
    if (fromQueue) return;
    setChoice(id);
    const basePost = id === 'A' ? choiceA.post : choiceB.post;
    setPostEdit(constructFullPost(basePost, includeLink, hashtags, forceUnique));
  };

  const handleLinkToggle = (val: boolean) => {
    setIncludeLink(val);
    if (!choice) return;
    const basePost = choice === 'A' ? choiceA.post : choiceB.post;
    setPostEdit(constructFullPost(basePost, val, hashtags, forceUnique));
  };

  const handleHashtagsChange = (val: string) => {
    setHashtags(val);
    if (!choice) return;
    const basePost = choice === 'A' ? choiceA.post : choiceB.post;
    setPostEdit(constructFullPost(basePost, includeLink, val, forceUnique));
  };

  const handleUniqueToggle = (val: boolean) => {
    setForceUnique(val);
    if (!choice) return;
    const basePost = choice === 'A' ? choiceA.post : choiceB.post;
    setPostEdit(constructFullPost(basePost, includeLink, hashtags, val));
  };

  const getXLength = (text: string) => {
    // X counts any URL (starting with http:// or https://) as 23 characters
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    let length = text.replace(urlRegex, '').length;
    length += urls.length * 23;
    return length;
  };

  const handleDecide = async () => {
    if (!choice || fromQueue) return;
    setLoading(true);
    await decideTask(task.id, choice, feedback, postEdit, fromHeld);
    setLoading(false);
    onComplete();
  };

  const handleHold = async () => {
    setHolding(true);
    let source: 'pending' | 'held' | 'queue' = 'pending';
    if (fromHeld) source = 'held';
    if (fromQueue) source = 'queue';

    await holdTask(task.id, source);
    setHolding(false);
    onComplete();
  };

  const handlePost = async () => {
    if (!fromQueue || !postEdit) return;
    setPosting(true);
    setPostResult(null);
    const result = await postToX(task.id, task.bot, postEdit);
    setPosting(false);
    if (result.success) {
      setPostResult({ tweetId: result.tweetId });
      setTimeout(() => onComplete(), 2000);
    } else {
      setPostResult({ error: result.error });
    }
  };

  return (
    <div className="task-detail animate-fade-in">
      <div className="detail-header">
        <h2 className="gradient-text">{task.title}</h2>
        <div className={`status-badge ${fromQueue ? 'queue-badge-status' : ''}`}>
          {fromQueue ? 'READY TO POST' : (fromHeld ? 'ON HOLD' : 'PENDING APPROVAL')}
        </div>
      </div>

      <div className="vertical-stack">
        <section className="news-summary glass">
          <h3>
            <Clock size={16} /> News Summary
            {getSourceUrl() && (
              <a
                href={getSourceUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="source-link"
              >
                [Source ↗]
              </a>
            )}
          </h3>
          <div className="summary-text">
            {task.content.split('---')[0].split('## ニュース概要')[1]}
          </div>
        </section>

        <section className="decisions">
          <div className={`choice-container ${fromQueue ? 'single-choice' : ''}`}>
            {(!fromQueue || choice === 'A') && (
              <div
                className={`choice-card glass ${choice === 'A' ? 'selected' : ''} ${fromQueue ? 'queue-mode-card' : ''}`}
                onClick={() => handleChoiceSelect('A')}
              >
                <div className="choice-label">PLAN A {fromQueue && ' (SELECTED)'}</div>
                <h4>{choiceA.title}</h4>
                <p>{choiceA.details.split('- **想定ポスト**')[0]}</p>
              </div>
            )}

            {(!fromQueue || choice === 'B') && (
              <div
                className={`choice-card glass ${choice === 'B' ? 'selected' : ''} ${fromQueue ? 'queue-mode-card' : ''}`}
                onClick={() => handleChoiceSelect('B')}
              >
                <div className="choice-label">PLAN B {fromQueue && ' (SELECTED)'}</div>
                <h4>{choiceB.title}</h4>
                <p>{choiceB.details.split('- **想定ポスト**')[0]}</p>
              </div>
            )}
          </div>

          <div className="feedback-section glass">
            <h3><Edit3 size={16} /> Post Customization</h3>
            <div className="feedback-content">
              {/* Left Column: UI Controls */}
              <div className="field options-column">
                <label>Structure Options</label>
                <div className="options-grid">
                  <div className="toggle-item">
                    <input
                      type="checkbox"
                      id="inc-link"
                      checked={includeLink}
                      onChange={(e) => handleLinkToggle(e.target.checked)}
                      disabled={fromQueue}
                    />
                    <label htmlFor="inc-link">Include Source Link</label>
                  </div>
                  <div className="toggle-item">
                    <input
                      type="checkbox"
                      id="force-unique"
                      checked={forceUnique}
                      onChange={(e) => handleUniqueToggle(e.target.checked)}
                      disabled={fromQueue}
                    />
                    <label htmlFor="force-unique">Force Unique (Time)</label>
                  </div>
                  <div className="field h-field">
                    <label>Hashtags</label>
                    <input
                      type="text"
                      placeholder="#KinamonKB #AI"
                      value={hashtags}
                      onChange={(e) => handleHashtagsChange(e.target.value)}
                      disabled={fromQueue}
                      className="hashtag-input"
                    />
                  </div>
                </div>

                <div className="field feedback-field">
                  <label>Advice to Kina Fox (Record Only)</label>
                  <textarea
                    placeholder="Feedback for future learning..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    disabled={fromQueue}
                    className="small-textarea"
                  />
                </div>
              </div>

              {/* Right Column: Final Post Preview/Edit */}
              <div className="field">
                <label>Final Post (Body + Link + Tags)</label>
                <textarea
                  className="post-edit-area"
                  placeholder="Select a plan above to generate post..."
                  value={postEdit}
                  onChange={(e) => setPostEdit(e.target.value)}
                  disabled={!choice}
                />
                <div className="char-count" style={{ color: getXLength(postEdit) > 280 ? '#ef4444' : 'var(--muted)' }}>
                  {getXLength(postEdit)} / 280
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            <button
              className="btn-secondary glass"
              onClick={handleHold}
              disabled={holding}
            >
              {fromHeld
                ? <><RotateCcw size={16} /> {holding ? 'Restoring...' : 'Restore to Pending'}</>
                : fromQueue
                  ? <><Pause size={16} /> {holding ? 'Moving...' : 'Move to Held'}</>
                  : <><Pause size={16} /> {holding ? 'Holding...' : 'Hold Task'}</>
              }
            </button>
            <button
              className="btn-primary"
              disabled={fromQueue ? (!postEdit || posting) : (!choice || loading)}
              onClick={fromQueue ? handlePost : handleDecide}
              style={fromQueue ? { background: '#1da1f2', borderColor: '#1da1f2' } : {}}
            >
              {loading ? 'Analyzing...' : posting ? <><Share2 size={18} className="spin" /> Posting...</> : fromQueue ? <><Share2 size={18} /> Post to X</> : <><Send size={18} /> Decide & Queue</>}
            </button>
          </div>
          {postResult && (
            <div className={`post-result ${postResult.error ? 'post-error' : 'post-success'}`}>
              {postResult.error
                ? `❌ ${postResult.error}`
                : <><span>✅ Posted!</span> <a href={`https://x.com/i/web/status/${postResult.tweetId}`} target="_blank" rel="noopener noreferrer">View on X ↗</a></>
              }
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .task-detail {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .status-badge {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 700;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .queue-badge-status {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.3);
        }
        .vertical-stack {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }
        .news-summary {
          padding: 1.25rem;
          width: 100%;
        }
        .news-summary h3 {
          font-size: 0.95rem;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .source-link {
          font-size: 0.75rem;
          font-weight: normal;
          color: var(--primary);
          margin-left: auto;
          text-decoration: none;
        }
        .source-link:hover {
          text-decoration: underline;
        }
        .summary-text {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--muted);
          white-space: pre-wrap;
        }
        .decisions {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .choice-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .choice-container.single-choice {
          grid-template-columns: 1fr;
        }
        
        @media (max-width: 768px) {
          .choice-container:not(.single-choice) {
            grid-template-columns: 1fr;
          }
          .feedback-content {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          .btn-primary, .btn-secondary {
            padding: 0.8rem 1rem;
            flex: 1;
            font-size: 0.9rem;
          }
          .actions {
            width: 100%;
          }
        }

        .choice-card {
           padding: 1.5rem;
           cursor: pointer;
           border: 2px solid transparent;
        }
        .choice-card.selected {
          border-color: var(--primary);
          background: rgba(79, 70, 229, 0.1);
        }
        .choice-card.queue-mode-card {
           cursor: default;
           border-color: #10b981;
           background: rgba(16, 185, 129, 0.05);
        }
        .choice-label {
          font-size: 0.65rem;
          font-weight: 900;
          color: var(--primary);
          margin-bottom: 0.4rem;
          letter-spacing: 0.1rem;
        }
        .choice-card h4 { font-size: 1.1rem; margin-bottom: 0.5rem; }
        .choice-card p { font-size: 0.9rem; color: var(--muted); line-height: 1.5; }
        
        .feedback-section {
          padding: 1.5rem;
        }
        .feedback-section h3 {
          font-size: 0.95rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .feedback-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
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
          text-transform: uppercase;
          letter-spacing: 0.05rem;
        }
        textarea {
          width: 100%;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: white;
          padding: 1rem;
          min-height: 120px;
          font-size: 0.95rem;
          line-height: 1.5;
          resize: vertical;
        }
        textarea:focus {
          outline: none;
          border-color: var(--primary);
          background: rgba(0,0,0,0.3);
        }
        .post-edit-area {
          border-left: 4px solid var(--primary);
          flex: 1;
          min-height: 280px !important;
        }
        textarea:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 1rem;
        }
        .btn-primary {
          background: var(--primary);
          color: white;
          padding: 0.8rem 2.5rem;
          font-weight: 600;
          font-size: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-secondary {
          padding: 0.8rem 2.5rem;
          color: var(--muted);
          font-size: 1rem;
        }
        .post-result {
          margin-top: 0.75rem;
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .post-success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }
        .post-success a {
          color: #10b981;
          text-decoration: underline;
        }
        .post-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        /* Options area adjustments */
        .options-column {
          background: rgba(255,255,255,0.02);
          padding: 1.25rem;
          border-radius: 12px;
          border: 1px dashed rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .options-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        .toggle-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255,255,255,0.05);
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid var(--border);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .toggle-item:hover {
          background: rgba(255,255,255,0.1);
        }
        .toggle-item input[type="checkbox"] {
          width: 1.2rem;
          height: 1.2rem;
          accent-color: var(--primary);
          cursor: pointer;
        }
        .toggle-item label {
          margin: 0;
          cursor: pointer;
          font-size: 0.85rem;
          text-transform: none;
          letter-spacing: 0;
        }
        .hashtag-input {
          background: rgba(0,0,0,0.2) !important;
          border: 1px solid var(--border) !important;
          border-radius: 8px !important;
          color: white !important;
          padding: 0.6rem 0.75rem !important;
          font-size: 0.85rem !important;
          width: 100% !important;
        }
        .small-textarea {
          min-height: 80px !important;
          font-size: 0.85rem !important;
          padding: 0.75rem !important;
        }
        .char-count {
          font-size: 0.75rem;
          margin-top: 0.4rem;
          display: flex;
          justify-content: flex-end;
          font-weight: 500;
        }
        .h-field label, .feedback-field label {
          font-size: 0.7rem !important;
          margin-bottom: 0.2rem;
        }
      `}</style>
    </div>
  );
}
