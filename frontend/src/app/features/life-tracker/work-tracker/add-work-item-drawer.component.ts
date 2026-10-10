import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkTrackerService } from './work-tracker.service';
import { TaskPriority, TaskStatus, WorkItemType } from './work-tracker.models';

@Component({
  selector: 'app-add-work-item-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside
      class="work-item-drawer"
      [class.open]="service.isAddDrawerOpen()"
      aria-label="Add or Edit Work Item"
    >
      <!-- Header -->
      <header class="drawer-header">
        <h2>{{ isEditing() ? 'Edit Work Item' : 'Add Work Item' }}</h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Close drawer"
          (click)="service.closeAddDrawer()"
        >
          <i class="pi pi-times"></i>
        </button>
      </header>

      <!-- Tabs: Task, Project, Meeting, Time Log -->
      <div class="item-type-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab-pill"
          [class.active]="selectedTab() === 'task'"
          (click)="selectedTab.set('task')"
        >
          Task
        </button>
        <button
          type="button"
          role="tab"
          class="tab-pill"
          [class.active]="selectedTab() === 'project'"
          (click)="selectedTab.set('project')"
        >
          Project
        </button>
        <button
          type="button"
          role="tab"
          class="tab-pill"
          [class.active]="selectedTab() === 'meeting'"
          (click)="selectedTab.set('meeting')"
        >
          Meeting
        </button>
        <button
          type="button"
          role="tab"
          class="tab-pill"
          [class.active]="selectedTab() === 'timeLog'"
          (click)="selectedTab.set('timeLog')"
        >
          Time Log
        </button>
      </div>

      <!-- ─── TAB 1: TASK FORM ─── -->
      <form *ngIf="selectedTab() === 'task'" class="drawer-form" (ngSubmit)="saveTask()">
        <!-- Title -->
        <div class="form-group">
          <label for="taskTitle">Title <span class="required">*</span></label>
          <input
            id="taskTitle"
            type="text"
            [(ngModel)]="title"
            name="title"
            placeholder="e.g. Prepare project presentation"
            required
            class="form-control"
          />
        </div>

        <!-- Description with Rich Text Toolbar -->
        <div class="form-group">
          <label>Description</label>
          <div class="rich-editor-box">
            <div class="rich-toolbar">
              <button type="button" class="tool-btn bold" title="Bold">B</button>
              <button type="button" class="tool-btn italic" title="Italic">I</button>
              <button type="button" class="tool-btn underline" title="Underline">U</button>
              <button type="button" class="tool-btn strike" title="Strikethrough">S</button>
              <span class="tool-sep"></span>
              <button type="button" class="tool-btn icon-tool" title="Bullet List">
                <i class="pi pi-list"></i>
              </button>
              <button type="button" class="tool-btn icon-tool" title="Numbered List">
                <i class="pi pi-sort-numeric-down"></i>
              </button>
              <button type="button" class="tool-btn icon-tool" title="Insert Link">
                <i class="pi pi-link"></i>
              </button>
            </div>
            <textarea
              [(ngModel)]="description"
              name="description"
              rows="3"
              placeholder="Add task details, notes, or checklist..."
              class="rich-textarea"
            ></textarea>
          </div>
        </div>

        <!-- Project & Category Row -->
        <div class="form-row-2">
          <div class="form-group">
            <label for="taskProject">Project <span class="required">*</span></label>
            <div class="select-wrap">
              <select
                id="taskProject"
                [(ngModel)]="selectedProjectId"
                name="selectedProjectId"
                class="form-control"
              >
                <option *ngFor="let p of service.projects()" [value]="p.id">
                  {{ p.name }}
                </option>
              </select>
              <i class="pi pi-chevron-down select-chevron"></i>
            </div>
          </div>

          <div class="form-group">
            <label for="taskCategory">Category</label>
            <div class="select-wrap">
              <select
                id="taskCategory"
                [(ngModel)]="category"
                name="category"
                class="form-control"
              >
                <option value="Development">Development</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Research">Research</option>
                <option value="Documentation">Documentation</option>
                <option value="Meeting">Meeting</option>
                <option value="Planning">Planning</option>
              </select>
              <i class="pi pi-chevron-down select-chevron"></i>
            </div>
          </div>
        </div>

        <!-- Priority Pill Selectors -->
        <div class="form-group">
          <label>Priority <span class="required">*</span></label>
          <div class="priority-pills-row">
            <button
              type="button"
              class="priority-pill low"
              [class.active]="priority === 'Low'"
              (click)="priority = 'Low'"
            >
              Low
            </button>
            <button
              type="button"
              class="priority-pill medium"
              [class.active]="priority === 'Medium'"
              (click)="priority = 'Medium'"
            >
              Medium
            </button>
            <button
              type="button"
              class="priority-pill high"
              [class.active]="priority === 'High'"
              (click)="priority = 'High'"
            >
              High
            </button>
            <button
              type="button"
              class="priority-pill urgent"
              [class.active]="priority === 'Urgent'"
              (click)="priority = 'Urgent'"
            >
              Urgent
            </button>
          </div>
        </div>

        <!-- Status & Due Date Row -->
        <div class="form-row-2">
          <div class="form-group">
            <label for="taskStatus">Status</label>
            <div class="select-wrap">
              <select
                id="taskStatus"
                [(ngModel)]="status"
                name="status"
                class="form-control"
              >
                <option value="Not Started">⚙ Not Started</option>
                <option value="In Progress">⏳ In Progress</option>
                <option value="Completed">✓ Completed</option>
                <option value="Blocked">⛔ Blocked</option>
              </select>
              <i class="pi pi-chevron-down select-chevron"></i>
            </div>
          </div>

          <div class="form-group">
            <label for="taskDueDate">Due Date <span class="required">*</span></label>
            <div class="input-icon-wrap">
              <input
                id="taskDueDate"
                type="date"
                [(ngModel)]="dueDate"
                name="dueDate"
                required
                class="form-control"
              />
              <i class="pi pi-calendar input-icon"></i>
            </div>
          </div>
        </div>

        <!-- Estimated Time -->
        <div class="form-group">
          <label for="estTime">Estimated Time</label>
          <div class="input-icon-wrap">
            <i class="pi pi-clock input-icon-left"></i>
            <input
              id="estTime"
              type="text"
              [(ngModel)]="estimatedTimeDisplay"
              name="estimatedTimeDisplay"
              placeholder="e.g. 2 hours"
              class="form-control pl-icon"
            />
          </div>
        </div>

        <!-- Tags -->
        <div class="form-group">
          <label for="tagInput">Tags (Optional)</label>
          <div class="tags-container">
            <span *ngFor="let t of tags; let i = index" class="tag-chip">
              {{ t }}
              <button type="button" class="tag-remove" (click)="removeTag(i)">×</button>
            </span>
            <input
              id="tagInput"
              type="text"
              [(ngModel)]="newTagInput"
              name="newTagInput"
              placeholder="Add tag..."
              (keydown.enter)="$event.preventDefault(); addTag()"
              class="tag-inline-input"
            />
          </div>
        </div>

        <!-- Assignee -->
        <div class="form-group">
          <label for="taskAssignee">Assignee</label>
          <div class="select-wrap">
            <select
              id="taskAssignee"
              [(ngModel)]="assigneeName"
              name="assigneeName"
              class="form-control"
            >
              <option value="Mani">👤 Mani</option>
              <option value="Alex">👤 Alex</option>
              <option value="Sarah">👤 Sarah</option>
              <option value="David">👤 David</option>
            </select>
            <i class="pi pi-chevron-down select-chevron"></i>
          </div>
        </div>

        <!-- Set Reminder Toggle -->
        <div class="reminder-row">
          <label class="switch-label">
            <label class="switch">
              <input type="checkbox" [(ngModel)]="hasReminder" name="hasReminder" />
              <span class="slider round"></span>
            </label>
            <span>Set Reminder</span>
          </label>

          <div *ngIf="hasReminder" class="reminder-time-input">
            <input
              type="text"
              [(ngModel)]="reminderDateTime"
              name="reminderDateTime"
              placeholder="May 31, 2026 09:00 AM"
              class="form-control reminder-date-picker"
            />
            <i class="pi pi-calendar reminder-cal-icon"></i>
          </div>
        </div>

        <!-- Actions -->
        <div class="drawer-actions">
          <button
            type="button"
            class="btn btn-cancel"
            (click)="service.closeAddDrawer()"
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-save">
            {{ isEditing() ? 'Update Work Item' : 'Save Work Item' }}
          </button>
        </div>
      </form>

      <!-- ─── TAB 2: PROJECT FORM ─── -->
      <form *ngIf="selectedTab() === 'project'" class="drawer-form" (ngSubmit)="saveProject()">
        <div class="form-group">
          <label for="projName">Project Name <span class="required">*</span></label>
          <input
            id="projName"
            type="text"
            [(ngModel)]="newProjectName"
            name="newProjectName"
            placeholder="e.g. Mobile App Redesign"
            required
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="projCategory">Category</label>
          <input
            id="projCategory"
            type="text"
            [(ngModel)]="newProjectCategory"
            name="newProjectCategory"
            placeholder="e.g. Design, Mobile, Web"
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label>Theme Color</label>
          <div class="color-picker-row">
            <button
              type="button"
              *ngFor="let c of projectColors"
              class="color-dot"
              [style.background-color]="c"
              [class.active]="newProjectColor === c"
              (click)="newProjectColor = c"
            ></button>
          </div>
        </div>

        <div class="drawer-actions">
          <button
            type="button"
            class="btn btn-cancel"
            (click)="service.closeAddDrawer()"
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-save">Create Project</button>
        </div>
      </form>

      <!-- ─── TAB 3: MEETING FORM ─── -->
      <form *ngIf="selectedTab() === 'meeting'" class="drawer-form" (ngSubmit)="saveMeeting()">
        <div class="form-group">
          <label for="meetTitle">Meeting Title <span class="required">*</span></label>
          <input
            id="meetTitle"
            type="text"
            [(ngModel)]="meetingTitle"
            name="meetingTitle"
            placeholder="e.g. Design Review, Sprint Planning"
            required
            class="form-control"
          />
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="meetStart">Start Time</label>
            <input
              id="meetStart"
              type="text"
              [(ngModel)]="meetingStart"
              name="meetingStart"
              placeholder="10:00 AM"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label for="meetEnd">End Time</label>
            <input
              id="meetEnd"
              type="text"
              [(ngModel)]="meetingEnd"
              name="meetingEnd"
              placeholder="11:00 AM"
              class="form-control"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="meetSubtitle">Location / Platform</label>
          <input
            id="meetSubtitle"
            type="text"
            [(ngModel)]="meetingSubtitle"
            name="meetingSubtitle"
            placeholder="e.g. Google Meet, Online, Conference Room A"
            class="form-control"
          />
        </div>

        <div class="drawer-actions">
          <button
            type="button"
            class="btn btn-cancel"
            (click)="service.closeAddDrawer()"
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-save">Schedule Meeting</button>
        </div>
      </form>

      <!-- ─── TAB 4: TIME LOG FORM ─── -->
      <form *ngIf="selectedTab() === 'timeLog'" class="drawer-form" (ngSubmit)="saveTimeLog()">
        <div class="form-group">
          <label for="tlCategory">Activity Category <span class="required">*</span></label>
          <select
            id="tlCategory"
            [(ngModel)]="timeLogCategory"
            name="timeLogCategory"
            class="form-control"
          >
            <option value="Focused Work">Focused Work</option>
            <option value="Meetings">Meetings</option>
            <option value="Documentation">Documentation</option>
            <option value="Others">Others</option>
          </select>
        </div>

        <div class="form-group">
          <label for="tlHours">Hours Logged <span class="required">*</span></label>
          <input
            id="tlHours"
            type="number"
            [(ngModel)]="timeLogHours"
            name="timeLogHours"
            min="0.5"
            step="0.5"
            placeholder="e.g. 2.5"
            required
            class="form-control"
          />
        </div>

        <div class="drawer-actions">
          <button
            type="button"
            class="btn btn-cancel"
            (click)="service.closeAddDrawer()"
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-save">Log Time</button>
        </div>
      </form>
    </aside>
  `,
  styles: [
    `
      .work-item-drawer {
        background: #ffffff;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(226, 232, 240, 0.8);
        display: flex;
        flex-direction: column;
        gap: 18px;
        width: 100%;
        max-width: 400px;
        position: relative;
        transition: all 0.3s ease;
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .drawer-header h2 {
        font-size: 1.15rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }

      .btn-close {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #64748b;
        transition: all 0.2s ease;
      }

      .btn-close:hover {
        background: #f1f5f9;
        color: #0f172a;
      }

      /* Tabs: Task, Project, Meeting, Time Log */
      .item-type-tabs {
        display: flex;
        background: #f8fafc;
        padding: 4px;
        border-radius: 12px;
        gap: 4px;
      }

      .tab-pill {
        flex: 1;
        padding: 7px 10px;
        border: none;
        background: transparent;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
      }

      .tab-pill.active {
        background: #2563eb;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
      }

      /* Form styles */
      .drawer-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-group label {
        font-size: 0.82rem;
        font-weight: 600;
        color: #334155;
      }

      .required {
        color: #ef4444;
      }

      .form-control {
        width: 100%;
        height: 40px;
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #ffffff;
        font-size: 0.88rem;
        color: #0f172a;
        transition: all 0.2s ease;
      }

      .form-control:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
      }

      .form-row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      /* Rich Editor Box */
      .rich-editor-box {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
      }

      .rich-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .tool-btn {
        background: transparent;
        border: none;
        color: #475569;
        font-size: 0.85rem;
        font-weight: 700;
        width: 26px;
        height: 26px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .tool-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
      }

      .tool-btn.bold { font-weight: 900; }
      .tool-btn.italic { font-style: italic; }
      .tool-btn.underline { text-decoration: underline; }
      .tool-btn.strike { text-decoration: line-through; }

      .tool-sep {
        width: 1px;
        height: 16px;
        background: #cbd5e1;
        margin: 0 4px;
      }

      .rich-textarea {
        width: 100%;
        border: none;
        outline: none;
        padding: 10px 12px;
        font-size: 0.85rem;
        font-family: inherit;
        resize: vertical;
      }

      /* Priority Pill Row matching screenshot */
      .priority-pills-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
      }

      .priority-pill {
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 6px 0;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
      }

      .priority-pill.low {
        background: #ecfdf5;
        color: #10b981;
      }
      .priority-pill.low.active {
        border-color: #10b981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
      }

      .priority-pill.medium {
        background: #eff6ff;
        color: #2563eb;
      }
      .priority-pill.medium.active {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
      }

      .priority-pill.high {
        background: #fdf2f8;
        color: #ec4899;
      }
      .priority-pill.high.active {
        border-color: #ec4899;
        box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.2);
      }

      .priority-pill.urgent {
        background: #fef2f2;
        color: #ef4444;
      }
      .priority-pill.urgent.active {
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
      }

      /* Input Wrappers */
      .select-wrap,
      .input-icon-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }

      select.form-control {
        appearance: none;
        padding-right: 30px;
        cursor: pointer;
      }

      .select-chevron {
        position: absolute;
        right: 12px;
        font-size: 0.75rem;
        color: #94a3b8;
        pointer-events: none;
      }

      .input-icon {
        position: absolute;
        right: 12px;
        color: #94a3b8;
        pointer-events: none;
      }

      .input-icon-left {
        position: absolute;
        left: 12px;
        color: #94a3b8;
        pointer-events: none;
      }

      .pl-icon {
        padding-left: 34px;
      }

      /* Tags */
      .tags-container {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #ffffff;
        min-height: 40px;
      }

      .tag-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #e0f2fe;
        color: #0284c7;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 14px;
      }

      .tag-remove {
        background: transparent;
        border: none;
        color: #0284c7;
        font-size: 0.9rem;
        cursor: pointer;
        padding: 0;
      }

      .tag-inline-input {
        border: none;
        outline: none;
        font-size: 0.82rem;
        flex: 1;
        min-width: 90px;
        padding: 4px 0;
        background: transparent;
      }

      /* Reminder Row */
      .reminder-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 0;
      }

      .switch-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.84rem;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
      }

      .switch {
        position: relative;
        display: inline-block;
        width: 38px;
        height: 22px;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: #cbd5e1;
        transition: 0.3s;
        border-radius: 22px;
      }

      .slider:before {
        position: absolute;
        content: '';
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
      }

      input:checked + .slider {
        background-color: #2563eb;
      }

      input:checked + .slider:before {
        transform: translateX(16px);
      }

      .reminder-time-input {
        position: relative;
        display: inline-flex;
        align-items: center;
        flex: 1;
        max-width: 190px;
      }

      .reminder-date-picker {
        height: 34px;
        font-size: 0.78rem;
        padding: 4px 28px 4px 8px;
      }

      .reminder-cal-icon {
        position: absolute;
        right: 8px;
        font-size: 0.8rem;
        color: #94a3b8;
        pointer-events: none;
      }

      /* Color picker */
      .color-picker-row {
        display: flex;
        gap: 8px;
        padding: 4px 0;
      }

      .color-dot {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
      }

      .color-dot.active {
        border-color: #0f172a;
        transform: scale(1.15);
      }

      /* Drawer Actions */
      .drawer-actions {
        display: flex;
        gap: 12px;
        margin-top: 6px;
      }

      .btn {
        flex: 1;
        height: 40px;
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .btn-cancel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        color: #475569;
      }

      .btn-cancel:hover {
        background: #f8fafc;
        color: #0f172a;
      }

      .btn-save {
        background: #2563eb;
        border: none;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
      }

      .btn-save:hover {
        background: #1d4ed8;
      }
    `,
  ],
})
export class AddWorkItemDrawerComponent {
  service = inject(WorkTrackerService);

  selectedTab = signal<WorkItemType>('task');

  // Task form bindings
  title = 'Prepare project presentation';
  description = 'Prepare slide deck and demo walkthrough for stakeholder meeting.';
  selectedProjectId = 'p-1';
  category = 'Development';
  priority: TaskPriority = 'Medium';
  status: TaskStatus = 'Not Started';
  dueDate = '2026-05-31';
  estimatedTimeDisplay = '2 hours';
  tags: string[] = ['feature', 'frontend'];
  newTagInput = '';
  assigneeName = 'Mani';
  hasReminder = true;
  reminderDateTime = 'May 31, 2026 09:00 AM';

  // Project form bindings
  newProjectName = '';
  newProjectCategory = 'Development';
  newProjectColor = '#3b82f6';
  projectColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#64748b'];

  // Meeting form bindings
  meetingTitle = '';
  meetingStart = '10:00 AM';
  meetingEnd = '11:00 AM';
  meetingSubtitle = 'Online Meeting';

  // Time log form bindings
  timeLogCategory: 'Focused Work' | 'Meetings' | 'Documentation' | 'Others' = 'Focused Work';
  timeLogHours = 2;

  isEditing = computed(() => !!this.service.editingTask());

  constructor() {
    effect(() => {
      const editTask = this.service.editingTask();
      if (editTask) {
        this.selectedTab.set('task');
        this.title = editTask.title;
        this.description = editTask.description || '';
        this.selectedProjectId = editTask.projectId;
        this.category = editTask.category;
        this.priority = editTask.priority;
        this.status = editTask.status;
        this.dueDate = editTask.dueDate;
        this.estimatedTimeDisplay = editTask.estimatedHours ? `${editTask.estimatedHours} hours` : '2 hours';
        this.tags = [...editTask.tags];
        this.assigneeName = editTask.assignee?.name || 'Mani';
        this.hasReminder = editTask.hasReminder;
        this.reminderDateTime = editTask.reminderDateTime || 'May 31, 2026 09:00 AM';
      }
    });
  }

  addTag(): void {
    const trimmed = this.newTagInput.trim();
    if (trimmed && !this.tags.includes(trimmed)) {
      this.tags.push(trimmed);
      this.newTagInput = '';
    }
  }

  removeTag(idx: number): void {
    this.tags.splice(idx, 1);
  }

  saveTask(): void {
    if (!this.title.trim()) {
      alert('Please provide a task title');
      return;
    }

    const project = this.service.projects().find((p) => p.id === this.selectedProjectId);
    const projectName = project ? project.name : 'U2Tools';

    const hours = parseFloat(this.estimatedTimeDisplay) || 2;

    const taskPayload = {
      title: this.title,
      description: this.description,
      projectId: this.selectedProjectId,
      projectName,
      category: this.category,
      priority: this.priority,
      status: this.status,
      dueDate: this.dueDate,
      dueDateLabel: this.dueDate === '2026-05-31' ? 'Today' : 'May 31',
      estimatedHours: hours,
      tags: [...this.tags],
      assignee: { name: this.assigneeName },
      hasReminder: this.hasReminder,
      reminderDateTime: this.hasReminder ? this.reminderDateTime : undefined,
    };

    const currentEdit = this.service.editingTask();
    if (currentEdit) {
      this.service.updateTask(currentEdit.id, taskPayload);
    } else {
      this.service.addTask(taskPayload);
    }

    this.service.closeAddDrawer();
  }

  saveProject(): void {
    if (!this.newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    this.service.addProject({
      name: this.newProjectName,
      color: this.newProjectColor,
      icon: 'pi pi-folder',
      category: this.newProjectCategory,
    });

    this.newProjectName = '';
    this.service.closeAddDrawer();
  }

  saveMeeting(): void {
    if (!this.meetingTitle.trim()) {
      alert('Please enter a meeting title');
      return;
    }

    this.service.addScheduleItem({
      timeStart: this.meetingStart,
      timeEnd: this.meetingEnd,
      title: this.meetingTitle,
      subtitle: this.meetingSubtitle,
      type: 'meeting',
      icon: 'pi pi-video',
      color: '#06b6d4',
      date: '2026-05-31',
    });

    this.meetingTitle = '';
    this.service.closeAddDrawer();
  }

  saveTimeLog(): void {
    if (this.timeLogHours <= 0) return;
    this.service.addTimeLog(this.timeLogCategory, Number(this.timeLogHours));
    this.service.closeAddDrawer();
  }
}
