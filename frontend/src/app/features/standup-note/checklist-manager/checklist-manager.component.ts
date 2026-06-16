import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StandupNoteService, ChecklistGroup, ChecklistItem } from '../standup-note.service';

@Component({
  selector: 'app-checklist-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="manager-shell">
      <header class="manager-header">
        <div>
          <p class="eyebrow">Checklist Manager</p>
          <h2>Organize your work with smart checklist groups</h2>
        </div>
        <button
          class="btn btn-primary action-btn"
          (click)="createGroup()"
          [disabled]="!newGroupTitle.trim()"
        >
          <span class="icon">＋</span>
          Add Checklist Group
        </button>
      </header>

      <div class="quick-add">
        <input
          [(ngModel)]="newGroupTitle"
          placeholder="Enter a new checklist group title"
          aria-label="New checklist group title"
        />
        <button
          class="btn btn-secondary"
          (click)="createGroup()"
          [disabled]="!newGroupTitle.trim()"
        >
          Create Group
        </button>
      </div>

      <div *ngIf="!groups.length" class="empty-state">
        <div class="empty-icon">✅</div>
        <h3>No checklist groups yet</h3>
        <p>Create your first group to organize tasks, track progress, and collaborate clearly.</p>
      </div>

      <div class="cards" *ngIf="groups.length">
        <article *ngFor="let g of groups" class="card">
          <div class="card-top">
            <div class="card-title-wrap">
              <input
                [(ngModel)]="g.title"
                (blur)="renameGroup(g)"
                class="group-title"
                placeholder="Group title"
                aria-label="Checklist group title"
              />
              <span class="group-meta"
                >{{ getCompletedCount(g) }} of {{ g.items.length }} completed</span
              >
            </div>
            <div class="card-actions">
              <button class="icon-btn" title="Toggle items" (click)="toggleGroupCollapse(g.id)">
                <span>{{ isCollapsed(g.id) ? '▾' : '▴' }}</span>
              </button>
              <button class="icon-btn danger" title="Delete group" (click)="deleteGroup(g.id)">
                🗑️
              </button>
            </div>
          </div>

          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="getProgressPercent(g)"></div>
          </div>

          <div class="card-body" [class.collapsed]="isCollapsed(g.id)">
            <ul class="items">
              <li
                *ngFor="let it of g.items; let i = index"
                class="item"
                [draggable]="editingItemId !== it.id"
                (dragstart)="onDragStart($event, g.id, i)"
                (dragover)="onDragOver($event, i)"
                (drop)="onDrop($event, g.id, i)"
                (dragend)="onDragEnd()"
                [class.dragging]="draggedGroupId === g.id && draggedItemIndex === i"
              >
                <div class="item-left">
                  <span class="drag-handle" title="Drag to reorder">☰</span>
                  <label class="item-label">
                    <input
                      type="checkbox"
                      [(ngModel)]="it.done"
                      (change)="toggleItemDone(g.id, it)"
                    />
                    <span class="checkbox-custom"></span>
                    
                    <!-- Display Mode -->
                    <span
                      *ngIf="editingItemId !== it.id"
                      class="item-text-display"
                      [class.done-text]="it.done"
                    >
                      {{ it.text }}
                    </span>
                    
                    <!-- Edit Mode -->
                    <input
                      *ngIf="editingItemId === it.id"
                      [(ngModel)]="editItemText"
                      (keyup.enter)="saveItemEdit(g.id, it)"
                      class="item-text-edit-input"
                      #editInput
                    />
                  </label>
                </div>
                
                <div class="item-actions">
                  <button
                    *ngIf="editingItemId !== it.id"
                    class="icon-btn-sm"
                    title="Edit item"
                    (click)="startEditItem(it)"
                  >
                    ✏️
                  </button>
                  <button
                    *ngIf="editingItemId === it.id"
                    class="icon-btn-sm save"
                    title="Save item"
                    (click)="saveItemEdit(g.id, it)"
                  >
                    💾
                  </button>
                  <button
                    *ngIf="editingItemId === it.id"
                    class="icon-btn-sm cancel"
                    title="Cancel edit"
                    (click)="cancelEditItem()"
                  >
                    ✕
                  </button>
                  <button
                    *ngIf="editingItemId !== it.id"
                    class="icon-btn-sm danger"
                    title="Remove item"
                    (click)="removeItem(g.id, it.id)"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            </ul>

            <div class="add-item">
              <input
                [(ngModel)]="pendingItem[g.id]"
                placeholder="Add a new item"
                (keyup.enter)="addItem(g.id)"
                aria-label="Add checklist item"
              />
              <button
                class="btn btn-secondary"
                (click)="addItem(g.id)"
                [disabled]="!pendingItem[g.id]?.trim()"
              >
                Add item
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .manager-shell {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .manager-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin: 0 0 6px;
      }
      .manager-header h2 {
        margin: 0;
        font-size: clamp(1.5rem, 2vw, 2rem);
        line-height: 1.1;
      }
      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0.9rem 1.2rem;
      }
      .quick-add {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        padding: 16px 20px;
        border-radius: 18px;
        background: rgba(99, 102, 241, 0.08);
        border: 1px solid rgba(99, 102, 241, 0.12);
      }
      .quick-add input {
        flex: 1;
        min-width: 220px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: var(--bg-primary);
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
      }
      .quick-add input:focus {
        outline: none;
        border-color: rgba(99, 102, 241, 0.8);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 40px;
        border-radius: 24px;
        border: 1px dashed rgba(148, 163, 184, 0.35);
        background: rgba(99, 102, 241, 0.06);
        text-align: center;
        color: var(--text-secondary);
      }
      .empty-icon {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.14);
        color: var(--accent-primary);
        font-size: 1.75rem;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 20px;
        border-radius: 24px;
        background: var(--bg-secondary);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
        transition:
          transform 0.24s ease,
          border-color 0.24s ease;
      }
      .card:hover {
        transform: translateY(-2px);
        border-color: rgba(99, 102, 241, 0.35);
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .card-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }
      .group-title {
        width: 100%;
        font-size: 1.05rem;
        font-weight: 700;
        border: none;
        background: transparent;
        color: var(--text-primary);
        padding: 0;
      }
      .group-title:focus {
        outline: none;
        color: var(--text-primary);
      }
      .group-meta {
        font-size: 0.9rem;
        color: var(--text-secondary);
      }
      .card-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        background: rgba(148, 163, 184, 0.12);
        border: none;
        color: var(--text-primary);
        cursor: pointer;
        transition:
          transform 0.2s ease,
          background 0.2s ease;
      }
      .icon-btn:hover {
        transform: scale(1.04);
        background: rgba(99, 102, 241, 0.16);
      }
      .icon-btn.danger {
        background: rgba(248, 113, 113, 0.14);
        color: #b91c1c;
      }
      .progress-bar {
        width: 100%;
        height: 10px;
        border-radius: 999px;
        background: rgba(99, 102, 241, 0.14);
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.75));
        transition: width 0.3s ease;
      }
      .card-body {
        display: grid;
        gap: 16px;
      }
      .card-body.collapsed .items,
      .card-body.collapsed .add-item {
        display: none;
      }
      .items {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 12px;
      }
      .item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(148, 163, 184, 0.06);
        border: 1px solid rgba(148, 163, 184, 0.15);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .item.dragging {
        opacity: 0.4;
        border: 1px dashed var(--accent-primary);
        background: var(--bg-tertiary);
      }
      .item-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
      }
      .drag-handle {
        cursor: grab;
        color: var(--text-secondary);
        font-size: 1rem;
        user-select: none;
        display: flex;
        align-items: center;
        opacity: 0.5;
        transition: opacity 0.2s;
      }
      .drag-handle:hover {
        opacity: 1;
      }
      .drag-handle:active {
        cursor: grabbing;
      }
      .item-label {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
        margin: 0;
      }
      .item-label input[type='checkbox'] {
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 6px;
        border: 2px solid rgba(99, 102, 241, 0.6);
        background: transparent;
        position: relative;
        cursor: pointer;
        transition:
          background 0.2s ease,
          border-color 0.2s ease;
        flex-shrink: 0;
      }
      .item-label input[type='checkbox']:checked {
        background: rgba(59, 130, 246, 0.96);
        border-color: rgba(59, 130, 246, 0.96);
      }
      .item-label input[type='checkbox']:checked::after {
        content: '✓';
        position: absolute;
        top: 0;
        left: 3px;
        color: white;
        font-size: 0.9rem;
      }
      .checkbox-custom {
        display: none;
      }
      .item-text-display {
        font-size: 0.95rem;
        color: var(--text-primary);
        flex: 1;
        min-width: 0;
        word-break: break-word;
      }
      .item-text-display.done-text {
        text-decoration: line-through;
        color: var(--text-secondary);
        opacity: 0.75;
      }
      .item-text-edit-input {
        flex: 1;
        min-width: 0;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid var(--accent-primary);
        background: var(--bg-input);
        color: var(--text-primary);
        font-size: 0.95rem;
        outline: none;
      }
      .item-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .icon-btn-sm {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        background: rgba(148, 163, 184, 0.12);
        border: none;
        color: var(--text-primary);
        cursor: pointer;
        font-size: 0.85rem;
        transition: transform 0.2s, background 0.2s;
      }
      .icon-btn-sm:hover {
        transform: scale(1.05);
        background: rgba(99, 102, 241, 0.15);
      }
      .icon-btn-sm.save {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }
      .icon-btn-sm.cancel {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
      }
      .icon-btn-sm.danger {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
      }
      .icon-btn-sm.danger:hover {
        background: rgba(239, 68, 68, 0.25);
      }
      .add-item {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .add-item input {
        flex: 1;
        min-width: 180px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: var(--bg-primary);
        transition: border-color 0.2s ease;
      }
      .add-item input:focus {
        outline: none;
        border-color: rgba(99, 102, 241, 0.8);
      }
      .btn {
        border-radius: 14px;
        padding: 0.9rem 1rem;
        border: none;
        cursor: pointer;
        transition:
          transform 0.2s ease,
          filter 0.2s ease;
      }
      .btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
      }
      .btn-primary {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95));
        color: white;
      }
      .btn-secondary {
        background: rgba(15, 23, 42, 0.06);
        color: var(--text-primary);
      }
      @media (max-width: 768px) {
        .manager-header {
          flex-direction: column;
          align-items: stretch;
        }
        .cards {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 576px) {
        .quick-add {
          flex-direction: column;
          align-items: stretch;
          padding: 12px;
        }
        .quick-add input {
          min-width: unset;
          width: 100%;
        }
        .quick-add button {
          width: 100%;
        }
        .add-item {
          flex-direction: column;
          align-items: stretch;
        }
        .add-item input {
          min-width: unset;
          width: 100%;
        }
        .add-item button {
          width: 100%;
        }
        .card {
          padding: 16px;
        }
      }
    `,
  ],
})
export class ChecklistManagerComponent {
  svc = inject(StandupNoteService);

  groups: ChecklistGroup[] = [];
  newGroupTitle = '';
  pendingItem: Record<string, string> = {};
  collapsedGroups: Record<string, boolean> = {};

  // Edit & Drag-and-Drop states
  editingItemId = '';
  editItemText = '';
  draggedGroupId: string | null = null;
  draggedItemIndex: number | null = null;

  constructor() {
    this.svc.state$.subscribe((s) => {
      this.groups = s.checklistGroups || [];
    });
  }

  createGroup() {
    const title = this.newGroupTitle.trim();
    if (!title) return;
    this.svc.addChecklistGroup({ title, items: [] });
    this.newGroupTitle = '';
  }

  renameGroup(group: ChecklistGroup) {
    const title = group.title.trim();
    if (!title) return;
    this.svc.updateChecklistGroup(group);
  }

  deleteGroup(id: string) {
    if (!confirm('Delete checklist group?')) return;
    this.svc.deleteChecklistGroup(id);
  }

  addItem(groupId: string) {
    const text = (this.pendingItem[groupId] || '').trim();
    if (!text) return;
    this.svc.addChecklistItem(groupId, { text, done: false });
    this.pendingItem[groupId] = '';
  }

  updateItem(groupId: string, item: ChecklistItem) {
    if (!item.text.trim()) return;
    this.svc.updateChecklistItem(groupId, item);
  }

  startEditItem(item: ChecklistItem) {
    this.editingItemId = item.id;
    this.editItemText = item.text;
  }

  saveItemEdit(groupId: string, item: ChecklistItem) {
    if (this.editingItemId !== item.id) return;
    const text = this.editItemText.trim();
    if (text && text !== item.text) {
      this.svc.updateChecklistItem(groupId, { ...item, text });
    }
    this.editingItemId = '';
  }

  cancelEditItem() {
    this.editingItemId = '';
    this.editItemText = '';
  }

  onDragStart(event: DragEvent, groupId: string, index: number) {
    this.draggedGroupId = groupId;
    this.draggedItemIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, groupId: string, targetIndex: number) {
    event.preventDefault();
    if (this.draggedGroupId !== groupId || this.draggedItemIndex === null || this.draggedItemIndex === targetIndex) {
      return;
    }
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return;

    const items = [...group.items];
    const [removed] = items.splice(this.draggedItemIndex, 1);
    items.splice(targetIndex, 0, removed);

    this.svc.updateChecklistGroup({ ...group, items });

    this.draggedGroupId = null;
    this.draggedItemIndex = null;
  }

  onDragEnd() {
    this.draggedGroupId = null;
    this.draggedItemIndex = null;
  }

  removeItem(groupId: string, itemId: string) {
    if (!confirm('Remove this item?')) return;
    this.svc.deleteChecklistItem(groupId, itemId);
  }

  toggleItemDone(groupId: string, item: ChecklistItem) {
    this.svc.updateChecklistItem(groupId, item);
  }

  toggleGroupCollapse(groupId: string) {
    this.collapsedGroups[groupId] = !this.collapsedGroups[groupId];
  }

  isCollapsed(groupId: string) {
    return !!this.collapsedGroups[groupId];
  }

  getCompletedCount(group: ChecklistGroup) {
    return group.items.filter((item) => item.done).length;
  }

  getProgressPercent(group: ChecklistGroup) {
    return group.items.length
      ? Math.round((this.getCompletedCount(group) / group.items.length) * 100)
      : 0;
  }
}
