'use client';

import { useEffect, useState } from 'react';
import { Task, getTasks, runPatrol } from '@/lib/actions';
import TaskList from '@/components/TaskList';
import TaskDetail from '@/components/TaskDetail';
import { LayoutDashboard, Inbox, CheckCircle, Clock, Radar, Send } from 'lucide-react';

type ViewMode = 'pending' | 'held' | 'queue';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [patrolling, setPatrolling] = useState(false);
  const [patrolMsg, setPatrolMsg] = useState<string | null>(null);

  const fetchTasks = async (mode: ViewMode = viewMode) => {
    setIsLoading(true);
    const data = await getTasks(mode);
    setTasks(data);
    setSelectedTask(data.length > 0 ? data[0] : null);
    setIsLoading(false);

    // Refresh counts for all categories
    const pending = await getTasks('pending');
    setPendingCount(pending.length);

    const queue = await getTasks('queue');
    setQueueCount(queue.length);
  };

  useEffect(() => {
    fetchTasks(viewMode);
  }, [viewMode]);

  const switchMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    setSelectedTask(null);
    setTasks([]);
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

  const modeLabel = viewMode === 'held' ? 'Held Tasks' : viewMode === 'queue' ? 'Post Queue' : 'Approval Gate';
  const modeSubtitle = viewMode === 'held'
    ? 'Tasks put on hold. Review or restore them to active queue.'
    : viewMode === 'queue'
      ? 'Ready to fly. Final verification before the post goes live.'
      : 'Identify the pulse. Shape the persona.';

  return (
    <main className="dashboard">
      <nav className="sidebar glass">
        <div className="logo gradient-text">KinamonKB</div>
        <div className="nav-items">
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
        </div>
      </nav>

      <div className="content">
        <header>
          <h1>
            {modeLabel}
            <span className={`title-count 
              ${viewMode === 'held' ? 'held-count' : ''} 
              ${viewMode === 'queue' ? 'queue-title-count' : ''}
            `}>
              {isLoading ? '…' : tasks.length}
            </span>
          </h1>
          <p className="subtitle">{modeSubtitle}</p>
        </header>

        <div className="layout-grid">
          <aside className="list-area">
            <TaskList
              tasks={tasks}
              selectedId={selectedTask?.id}
              onSelect={setSelectedTask}
            />
          </aside>

          <section className="detail-area">
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
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          display: flex;
          min-height: 100vh;
          background: #0b1120;
        }
        .sidebar {
          width: 200px;
          border-radius: 0;
          border-right: 1px solid var(--border);
          padding: 2rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          flex-shrink: 0;
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
          padding: 0.6rem 0.75rem;
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
          animation: pulse-badge 2s infinite;
        }
        @keyframes pulse-badge {
          0%, 100% { box-shadow: 0 0 6px rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.8); }
        }
        .badge-count.queue-badge {
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
          animation: pulse-queue-badge 2s infinite;
        }
        @keyframes pulse-queue-badge {
          0%, 100% { box-shadow: 0 0 6px rgba(16, 185, 129, 0.3); }
          50% { box-shadow: 0 0 12px rgba(16, 185, 129, 0.6); }
        }
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
          grid-template-columns: 280px 1fr;
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
      `}</style>
    </main>
  );
}
