import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StandupNoteService, ChecklistGroup, ChecklistItem } from '../standup-note.service';
import { ThemeService } from '../../../core/services/theme.service';

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
          (keyup.enter)="createGroup()"
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
        <article *ngFor="let g of groups" class="card" [ngStyle]="getGroupStyles(g)">
          <div class="card-header">
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
                <!-- Color picker -->
                <div class="color-picker-wrapper" title="Change group color">
                  <span class="color-icon">🎨</span>
                  <input
                    type="color"
                    [ngModel]="g.color || '#6366f1'"
                    (ngModelChange)="updateGroupColor(g, $event)"
                    class="color-picker-input"
                  />
                </div>
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
          </div>

          <div class="card-body-content" [class.collapsed]="isCollapsed(g.id)">
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
                    
                    <!-- Logo/Icon Display (only if assigned, taking 0 space otherwise) -->
                    <div class="item-icon-wrapper" *ngIf="it.icon && editingItemId !== it.id">
                      <img
                        *ngIf="isDataUrlOrUrl(it.icon)"
                        [src]="it.icon"
                        class="item-icon-img"
                        alt="logo"
                      />
                      <span *ngIf="!isDataUrlOrUrl(it.icon)" class="item-icon-emoji">
                        {{ it.icon }}
                      </span>
                    </div>
                    
                    <!-- Display Mode -->
                    <span
                      *ngIf="editingItemId !== it.id"
                      class="item-text-display"
                      [class.done-text]="it.done"
                    >
                      {{ it.text }}
                    </span>
                    
                    <!-- Edit Mode -->
                    <div class="item-edit-container" *ngIf="editingItemId === it.id">
                      <div class="edit-input-row">
                        <!-- Icon Picker Button Trigger -->
                        <button
                          type="button"
                          class="icon-picker-btn"
                          (click)="toggleIconPicker(it.id)"
                          title="Choose Icon"
                        >
                          <span *ngIf="editItemIcon" class="selected-icon-preview">
                            <img
                              *ngIf="isDataUrlOrUrl(editItemIcon)"
                              [src]="editItemIcon"
                              class="picker-icon-img"
                              alt="Selected Icon"
                            />
                            <span *ngIf="!isDataUrlOrUrl(editItemIcon)">{{ editItemIcon }}</span>
                          </span>
                          <span *ngIf="!editItemIcon" class="add-icon-plus">🎨</span>
                        </button>
                        
                        <input
                          [(ngModel)]="editItemText"
                          (keyup.enter)="saveItemEdit(g.id, it)"
                          class="item-text-edit-input"
                          #editInput
                        />
                      </div>

                      <!-- Icon selector dropdown -->
                      <div class="icon-picker-dropdown" *ngIf="activeIconPickerId === it.id">
                        <div class="emoji-grid">
                          <button
                            type="button"
                            *ngFor="let emoji of presetEmojis"
                            (click)="selectPresetEmoji(emoji)"
                            class="emoji-btn"
                          >
                            {{ emoji }}
                          </button>
                        </div>
                        <div class="picker-divider"></div>
                        <div class="dropdown-actions">
                          <label class="upload-btn-label">
                            📤 Upload
                            <input
                              type="file"
                              accept="image/*"
                              (change)="onUploadItemIcon($event)"
                              hidden
                            />
                          </label>
                          <button
                            type="button"
                            *ngIf="editItemIcon"
                            class="clear-btn"
                            (click)="clearItemIcon()"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
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
        color: var(--text-primary);
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
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 18px;
      }
      .card {
        display: flex;
        flex-direction: column;
        border-radius: 24px;
        background: var(--group-bg, var(--bg-secondary));
        border: 1px solid var(--group-border, rgba(148, 163, 184, 0.18));
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
        transition:
          transform 0.24s ease,
          border-color 0.24s ease;
        overflow: hidden;
        color: var(--group-text, var(--text-primary));
      }
      .card:hover {
        transform: translateY(-2px);
      }
      .card-header {
        background: var(--group-header-bg, rgba(148, 163, 184, 0.08));
        padding: 20px 20px 16px;
        border-bottom: 1px solid var(--group-border, rgba(148, 163, 184, 0.18));
        display: flex;
        flex-direction: column;
        gap: 12px;
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
        gap: 4px;
        min-width: 0;
        flex: 1;
      }
      .group-title {
        width: 100%;
        font-size: 1.05rem;
        font-weight: 700;
        border: none;
        background: transparent;
        color: var(--group-header-text, var(--text-primary));
        padding: 0;
        transition: border-bottom 0.15s;
        border-bottom: 1px dashed transparent;
      }
      .group-title:focus {
        outline: none;
        border-bottom-color: var(--group-header-text, var(--text-primary));
      }
      .group-meta {
        font-size: 0.85rem;
        color: var(--group-header-text, var(--text-secondary));
        opacity: 0.85;
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
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: rgba(148, 163, 184, 0.12);
        border: none;
        color: var(--group-header-text, var(--text-primary));
        cursor: pointer;
        transition:
          transform 0.2s ease,
          background 0.2s ease;
      }
      .icon-btn:hover {
        transform: scale(1.04);
        background: rgba(148, 163, 184, 0.22);
      }
      .icon-btn.danger {
        background: rgba(248, 113, 113, 0.14);
        color: #ef4444;
      }
      .icon-btn.danger:hover {
        background: rgba(248, 113, 113, 0.25);
      }
      .progress-bar {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: var(--group-progress-bg, rgba(99, 102, 241, 0.14));
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: inherit;
        background: var(--group-progress-fill, linear-gradient(90deg, rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.75)));
        transition: width 0.3s ease;
      }
      .card-body-content {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .card-body-content.collapsed {
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
        background: var(--group-item-bg, rgba(148, 163, 184, 0.06));
        border: 1px solid var(--group-item-border, rgba(148, 163, 184, 0.15));
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        color: var(--group-text, var(--text-primary));
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
        color: var(--group-text, var(--text-secondary));
        opacity: 0.5;
        font-size: 1rem;
        user-select: none;
        display: flex;
        align-items: center;
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
        position: relative;
      }
      .item-label input[type='checkbox'] {
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 6px;
        border: 2px solid var(--group-text, rgba(99, 102, 241, 0.6));
        background: transparent;
        position: relative;
        cursor: pointer;
        transition:
          background 0.2s ease,
          border-color 0.2s ease;
        flex-shrink: 0;
      }
      .item-label input[type='checkbox']:checked {
        background: var(--group-progress-fill, rgba(59, 130, 246, 0.96));
        border-color: var(--group-progress-fill, rgba(59, 130, 246, 0.96));
      }
      .item-label input[type='checkbox']:checked::after {
        content: '✓';
        position: absolute;
        top: -1px;
        left: 2px;
        color: white;
        font-size: 0.85rem;
        font-weight: bold;
      }
      .checkbox-custom {
        display: none;
      }
      .item-text-display {
        font-size: 0.95rem;
        color: var(--group-text, var(--text-primary));
        flex: 1;
        min-width: 0;
        word-break: break-word;
      }
      .item-text-display.done-text {
        text-decoration: line-through;
        color: var(--group-text, var(--text-secondary));
        opacity: 0.6;
      }
      .item-text-edit-input {
        flex: 1;
        min-width: 0;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid var(--group-progress-fill, var(--accent-primary));
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
        color: var(--group-text, var(--text-primary));
        cursor: pointer;
        font-size: 0.85rem;
        transition: transform 0.2s, background 0.2s;
      }
      .icon-btn-sm:hover {
        transform: scale(1.05);
        background: rgba(148, 163, 184, 0.22);
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
        color: var(--text-primary);
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
      body.theme-dark .btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-primary);
      }

      /* Color Picker custom wrapper styles */
      .color-picker-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: rgba(148, 163, 184, 0.15);
        cursor: pointer;
        transition: transform 0.2s ease, background 0.2s ease;
      }
      .color-picker-wrapper:hover {
        transform: scale(1.05);
        background: rgba(148, 163, 184, 0.25);
      }
      .color-icon {
        font-size: 1.1rem;
        pointer-events: none;
        color: var(--group-header-text, var(--text-primary));
      }
      .color-picker-input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        border: none;
        padding: 0;
      }

      /* Item Icon display styling */
      .item-icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(148, 163, 184, 0.15);
        flex-shrink: 0;
        overflow: hidden;
      }
      .item-icon-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .item-icon-emoji {
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Item Icon Selector editing container & dropdown */
      .item-edit-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-width: 0;
        position: relative;
      }
      .edit-input-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
      }
      .icon-picker-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(148, 163, 184, 0.1);
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
        flex-shrink: 0;
      }
      .icon-picker-btn:hover {
        background: rgba(99, 102, 241, 0.15);
        border-color: rgba(99, 102, 241, 0.4);
      }
      .selected-icon-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 6px;
      }
      .picker-icon-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .add-icon-plus {
        font-size: 0.95rem;
      }
      .icon-picker-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 100;
        margin-top: 6px;
        background: var(--bg-secondary);
        border: 1px solid rgba(148, 163, 184, 0.25);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        border-radius: 12px;
        padding: 10px;
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .emoji-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
      }
      .emoji-btn {
        background: none;
        border: none;
        font-size: 1.15rem;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: background 0.2s, transform 0.1s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-primary);
      }
      .emoji-btn:hover {
        background: rgba(99, 102, 241, 0.15);
        transform: scale(1.1);
      }
      .picker-divider {
        height: 1px;
        background: rgba(148, 163, 184, 0.2);
        margin: 2px 0;
      }
      .dropdown-actions {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }
      .upload-btn-label {
        font-size: 0.8rem;
        font-weight: 600;
        background: rgba(99, 102, 241, 0.12);
        color: var(--accent-primary);
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .upload-btn-label:hover {
        background: rgba(99, 102, 241, 0.2);
      }
      .clear-btn {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: none;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .clear-btn:hover {
        background: rgba(239, 68, 68, 0.18);
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
        .card-header {
          padding: 16px;
        }
        .card-body-content {
          padding: 16px;
        }
      }
    `,
  ],
})
export class ChecklistManagerComponent {
  svc = inject(StandupNoteService);
  themeSvc = inject(ThemeService);

  groups: ChecklistGroup[] = [];
  newGroupTitle = '';
  pendingItem: Record<string, string> = {};
  collapsedGroups: Record<string, boolean> = {};

  // Edit & Drag-and-Drop states
  editingItemId = '';
  editItemText = '';
  editItemIcon = '';
  activeIconPickerId = '';
  draggedGroupId: string | null = null;
  draggedItemIndex: number | null = null;

  presetEmojis = ['📋', '✅', '🚀', '💻', '🎨', '📅', '⚠️', '💡', '🔧', '🔍', '💬', '🎉', '🌟', '🎯', '🔥'];

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
    this.editItemIcon = item.icon || '';
    this.activeIconPickerId = '';
  }

  saveItemEdit(groupId: string, item: ChecklistItem) {
    if (this.editingItemId !== item.id) return;
    const text = this.editItemText.trim();
    if (text) {
      const updatedItem: ChecklistItem = {
        ...item,
        text,
        icon: this.editItemIcon || undefined,
      };
      if (!this.editItemIcon) {
        delete updatedItem.icon;
      }
      this.svc.updateChecklistItem(groupId, updatedItem);
    }
    this.editingItemId = '';
    this.activeIconPickerId = '';
  }

  cancelEditItem() {
    this.editingItemId = '';
    this.editItemText = '';
    this.editItemIcon = '';
    this.activeIconPickerId = '';
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

  // Color selection and customization
  updateGroupColor(group: ChecklistGroup, color: string) {
    this.svc.updateChecklistGroup({ ...group, color });
  }

  getGroupStyles(g: ChecklistGroup) {
    const theme = this.themeSvc.theme();
    const color = g.color || '#6366f1';
    const hsl = this.hexToHsl(color);

    if (theme === 'dark') {
      const bg = `hsl(${hsl.h}, ${Math.min(hsl.s, 25)}%, 14%)`;
      const headerBg = `hsl(${hsl.h}, ${Math.min(hsl.s, 30)}%, 18%)`;
      const border = `1px solid hsl(${hsl.h}, ${Math.min(hsl.s, 25)}%, 22%)`;
      const text = `hsl(${hsl.h}, 10%, 90%)`;
      const headerText = `hsl(${hsl.h}, 20%, 95%)`;
      const itemBg = `rgba(0, 0, 0, 0.25)`;
      const itemBorder = `1px solid hsl(${hsl.h}, ${Math.min(hsl.s, 25)}%, 22%)`;
      const progressBg = `hsl(${hsl.h}, ${Math.min(hsl.s, 20)}%, 22%)`;
      const progressFill = `hsl(${hsl.h}, ${Math.max(hsl.s, 60)}%, 55%)`;

      return {
        '--group-bg': bg,
        '--group-header-bg': headerBg,
        '--group-border': border,
        '--group-text': text,
        '--group-header-text': headerText,
        '--group-item-bg': itemBg,
        '--group-item-border': itemBorder,
        '--group-progress-bg': progressBg,
        '--group-progress-fill': progressFill,
      };
    } else {
      const bg = `hsl(${hsl.h}, ${Math.min(hsl.s, 40)}%, 97%)`;
      const headerBg = `hsl(${hsl.h}, ${Math.min(hsl.s, 45)}%, 88%)`;
      const border = `1px solid hsl(${hsl.h}, ${Math.min(hsl.s, 30)}%, 82%)`;
      const text = `hsl(${hsl.h}, 25%, 20%)`;
      const headerText = `hsl(${hsl.h}, 35%, 15%)`;
      const itemBg = `rgba(255, 255, 255, 0.65)`;
      const itemBorder = `1px solid hsl(${hsl.h}, ${Math.min(hsl.s, 25)}%, 84%)`;
      const progressBg = `hsl(${hsl.h}, ${Math.min(hsl.s, 20)}%, 88%)`;
      const progressFill = `hsl(${hsl.h}, ${Math.max(hsl.s, 70)}%, 45%)`;

      return {
        '--group-bg': bg,
        '--group-header-bg': headerBg,
        '--group-border': border,
        '--group-text': text,
        '--group-header-text': headerText,
        '--group-item-bg': itemBg,
        '--group-item-border': itemBorder,
        '--group-progress-bg': progressBg,
        '--group-progress-fill': progressFill,
      };
    }
  }

  hexToHsl(hex: string) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  // Item icon/logo utilities
  isDataUrlOrUrl(val: string): boolean {
    if (!val) return false;
    return val.startsWith('data:') || val.startsWith('http://') || val.startsWith('https://');
  }

  toggleIconPicker(itemId: string) {
    this.activeIconPickerId = this.activeIconPickerId === itemId ? '' : itemId;
  }

  selectPresetEmoji(emoji: string) {
    this.editItemIcon = emoji;
    this.activeIconPickerId = '';
  }

  onUploadItemIcon(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editItemIcon = e.target.result;
        this.activeIconPickerId = '';
      };
      reader.readAsDataURL(file);
    }
  }

  clearItemIcon() {
    this.editItemIcon = '';
    this.activeIconPickerId = '';
  }
}
