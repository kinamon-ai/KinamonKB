'use client';

import { useState, useEffect } from 'react';
import { Task, decideTask, holdTask } from '@/lib/actions';
import { Send, Clock, Edit3, Pause, RotateCcw, Share2 } from 'lucide-react';

export default function TaskDetail({ task, onComplete, fromHeld = false, fromQueue = false }: { task: Task, onComplete: () => void, fromHeld?: boolean, fromQueue?: boolean }) {
  const [choice, setChoice] = useState<'A' | 'B' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [postEdit, setPostEdit] = useState('');
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(false);

  // Simple extraction of Choice A and B from text
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

  // Load existing selection if in Queue mode
  useEffect(() => {
    if (fromQueue) {
      const selectedMatch = task.content.match(/- \*\*選択\*\*: ([AB])/);
      const postMatch = task.content.match(/- \*\*最終ポスト\*\*: \n> ([\s\S]*?)(?=\n- \*\*コメント\*\*|$)/);
      const feedbackMatch = task.content.match(/- \*\*コメント\*\*: (.*)/);

      const selected = selectedMatch?.[1] as 'A' | 'B' | null;
      setChoice(selected);
      if (postMatch) {
        setPostEdit(postMatch[1].split('\n').map(line => line.replace(/^> /, '')).join('\n').trim());
      }
      if (feedbackMatch) {
        setFeedback(feedbackMatch[1]);
      }
    } else {
      // Reset for pending
      setChoice(null);
      setFeedback('');
      setPostEdit('');
    }
  }, [task.id, fromQueue]);

  const handleChoiceSelect = (id: 'A' | 'B') => {
    if (fromQueue) return;
    setChoice(id);
    setPostEdit(id === 'A' ? choiceA.post : choiceB.post);
  };

  const handleDecide = async () => {
    if (!choice || fromQueue) return;
    setLoading(true);
    await decideTask(task.id, choice, feedback, postEdit);
    setLoading(false);
    onComplete();
  };

  const handleHold = async () => {
    if (fromQueue) return;
    setHolding(true);
    await holdTask(task.id, fromHeld);
    setHolding(false);
    onComplete();
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
          <h3><Clock size={16} /> News Summary</h3>
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
            <h3><Edit3 size={16} /> {fromQueue ? 'Final Adjustments' : 'Fine-tune & Feedback'}</h3>
            <div className="feedback-content">
              <div className="field">
                <label>Observations / Advice to Bot</label>
                <textarea
                  placeholder="Add your edits or feedback for Kina Fox..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  disabled={fromQueue}
                />
              </div>
              <div className="field">
                <label>Direct Post Edit (X/Twitter)</label>
                <textarea
                  className="post-edit-area"
                  placeholder="Select a plan to edit the post..."
                  value={postEdit}
                  onChange={(e) => setPostEdit(e.target.value)}
                  disabled={!choice}
                />
              </div>
            </div>
          </div>

          <div className="actions">
            {!fromQueue && (
              <button
                className="btn-secondary glass"
                onClick={handleHold}
                disabled={holding}
              >
                {fromHeld
                  ? <><RotateCcw size={16} /> {holding ? 'Restoring...' : 'Restore to Pending'}</>
                  : <><Pause size={16} /> {holding ? 'Holding...' : 'Hold Task'}</>
                }
              </button>
            )}
            <button
              className="btn-primary"
              disabled={!choice || loading || fromHeld || fromQueue}
              onClick={handleDecide}
              style={fromQueue ? { background: '#1da1f2', borderColor: '#1da1f2' } : {}}
            >
              {loading ? 'Analyzing...' : fromQueue ? <><Share2 size={18} /> Post to X (Coming soon)</> : <><Send size={18} /> Decide & Queue</>}
            </button>
          </div>
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
      `}</style>
    </div>
  );
}
