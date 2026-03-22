'use client';

import { useEffect, useState } from 'react';
import { Task, getTasks, runPatrol, getDecisionCount, generateIdentityProposal } from '@/lib/actions';
import TaskList from '@/components/TaskList';
import TaskDetail from '@/components/TaskDetail';
import IdentityView from '@/components/IdentityView';
import NewsFeed from '@/components/NewsFeed';
import { LayoutDashboard, Inbox, CheckCircle, Clock, Radar, Send, Menu, ChevronLeft, Brain, Sparkles } from 'lucide-react';

type ViewMode = 'feed' | 'pending' | 'held' | 'queue' | 'identity';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [heldCount, setHeldCount] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [patrolling, setPatrolling] = useState(false);
  const [patrolMsg, setPatrolMsg] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [decisionCount, setDecisionCount] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);

  const fetchTasks = async (mode: ViewMode = viewMode) => {
    if (mode === 'identity') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const data = await getTasks(mode as 'pending' | 'held' | 'queue');
    setTasks(data);

    // Auto-select the first task only on desktop.
    const autoSelect = typeof window !== 'undefined' && window.innerWidth > 768;
    setSelectedTask(data.length > 0 && autoSelect ? data[0] : null);
    setIsLoading(false);

    // Refresh counts for all categories
    const { getCandidates } = await import('@/lib/actions');
    const candidates = await getCandidates();
    setCandidateCount(candidates.length);

    const pending = await getTasks('pending');
    setPendingCount(pending.length);
    const held = await getTasks('held');
    setHeldCount(held.length);
    const queue = await getTasks('queue');
    setQueueCount(queue.length);

    // Refresh decision count for identity badge
    const dc = await getDecisionCount();
    setDecisionCount(dc.count);
  };

  useEffect(() => {
    fetchTasks(viewMode);
  }, [viewMode]);

  const switchMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    setSelectedTask(null);
    setTasks([]);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handlePatrol = async () => {
    setPatrolling(true);
    setPatrolMsg(null);
    try {
      const result = await runPatrol();
      setPatrolMsg(result.success ? '✅ Patrol complete' : '⚠️ Patrol had errors');
      fetchTasks(viewMode);
    } catch {
      setPatrolMsg('❌ Patrol failed');
    }
    setPatrolling(false);
    setTimeout(() => setPatrolMsg(null), 5000);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const result = await generateIdentityProposal();
      if (result.success) {
        setAnalyzeMsg('✅ Proposal generated!');
        setDecisionCount(0); // Reset count after analysis
        switchMode('identity');
      } else {
        setAnalyzeMsg(`⚠️ ${result.message}`);
      }
    } catch {
      setAnalyzeMsg('❌ Analysis failed');
    }
    setAnalyzing(false);
    setTimeout(() => setAnalyzeMsg(null), 6000);
  };

  const modeLabel = viewMode === 'feed' ? 'News Feed' : viewMode === 'held' ? 'Held Tasks' : viewMode === 'queue' ? 'Post Queue' : viewMode === 'identity' ? 'Bot Identity' : 'Approval Gate';
  const modeSubtitle = viewMode === 'feed'
    ? 'Stage 1: Browse RSS news and pick the most relevant ones to process.'
    : viewMode === 'held'
      ? 'Tasks put on hold. Review or restore them to active queue.'
      : viewMode === 'queue'
        ? 'Ready to fly. Final verification before the post goes live.'
        : viewMode === 'identity'
          ? 'Review and approve proposed updates to Kina Fox\'s persona.'
          : 'Identify the pulse. Shape the persona.';

  return (
    <main className={`dashboard ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="mobile-header glass">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="icon-btn">
          <Menu size={24} />
        </button>
        <div className="mobile-logo gradient-text">KinamonKB</div>
        <div style={{ width: 24 }} /> {/* Spacer */}
      </div>

      <nav className={`sidebar glass ${isSidebarOpen ? 'active' : ''}`}>
        <div className="sidebar-header desktop-only">
          <div className="logo gradient-text">KinamonKB</div>
        </div>
        <div className="nav-items">
          <div
            className={`nav-item ${viewMode === 'feed' ? 'active feed-active' : ''}`}
            onClick={() => switchMode('feed')}
          >
            <Radar size={16} /> News Feed
            {candidateCount !== null && candidateCount > 0 && (
              <span className="badge-count feed-badge">{candidateCount}</span>
            )}
          </div>
          <div className="nav-divider" />
          <div
            className={`nav-item ${viewMode === 'pending' ? 'active' : ''}`}
            onClick={() => switchMode('pending')}
          >
            <Inbox size={16} /> Pending Tasks
            {pendingCount !== null && pendingCount > 0 && (
              <span className="badge-count">{pendingCount}</span>
            )}
          </div>
          <div
            className={`nav-item ${viewMode === 'held' ? 'active held-active' : ''}`}
            onClick={() => switchMode('held')}
          >
            <Clock size={16} /> Held Tasks
            {heldCount !== null && heldCount > 0 && (
              <span className="badge-count held-badge">{heldCount}</span>
            )}
          </div>
          <div
            className={`nav-item ${viewMode === 'queue' ? 'active queue-active' : ''}`}
            onClick={() => switchMode('queue')}
          >
            <Send size={16} /> Post Queue
            {queueCount !== null && queueCount > 0 && (
              <span className="badge-count queue-badge">{queueCount}</span>
            )}
          </div>
          <div className="nav-item disabled"><CheckCircle size={16} /> History</div>
          <div className="nav-item disabled"><LayoutDashboard size={16} /> System Health</div>

          {/* Bot Identity section */}
          <div className="nav-divider" />
          <div
            className={`nav-item identity-item ${viewMode === 'identity' ? 'active identity-active' : ''}`}
            onClick={() => switchMode('identity')}
          >
            <Brain size={16} /> Bot Identity
            {decisionCount >= 10 && (
              <span className="badge-count identity-badge">{decisionCount}</span>
            )}
          </div>
        </div>
        <div className="sidebar-bottom">
          <button
            className="patrol-btn"
            onClick={handlePatrol}
            disabled={patrolling}
          >
            <Radar size={16} className={patrolling ? 'spin' : ''} />
            {patrolling ? 'Patrolling...' : 'Run Patrol'}
          </button>
          {patrolMsg && <div className="patrol-msg">{patrolMsg}</div>}

          {/* Analyze button */}
          <button
            className={`analyze-btn ${decisionCount >= 10 ? 'ready' : ''}`}
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing
              ? <><Sparkles size={14} className="spin" /> Analyzing...</>
              : <><Brain size={14} /> Analyze Identity</>
            }
          </button>
          {analyzeMsg && <div className="patrol-msg">{analyzeMsg}</div>}
        </div>
      </nav>

      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)} />}

      <div className="content">
        <header>
          <div className="header-top">
            <h1>
              {modeLabel}
              <span className={`title-count 
                 ${viewMode === 'held' ? 'held-count' : ''} 
                 ${viewMode === 'queue' ? 'queue-title-count' : ''}
               `}>
                {isLoading ? '…' : tasks.length}
              </span>
            </h1>
          </div>
          <p className="subtitle">{modeSubtitle}</p>
        </header>

        <div className="layout-grid">
          {viewMode === 'feed' ? (
            <section className="detail-area" style={{ gridColumn: '1 / -1' }}>
              <NewsFeed />
            </section>
          ) : viewMode === 'identity' ? (
            <section className="detail-area" style={{ gridColumn: '1 / -1' }}>
              <IdentityView />
            </section>
          ) : (
            <>
              <aside className="list-area">
                <TaskList
                  tasks={tasks}
                  selectedId={selectedTask?.id}
                  onSelect={setSelectedTask}
                  renderDetail={(t) => (
                    <TaskDetail
                      key={t.id}
                      task={t}
                      fromHeld={viewMode === 'held'}
                      fromQueue={viewMode === 'queue'}
                      onComplete={() => {
                        setSelectedTask(null);
                        fetchTasks(viewMode);
                      }}
                    />
                  )}
                />
              </aside>

              <section className="detail-area desktop-only-detail">
                {selectedTask ? (
                  <TaskDetail
                    key={selectedTask.id}
                    task={selectedTask}
                    fromHeld={viewMode === 'held'}
                    fromQueue={viewMode === 'queue'}
                    onComplete={() => {
                      setSelectedTask(null);
                      fetchTasks(viewMode);
                    }}
                  />
                ) : (
                  <div className="empty-selection glass animate-fade-in">
                    <CheckCircle size={48} className="success-icon" />
                    <h2>{viewMode === 'held' ? 'No held tasks' : 'All clear for now'}</h2>
                    <p>
                      {viewMode === 'held'
                        ? 'Nothing is on hold. Good momentum.'
                        : 'Everything is observed. Select a task to dive deep.'}
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          display: flex;
          min-height: 100vh;
          background: #0b1120;
        }
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          padding: 0 1rem;
          align-items: center;
          justify-content: space-between;
          z-index: 100;
          border-radius: 0;
          border-bottom: 1px solid var(--border);
        }
        .mobile-logo { font-size: 1.1rem; font-weight: 900; }
        .icon-btn {
          background: transparent;
          color: white;
          padding: 8px;
        }
        .sidebar {
          width: 240px;
          border-radius: 0;
          border-right: 1px solid var(--border);
          padding: 2rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          flex-shrink: 0;
          z-index: 150;
          transition: transform 0.3s ease;
        }
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 140;
        }
        .sidebar-bottom {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .patrol-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(16, 185, 129, 0.3);
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .patrol-btn:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.15);
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
        }
        .patrol-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .patrol-msg {
          font-size: 0.75rem;
          text-align: center;
          color: var(--muted);
          animation: fade-in 0.3s;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1.5s linear infinite; }
        .logo {
          font-size: 1.2rem;
          font-weight: 900;
          letter-spacing: -0.05rem;
          padding-left: 0.5rem;
        }
        .nav-items {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 8px;
          color: var(--muted);
          font-size: 0.9rem;
          transition: all 0.2s;
          cursor: pointer;
          user-select: none;
        }
        .nav-item:hover:not(.disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }
        .nav-item.active {
          background: rgba(79, 70, 229, 0.1);
          color: var(--primary);
          font-weight: 600;
        }
        .nav-item.feed-active {
          background: rgba(14, 165, 233, 0.1);
          color: #0ea5e9;
        }
        .nav-item.held-active {
          background: rgba(245, 158, 11, 0.08);
          color: #f59e0b;
        }
        .nav-item.queue-active {
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
        }
        .nav-item.disabled {
          opacity: 0.35;
          cursor: default;
        }
        .badge-count {
          margin-left: auto;
          background: #ef4444;
          color: white;
          font-size: 0.7rem;
          font-weight: 800;
          min-width: 18px;
          height: 18px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
        }
        .badge-count.feed-badge {
          background: #0ea5e9;
          box-shadow: 0 0 8px rgba(14, 165, 233, 0.5);
        }
        .badge-count.queue-badge {
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }
        .badge-count.identity-badge {
          background: #f97316;
          box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
        }
        .badge-count.held-badge {
          background: #f59e0b;
          box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
        }
        .nav-divider {
          height: 1px;
          background: var(--border);
          margin: 0.5rem 0;
        }
        .nav-item.identity-active {
          background: rgba(168, 85, 247, 0.1);
          color: #a855f7;
        }
        .analyze-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(168, 85, 247, 0.25);
          background: rgba(168, 85, 247, 0.06);
          color: #a855f7;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .analyze-btn.ready {
          border-color: rgba(249, 115, 22, 0.5);
          background: rgba(249, 115, 22, 0.08);
          color: #f97316;
          box-shadow: 0 0 10px rgba(249, 115, 22, 0.2);
        }
        .analyze-btn:hover:not(:disabled) {
          background: rgba(168, 85, 247, 0.12);
        }
        .analyze-btn.ready:hover:not(:disabled) {
          background: rgba(249, 115, 22, 0.15);
        }
        .analyze-btn:disabled { opacity: 0.6; cursor: wait; }
        .content {
          flex: 1;
          padding: 1.5rem 2rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        header {
          margin-bottom: 1.5rem;
        }
        .header-top {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        header h1 {
           font-size: 2rem;
           margin-bottom: 0.1rem;
           display: flex;
           align-items: center;
           gap: 0.75rem;
        }
        .title-count {
          font-size: 0.9rem;
          background: var(--primary);
          color: white;
          padding: 0.1rem 0.5rem;
          border-radius: 12px;
          vertical-align: middle;
        }
        .title-count.held-count {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .title-count.queue-title-count {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .subtitle { font-size: 0.85rem; color: var(--muted); }

        .layout-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 2rem;
          align-items: start;
          flex: 1;
        }
        .detail-area {
          min-width: 0;
        }
        .empty-selection {
          height: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 1rem;
        }
        .success-icon { color: #10b981; margin-bottom: 1rem; }

        @media (max-width: 1024px) {
           .layout-grid {
             grid-template-columns: 280px 1fr;
             gap: 1rem;
           }
        }

        @media (max-width: 768px) {
          .dashboard {
             flex-direction: column;
             padding-top: 60px;
          }
          .mobile-header { display: flex; }
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            background: #0f172a;
          }
          .sidebar.active {
            transform: translateX(0);
          }
          .content {
            padding: 1rem;
          }
          header h1 { font-size: 1.5rem; }
          .layout-grid {
            display: block;
          }
          .desktop-only-detail, .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
