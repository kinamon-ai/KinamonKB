'use client';

import { Task } from '@/lib/actions';
import { ChevronRight, ChevronUp, Calendar, Bot } from 'lucide-react';
import React from 'react';

export default function TaskList({ tasks, onSelect, selectedId, renderDetail }: {
  tasks: Task[],
  onSelect: (task: Task | null) => void,
  selectedId?: string,
  renderDetail?: (task: Task) => React.ReactNode
}) {
  return (
    <div className="task-list">
      {tasks.length === 0 && (
        <div className="empty-state">
          <p>No tasks pending. Enjoy the void.</p>
        </div>
      )}
      {tasks.map((task) => (
        <React.Fragment key={task.id}>
          <div
            className={`task-card glass ${selectedId === task.id ? 'active' : ''}`}
            onClick={() => onSelect(selectedId === task.id ? null : task)}
          >
            <div className="task-header">
              <span className="priority-dot urgent"></span>
              <h3>{task.title}</h3>
            </div>
            <div className="task-meta">
              <span><Calendar size={14} /> {task.date}</span>
              <span><Bot size={14} /> {task.bot}</span>
            </div>
            {selectedId === task.id ? <ChevronUp className="chevron active-chevron" size={20} /> : <ChevronRight className="chevron" size={20} />}
          </div>
          {selectedId === task.id && renderDetail && (
            <div className="mobile-detail-wrapper">
              {renderDetail(task)}
            </div>
          )}
        </React.Fragment>
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
        .task-card:hover .chevron, .chevron.active-chevron {
          opacity: 1;
        }
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--muted);
          font-size: 0.9rem;
        }
        .mobile-detail-wrapper {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-detail-wrapper {
            display: block;
            margin-top: -0.25rem;
            margin-bottom: 1rem;
            animation: slide-down 0.2s ease-out;
          }
          .task-card.active {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
          }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
