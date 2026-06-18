import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Task,
  TaskPriority,
  TaskColumn,
  TaskProgress,
  StandupNoteService,
} from '../standup-note.service';
import { Subscription } from 'rxjs';

interface PrioritySection {
  key: TaskPriority;
  label: string;
  emoji: string;
  colorClass: string;
}

interface KanbanColumn {
  key: TaskColumn;
  label: string;
  icon: string;
  colorClass: string;
  canAdd: boolean;
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tasks-page">
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-title">
          <span class="page-icon">📋</span>
          <div>
            <h1>Task Board</h1>
            <p class="page-subtitle">{{ allTasks.length }} tasks across {{ columns.length }} stages</p>
          </div>
        </div>
        <div class="header-controls">
          <input
            type="text"
            class="search-input"
            placeholder="🔍 Search tasks..."
            [(ngModel)]="searchQuery"
          />
          <select class="filter-select" [(ngModel)]="filterPriority">
            <option value="">All Priorities</option>
            <option *ngFor="let p of prioritySections" [value]="p.key">{{ p.emoji }} {{ p.label }}</option>
          </select>
        </div>
      </div>

      <!-- Kanban Board -->
      <div class="kanban-board">
        <div
          *ngFor="let col of columns"
          class="kanban-column"
          [ngClass]="col.colorClass"
          (dragover)="onDragOver($event)"
          (drop)="onDropToColumn($event, col.key)"
        >
          <!-- Column Header -->
          <div class="col-header">
            <div class="col-title-group">
              <span class="col-icon">{{ col.icon }}</span>
              <span class="col-label">{{ col.label }}</span>
              <span class="col-count">{{ getColumnCount(col.key) }}</span>
            </div>
            <button
              *ngIf="col.canAdd"
              class="add-task-btn"
              (click)="openAdd()"
              title="Add new task"
              aria-label="Add new task"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Priority Sections -->
          <div class="priority-sections">
            <div
              *ngFor="let section of prioritySections"
              class="priority-section"
              [ngClass]="section.colorClass"
              (dragover)="onDragOver($event)"
              (drop)="onDropToSection($event, col.key, section.key)"
            >
              <div class="section-label">
                <span class="section-emoji">{{ section.emoji }}</span>
                <span class="section-text">{{ section.label }}</span>
                <span class="section-count">{{ getTasksFor(col.key, section.key).length }}</span>
              </div>

              <!-- Task Cards -->
              <div class="task-list">
                <div
                  *ngFor="let task of getFilteredTasksFor(col.key, section.key)"
                  class="task-card"
                  [attr.draggable]="true"
                  (dragstart)="onDragStart($event, task)"
                  (dragend)="onDragEnd()"
                  [class.dragging]="draggingTask?.id === task.id"
                >
                  <div class="task-card-top">
                    <span class="task-tag" [ngClass]="getTagClass(task.tag)">{{ task.tag }}</span>
                    <div class="task-card-actions">
                      <button class="card-action-btn" (click)="openEdit(task)" title="Edit">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
                      </button>
                      <button class="card-action-btn danger" (click)="deleteTask(task.id)" title="Delete">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div class="task-title">{{ task.title }}</div>
                  <div class="task-desc" *ngIf="task.description">{{ task.description }}</div>
                  <div class="task-meta">
                    <span class="task-meta-item" *ngIf="task.employeeName">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                      {{ task.employeeName }}
                    </span>
                    <span class="task-meta-item" *ngIf="task.projectName">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                      {{ task.projectName }}
                    </span>
                  </div>
                  <div class="task-footer">
                    <span class="progress-badge" [ngClass]="getProgressClass(task.progress)">{{ task.progress }}</span>
                    <span class="task-date" *ngIf="task.endDate">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v3M11 1v3M2 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                      {{ formatDate(task.endDate) }}
                    </span>
                  </div>

                  <!-- Mobile move controls -->
                  <div class="mobile-move-controls">
                    <span class="move-label">Move to:</span>
                    <div class="move-btns">
                      <button
                        *ngFor="let c of columns"
                        class="move-btn"
                        [class.active]="task.column === c.key"
                        (click)="moveTask(task, c.key)"
                      >{{ c.icon }}</button>
                    </div>
                  </div>
                </div>

                <!-- Drop placeholder -->
                <div class="drop-placeholder" *ngIf="isDragOver && getFilteredTasksFor(col.key, section.key).length === 0">
                  Drop here
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">
              <span>{{ editMode ? '✏️' : '➕' }}</span>
              <h2>{{ editMode ? 'Edit Task' : 'New Task' }}</h2>
            </div>
            <button class="modal-close" (click)="closeModal()">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-grid-2">
              <div class="form-group full-width">
                <label class="form-label">Task Title <span class="required">*</span></label>
                <input type="text" [(ngModel)]="form.title" class="form-input" placeholder="Describe the task briefly..." />
              </div>

              <div class="form-group">
                <label class="form-label">Tag</label>
                <input type="text" [(ngModel)]="form.tag" class="form-input" placeholder="e.g. BUG, FEAT, DESIGN" />
              </div>

              <div class="form-group">
                <label class="form-label">Priority</label>
                <select [(ngModel)]="form.priority" class="form-input">
                  <option *ngFor="let p of prioritySections" [value]="p.key">{{ p.emoji }} {{ p.label }}</option>
                </select>
              </div>

              <div class="form-group full-width">
                <label class="form-label">Description</label>
                <textarea [(ngModel)]="form.description" class="form-input" rows="3" placeholder="Detailed description of the task..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Start Date</label>
                <input type="date" [(ngModel)]="form.startDate" class="form-input" />
              </div>

              <div class="form-group">
                <label class="form-label">End Date</label>
                <input type="date" [(ngModel)]="form.endDate" class="form-input" />
              </div>

              <div class="form-group">
                <label class="form-label">Progress Status</label>
                <select [(ngModel)]="form.progress" class="form-input">
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Column</label>
                <select [(ngModel)]="form.column" class="form-input">
                  <option *ngFor="let c of columns" [value]="c.key">{{ c.icon }} {{ c.label }}</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Employee Name</label>
                <input type="text" [(ngModel)]="form.employeeName" class="form-input" placeholder="Assigned employee..." />
              </div>

              <div class="form-group">
                <label class="form-label">Project Name</label>
                <input type="text" [(ngModel)]="form.projectName" class="form-input" placeholder="Associated project..." />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveTask()">
              {{ editMode ? 'Save Changes' : 'Create Task' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Page Layout ─────────────────────────────────────────────── */
    .tasks-page {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 0.75rem 1rem;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .page-icon { font-size: 1.8rem; }
    .page-title h1 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .page-subtitle {
      margin: 0;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .header-controls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .search-input, .filter-select {
      padding: 0.45rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 0.85rem;
      background: var(--bg-input);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s;
    }
    .search-input:focus, .filter-select:focus { border-color: var(--accent-primary); }
    .search-input { min-width: 200px; }

    /* ── Kanban Board ─────────────────────────────────────────────── */
    .kanban-board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      flex: 1;
      overflow-x: auto;
      align-items: start;
    }

    .kanban-column {
      border-radius: 16px;
      padding: 0.75rem;
      border: 1px solid transparent;
      min-height: 300px;
      transition: border-color 0.2s;
    }

    /* Column color themes */
    .col-not-taken {
      background: #f0f4ff;
      border-color: #c7d3f9;
    }
    .col-in-progress {
      background: #fff8ed;
      border-color: #fdd9a0;
    }
    .col-completed {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    /* Dark mode overrides */
    :host-context(body.theme-dark) .col-not-taken {
      background: rgba(99,102,241,0.08);
      border-color: rgba(99,102,241,0.25);
    }
    :host-context(body.theme-dark) .col-in-progress {
      background: rgba(245,158,11,0.08);
      border-color: rgba(245,158,11,0.25);
    }
    :host-context(body.theme-dark) .col-completed {
      background: rgba(16,185,129,0.08);
      border-color: rgba(16,185,129,0.25);
    }

    /* ── Column Header ────────────────────────────────────────────── */
    .col-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .col-title-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .col-icon { font-size: 1.1rem; }
    .col-label {
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--text-primary);
    }
    .col-count {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 20px;
      border: 1px solid var(--border-color);
    }

    .add-task-btn {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      border: 1.5px dashed var(--accent-primary);
      background: var(--accent-surface);
      color: var(--accent-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .add-task-btn:hover {
      background: var(--accent-primary);
      color: white;
      border-style: solid;
      transform: scale(1.05);
    }

    /* ── Priority Sections ────────────────────────────────────────── */
    .priority-sections {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .priority-section {
      border-radius: 10px;
      padding: 0.6rem;
      border: 1px solid transparent;
      transition: border-color 0.2s, background 0.2s;
    }

    /* Section colors — subtle tints */
    .section-important-urgent {
      background: rgba(239,68,68,0.05);
      border-color: rgba(239,68,68,0.15);
    }
    .section-urgent-not-important {
      background: rgba(245,158,11,0.05);
      border-color: rgba(245,158,11,0.15);
    }
    .section-important-not-urgent {
      background: rgba(59,130,246,0.05);
      border-color: rgba(59,130,246,0.15);
    }
    .section-not-important-not-urgent {
      background: rgba(107,114,128,0.05);
      border-color: rgba(107,114,128,0.15);
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
    }
    .section-emoji { font-size: 0.85rem; }
    .section-text {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      flex: 1;
    }
    .section-count {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      padding: 0.1rem 0.35rem;
      border-radius: 10px;
    }

    /* ── Task List & Cards ────────────────────────────────────────── */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-height: 40px;
    }

    .task-card {
      background: var(--bg-secondary);
      border-radius: 10px;
      border: 1px solid var(--border-color);
      padding: 0.6rem 0.7rem;
      cursor: grab;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      transition: box-shadow 0.2s, transform 0.15s, opacity 0.15s;
      user-select: none;
    }
    .task-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transform: translateY(-1px);
    }
    .task-card.dragging {
      opacity: 0.45;
      transform: rotate(1.5deg);
      cursor: grabbing;
    }
    .task-card:active { cursor: grabbing; }

    .task-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.35rem;
    }

    .task-tag {
      font-size: 0.62rem;
      font-weight: 800;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    /* Tag color cycling based on content */
    .tag-design { background: rgba(139,92,246,0.15); color: #7c3aed; }
    .tag-bug    { background: rgba(239,68,68,0.15);  color: #dc2626; }
    .tag-feat   { background: rgba(59,130,246,0.15);  color: #2563eb; }
    .tag-test   { background: rgba(16,185,129,0.15);  color: #059669; }
    .tag-infra  { background: rgba(245,158,11,0.15);  color: #d97706; }
    .tag-docs   { background: rgba(236,72,153,0.15);  color: #be185d; }
    .tag-default{ background: rgba(99,102,241,0.15);  color: #4f46e5; }

    .task-card-actions {
      display: flex;
      gap: 0.2rem;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .task-card:hover .task-card-actions { opacity: 1; }

    .card-action-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: var(--bg-tertiary);
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      transition: all 0.15s;
    }
    .card-action-btn:hover { background: var(--accent-surface); color: var(--accent-primary); }
    .card-action-btn.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

    .task-title {
      font-size: 0.83rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.35;
      margin-bottom: 0.25rem;
    }
    .task-desc {
      font-size: 0.74rem;
      color: var(--text-secondary);
      line-height: 1.45;
      margin-bottom: 0.35rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .task-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.4rem;
    }
    .task-meta-item {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .task-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .progress-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 20px;
    }
    .progress-not-started { background: rgba(107,114,128,0.12); color: #6b7280; }
    .progress-in-progress { background: rgba(245,158,11,0.15);  color: #d97706; }
    .progress-review      { background: rgba(59,130,246,0.15);  color: #2563eb; }
    .progress-done        { background: rgba(16,185,129,0.15);  color: #059669; }

    .task-date {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.68rem;
      color: var(--text-secondary);
    }

    .drop-placeholder {
      border: 2px dashed var(--border-color);
      border-radius: 8px;
      padding: 0.75rem;
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-secondary);
      opacity: 0.5;
    }

    /* ── Mobile Move Controls ─────────────────────────────────────── */
    .mobile-move-controls {
      display: none;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border-color);
      align-items: center;
      gap: 0.4rem;
    }
    .move-label { font-size: 0.68rem; color: var(--text-secondary); }
    .move-btns { display: flex; gap: 0.25rem; }
    .move-btn {
      padding: 0.2rem 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-tertiary);
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.15s;
    }
    .move-btn.active { background: var(--accent-surface); border-color: var(--accent-primary); }
    .move-btn:hover  { background: var(--accent-surface); }

    /* ── Buttons ──────────────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1.1rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }

    /* ── Modal ────────────────────────────────────────────────────── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 1rem;
    }

    .modal {
      background: var(--bg-secondary);
      border-radius: 20px;
      width: 600px;
      max-width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      border: 1px solid var(--border-color);
      animation: modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.92) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem 0.75rem;
      border-bottom: 1px solid var(--border-color);
    }
    .modal-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .modal-title span { font-size: 1.3rem; }
    .modal-title h2 { margin: 0; font-size: 1.05rem; color: var(--text-primary); }

    .modal-close {
      width: 32px;
      height: 32px;
      border: none;
      background: var(--bg-tertiary);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      transition: all 0.15s;
    }
    .modal-close:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

    .modal-body {
      padding: 1rem 1.25rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.9rem;
    }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .full-width { grid-column: 1 / -1; }

    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .required { color: #ef4444; }

    .form-input {
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 0.88rem;
      background: var(--bg-input);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
    }
    .form-input:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px var(--accent-surface);
    }
    textarea.form-input { resize: vertical; }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem 1rem;
      border-top: 1px solid var(--border-color);
    }

    /* ── Responsive ───────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .kanban-board {
        grid-template-columns: repeat(3, minmax(260px, 1fr));
        padding-bottom: 0.5rem;
      }
    }

    @media (max-width: 650px) {
      .kanban-board {
        grid-template-columns: 1fr;
        overflow-x: unset;
      }

      .page-header {
        flex-direction: column;
        align-items: stretch;
      }
      .header-controls {
        flex-direction: column;
      }
      .search-input { min-width: unset; width: 100%; box-sizing: border-box; }
      .filter-select { width: 100%; }

      .task-card-actions { opacity: 1; }

      .mobile-move-controls { display: flex; }

      .form-grid-2 { grid-template-columns: 1fr; }
    }
  `],
})
export class TasksComponent implements OnInit, OnDestroy {
  svc = inject(StandupNoteService);

  allTasks: Task[] = [];
  draggingTask: Task | null = null;
  isDragOver = false;
  showModal = false;
  editMode = false;
  searchQuery = '';
  filterPriority: TaskPriority | '' = '';
  form!: Task;

  private sub?: Subscription;

  readonly columns: KanbanColumn[] = [
    { key: 'not-taken',   label: 'Not Yet Taken', icon: '📥', colorClass: 'col-not-taken',   canAdd: true },
    { key: 'in-progress', label: 'In Progress',   icon: '⚡', colorClass: 'col-in-progress', canAdd: false },
    { key: 'completed',   label: 'Completed',     icon: '✅', colorClass: 'col-completed',   canAdd: false },
  ];

  readonly prioritySections: PrioritySection[] = [
    { key: 'important-urgent',          label: 'Important & Urgent',          emoji: '🔴', colorClass: 'section-important-urgent' },
    { key: 'urgent-not-important',      label: 'Urgent but Not Important',     emoji: '🟠', colorClass: 'section-urgent-not-important' },
    { key: 'important-not-urgent',      label: 'Important but Not Urgent',     emoji: '🟡', colorClass: 'section-important-not-urgent' },
    { key: 'not-important-not-urgent',  label: 'Not Important & Not Urgent',   emoji: '🟢', colorClass: 'section-not-important-not-urgent' },
  ];

  ngOnInit() {
    this.sub = this.svc.state$.subscribe(s => {
      this.allTasks = s.tasks || [];
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  // ── Filtering ──────────────────────────────────────────────────────────────
  getTasksFor(col: TaskColumn, priority: TaskPriority): Task[] {
    return this.allTasks.filter(t => t.column === col && t.priority === priority);
  }

  getFilteredTasksFor(col: TaskColumn, priority: TaskPriority): Task[] {
    let tasks = this.getTasksFor(col, priority);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.employeeName.toLowerCase().includes(q) ||
        t.projectName.toLowerCase().includes(q)
      );
    }
    if (this.filterPriority) {
      tasks = tasks.filter(t => t.priority === this.filterPriority);
    }
    return tasks;
  }

  getColumnCount(col: TaskColumn): number {
    return this.allTasks.filter(t => t.column === col).length;
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  onDragStart(event: DragEvent, task: Task) {
    this.draggingTask = task;
    event.dataTransfer?.setData('text/plain', task.id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragEnd() {
    this.draggingTask = null;
    this.isDragOver = false;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.isDragOver = true;
  }

  onDropToColumn(event: DragEvent, col: TaskColumn) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggingTask) return;
    const updated: Task = { ...this.draggingTask, column: col };
    this.svc.updateTask(updated);
    this.draggingTask = null;
    this.isDragOver = false;
  }

  onDropToSection(event: DragEvent, col: TaskColumn, priority: TaskPriority) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggingTask) return;
    const updated: Task = { ...this.draggingTask, column: col, priority };
    this.svc.updateTask(updated);
    this.draggingTask = null;
    this.isDragOver = false;
  }

  // Mobile move
  moveTask(task: Task, col: TaskColumn) {
    const updated: Task = { ...task, column: col };
    this.svc.updateTask(updated);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  blankForm(): Task {
    return {
      id: '',
      title: '',
      tag: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      progress: 'Not Started',
      priority: 'important-urgent',
      column: 'not-taken',
      employeeName: '',
      projectName: '',
    };
  }

  openAdd() { this.form = this.blankForm(); this.editMode = false; this.showModal = true; }
  openEdit(task: Task) { this.form = { ...task }; this.editMode = true; this.showModal = true; }
  closeModal() { this.showModal = false; }

  saveTask() {
    if (!this.form.title.trim()) return;
    if (this.editMode) {
      this.svc.updateTask(this.form);
    } else {
      this.form.id = this.svc.generateId('TSK', this.allTasks);
      this.svc.addTask(this.form);
    }
    this.closeModal();
  }

  deleteTask(id: string) {
    if (confirm('Delete this task?')) this.svc.deleteTask(id);
  }

  // ── Styling Helpers ────────────────────────────────────────────────────────
  getTagClass(tag: string): string {
    const map: Record<string, string> = {
      DESIGN: 'tag-design',
      BUG: 'tag-bug',
      FEAT: 'tag-feat',
      TEST: 'tag-test',
      INFRA: 'tag-infra',
      DOCS: 'tag-docs',
    };
    return map[tag?.toUpperCase()] || 'tag-default';
  }

  getProgressClass(progress: TaskProgress): string {
    const map: Record<TaskProgress, string> = {
      'Not Started': 'progress-not-started',
      'In Progress': 'progress-in-progress',
      'Review':      'progress-review',
      'Done':        'progress-done',
    };
    return map[progress] || 'progress-not-started';
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
}
