'use client';

import { Task } from '@/lib/actions';
import { Calendar, Bot, ChevronRight } from 'lucide-react';

export default function TaskList({ tasks, onSelect, selectedId }: {
  tasks: Task[],
  onSelect: (task: Task) => void,
  selectedId?: string
}) {
  return (
    <div className="task-list">
      {tasks.length === 0 && (
        <div className="empty-state">
          <p>No tasks pending. Enjoy the void.</p>
        </div>
      )}
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`task-card glass ${selectedId === task.id ? 'active' : ''}`}
          onClick={() => onSelect(task)}
        >
          <div className="task-header">
            <span className="priority-dot urgent"></span>
            <h3>{task.title}</h3>
          </div>
          <div className="task-meta">
            <span><Calendar size={14} /> {task.date}</span>
            <span><Bot size={14} /> {task.bot}</span>
          </div>
          <ChevronRight className="chevron" size={20} />
        </div>
      ))}

      <style jsx>{`
        .task-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .task-card {
          padding: 1rem;
          cursor: pointer;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }
        .task-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
          background: rgba(45, 55, 72, 0.8);
        }
        .task-card.active {
          border-color: var(--primary);
          background: rgba(79, 70, 229, 0.1);
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.15);
        }
        .task-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
        }
        .task-header h3 {
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .priority-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .priority-dot.urgent { background: #f87171; box-shadow: 0 0 6px #f87171; }
        .task-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--muted);
          align-items: center;
        }
        .task-meta span {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .chevron {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .task-card:hover .chevron {
          opacity: 1;
        }
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--muted);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
