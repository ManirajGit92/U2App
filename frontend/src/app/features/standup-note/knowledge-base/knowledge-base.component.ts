import { Component, inject, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, Project, QAEntry, StandupNoteService } from '../standup-note.service';

const PRESET_CATEGORIES = ['Engineering', 'HR', 'Process', 'Design', 'Marketing', 'Finance', 'General'];

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="kb-page">

      <!-- Page Header -->
      <div class="kb-header">
        <div class="kb-header-left">
          <div class="kb-title-group">
            <span class="kb-icon">❓</span>
            <div>
              <h2 class="kb-title">Knowledge Base</h2>
              <p class="kb-subtitle">{{ filtered.length }} of {{ allEntries.length }} entries</p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" (click)="openAdd()">
          <span>＋</span> Add Q&amp;A
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="filter-bar">
        <div class="filter-row-top">
          <div class="search-wrap">
            <span class="search-icon-inner">🔍</span>
            <input type="text" class="input-field search-input" placeholder="Search questions and answers..."
              [(ngModel)]="search" (ngModelChange)="applyFilters()">
          </div>
          <div class="filter-chips-row">
            <select class="input-field filter-sel" [(ngModel)]="fCategory" (ngModelChange)="applyFilters()">
              <option value="">All Categories</option>
              <option *ngFor="let c of allCategories" [value]="c">{{ c }}</option>
            </select>
            <select class="input-field filter-sel" [(ngModel)]="fEmployee" (ngModelChange)="applyFilters()">
              <option value="">All Employees</option>
              <option *ngFor="let e of employees" [value]="e.id">{{ e.name }}</option>
            </select>
            <select class="input-field filter-sel" [(ngModel)]="fProject" (ngModelChange)="applyFilters()">
              <option value="">All Projects</option>
              <option *ngFor="let p of projects" [value]="p.id">{{ p.name }}</option>
            </select>
            <select class="input-field filter-sel" [(ngModel)]="fTag" (ngModelChange)="applyFilters()">
              <option value="">All Tags</option>
              <option *ngFor="let t of allTags" [value]="t">{{ t }}</option>
            </select>
            <button class="btn btn-ghost btn-sm" *ngIf="hasFilters" (click)="clearFilters()">Clear Filters</button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="filtered.length === 0">
        <div class="empty-icon">🧠</div>
        <div class="empty-text">No Q&amp;A entries found.</div>
        <button class="btn btn-primary" (click)="openAdd()">Add First Entry</button>
      </div>

      <!-- List View -->
      <div class="qa-list" *ngIf="filtered.length > 0">
        <div class="qa-card" *ngFor="let entry of filtered; trackBy: trackById">
          <div class="qa-card-header">
            <div class="qa-question-area">
              <div class="qa-category-badge" [class]="'cat-' + getCategoryClass(entry.category)">
                {{ entry.category || 'General' }}
              </div>
              <h3 class="qa-question">{{ entry.question }}</h3>
            </div>
            <div class="qa-actions">
              <button class="icon-btn" title="Edit" (click)="openEdit(entry)">✏️</button>
              <button class="icon-btn" title="Delete" (click)="deleteEntry(entry.id)">🗑️</button>
            </div>
          </div>
          <div class="qa-answer-preview" [innerHTML]="entry.answer"></div>
          <div class="qa-card-footer">
            <div class="qa-meta-chips">
              <span class="meta-chip employee-chip" *ngIf="entry.responsibleEmployeeId">
                👤 {{ getEmpName(entry.responsibleEmployeeId) }}
              </span>
              <span class="meta-chip project-chip" *ngIf="entry.projectId">
                🚀 {{ getProjName(entry.projectId) }}
              </span>
              <span class="tag-chip" *ngFor="let tag of entry.tags">{{ tag }}</span>
            </div>
            <div class="qa-date">🕒 {{ entry.lastUpdated }}</div>
          </div>
        </div>
      </div>

      <!-- Add / Edit Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="stopProp($event)">
          <div class="modal-header">
            <h3>{{ editMode ? 'Edit' : 'Add' }} Q&amp;A Entry</h3>
            <button class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>Question <span class="required">*</span></label>
              <input type="text" class="input-field" [(ngModel)]="form.question" placeholder="What is the question?">
            </div>

            <div class="form-row-group">
              <div class="form-row">
                <label>Category</label>
                <input type="text" class="input-field" [(ngModel)]="form.category" list="category-list" placeholder="Select or type a category">
                <datalist id="category-list">
                  <option *ngFor="let c of PRESET_CATEGORIES" [value]="c">{{ c }}</option>
                </datalist>
              </div>
              <div class="form-row">
                <label>Last Updated</label>
                <input type="date" class="input-field" [(ngModel)]="form.lastUpdated">
              </div>
            </div>

            <div class="form-row-group">
              <div class="form-row emp-select">
                <label>Responsible Employee</label>
                <div class="searchable-select">
                  <div class="select-trigger" (click)="empDropOpen = !empDropOpen; projDropOpen = false; stopProp($event)">
                    <span>{{ selectedEmpName }}</span>
                    <span class="arrow">▼</span>
                  </div>
                  <div class="select-dropdown" *ngIf="empDropOpen" (click)="stopProp($event)">
                    <input type="text" class="input-field select-search" placeholder="Search..." [(ngModel)]="empSearch">
                    <div class="options-list">
                      <div class="option-item reset-opt" (click)="form.responsibleEmployeeId = ''; empDropOpen = false; empSearch = ''">— None —</div>
                      <div class="option-item" *ngFor="let e of filteredEmpsForSelect"
                        [class.selected]="e.id === form.responsibleEmployeeId"
                        (click)="form.responsibleEmployeeId = e.id; empDropOpen = false; empSearch = ''">
                        <div class="opt-title">{{ e.name }}</div>
                        <div class="opt-sub">{{ e.position }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-row proj-select">
                <label>Project</label>
                <div class="searchable-select">
                  <div class="select-trigger" (click)="projDropOpen = !projDropOpen; empDropOpen = false; stopProp($event)">
                    <span>{{ selectedProjName }}</span>
                    <span class="arrow">▼</span>
                  </div>
                  <div class="select-dropdown" *ngIf="projDropOpen" (click)="stopProp($event)">
                    <input type="text" class="input-field select-search" placeholder="Search..." [(ngModel)]="projSearch">
                    <div class="options-list">
                      <div class="option-item reset-opt" (click)="form.projectId = ''; projDropOpen = false; projSearch = ''">— None —</div>
                      <div class="option-item" *ngFor="let p of filteredProjsForSelect"
                        [class.selected]="p.id === form.projectId"
                        (click)="form.projectId = p.id; projDropOpen = false; projSearch = ''">
                        <div class="opt-title">{{ p.name }}</div>
                        <div class="opt-sub">{{ p.status }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tags -->
            <div class="form-row tags-row">
              <label>Tags</label>
              <div class="tags-input-area" (click)="tagDropOpen = true; stopProp($event)">
                <span class="selected-tag" *ngFor="let t of form.tags">
                  {{ t }} <span class="remove-tag" (click)="removeTag(t); stopProp($event)">×</span>
                </span>
                <input type="text" class="tag-input"
                  [placeholder]="form.tags.length === 0 ? 'Add tags...' : ''"
                  [(ngModel)]="tagInputText"
                  (keydown.enter)="addCustomTag(); $event.preventDefault()"
                  (click)="tagDropOpen = true; stopProp($event)">
              </div>
              <div class="tag-dropdown" *ngIf="tagDropOpen" (click)="stopProp($event)">
                <div class="tag-option" *ngFor="let t of filteredTagOptions"
                  [class.checked]="form.tags.includes(t)"
                  (click)="toggleTag(t)">
                  <span class="tag-check">{{ form.tags.includes(t) ? '☑' : '☐' }}</span> {{ t }}
                </div>
                <div class="tag-option add-new-tag"
                  *ngIf="tagInputText.trim() && !allTagOptions.includes(tagInputText.trim())"
                  (click)="addCustomTag()">
                  Add &quot;{{ tagInputText.trim() }}&quot;
                </div>
                <div class="no-tags" *ngIf="filteredTagOptions.length === 0 && !tagInputText.trim()">No tags yet</div>
              </div>
            </div>

            <!-- Answer -->
            <div class="form-row answer-row">
              <label>Answer <span class="required">*</span></label>
              <div class="answer-tabs">
                <button class="answer-tab" [class.active]="answerTab === 'write'" (click)="answerTab = 'write'">Write</button>
                <button class="answer-tab" [class.active]="answerTab === 'preview'" (click)="answerTab = 'preview'">Preview</button>
              </div>
              <div class="rt-toolbar" *ngIf="answerTab === 'write'">
                <button class="rt-btn" (click)="insertFormat('bold'); stopProp($event)"><strong>B</strong></button>
                <button class="rt-btn" (click)="insertFormat('italic'); stopProp($event)"><em>I</em></button>
                <button class="rt-btn" (click)="insertFormat('underline'); stopProp($event)"><u>U</u></button>
                <button class="rt-btn" (click)="insertFormat('code'); stopProp($event)">Code</button>
                <button class="rt-btn" (click)="insertFormat('ul'); stopProp($event)">• List</button>
                <button class="rt-btn" (click)="insertFormat('ol'); stopProp($event)"># List</button>
                <button class="rt-btn" (click)="insertFormat('quote'); stopProp($event)">Quote</button>
                <button class="rt-btn" (click)="insertFormat('h3'); stopProp($event)">H3</button>
                <button class="rt-btn" (click)="insertFormat('link'); stopProp($event)">Link</button>
              </div>
              <textarea #answerRef *ngIf="answerTab === 'write'"
                class="input-field answer-textarea"
                [(ngModel)]="form.answer"
                rows="7"
                placeholder="Write the answer here (HTML supported)..."></textarea>
              <div class="answer-preview-panel" *ngIf="answerTab === 'preview'"
                [innerHTML]="form.answer || '<em>Nothing to preview yet.</em>'">
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveEntry()">
              {{ editMode ? 'Save Changes' : 'Add Entry' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `
  ,
  styles: [`
    .kb-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .kb-header { display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 14px; padding: 0.75rem 1rem; flex-wrap: wrap; gap: 0.75rem; }
    .kb-header-left { display: flex; align-items: center; }
    .kb-title-group { display: flex; align-items: center; gap: 0.75rem; }
    .kb-icon { font-size: 2rem; }
    .kb-title { margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary); }
    .kb-subtitle { margin: 0; font-size: 0.78rem; color: var(--text-secondary); }
    .filter-bar { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.75rem; }
    .filter-row-top { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
    .search-wrap { position: relative; flex: 1; min-width: 220px; }
    .search-icon-inner { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); pointer-events: none; }
    .search-input { width: 100%; box-sizing: border-box; padding-left: 2rem !important; }
    .filter-chips-row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .filter-sel { font-size: 0.83rem; }
    .input-field { padding: 0.48rem 0.6rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.88rem; background: var(--bg-input); color: var(--text-primary); outline: none; }
    .input-field:focus { border-color: var(--accent-primary); }
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.85rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }
    .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.78rem; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; transition: opacity 0.15s; padding: 0.2rem 0.35rem; border-radius: 5px; }
    .icon-btn:hover { opacity: 1; }
    .empty-state { text-align: center; padding: 3rem 1rem; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .empty-icon { font-size: 3.5rem; }
    .empty-text { font-size: 1rem; font-weight: 500; }
    .qa-list { display: flex; flex-direction: column; gap: 1rem; }
    .qa-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 14px; box-shadow: var(--shadow-sm); overflow: hidden; transition: box-shadow 0.2s, transform 0.2s; }
    .qa-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .qa-card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.85rem 1rem 0.5rem; gap: 0.75rem; }
    .qa-question-area { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
    .qa-category-badge { display: inline-flex; align-items: center; padding: 0.15rem 0.55rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; width: fit-content; }
    .cat-engineering { background: rgba(99,102,241,0.15); color: #6366f1; }
    .cat-hr { background: rgba(236,72,153,0.15); color: #ec4899; }
    .cat-process { background: rgba(16,185,129,0.15); color: #10b981; }
    .cat-design { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .cat-marketing { background: rgba(239,68,68,0.15); color: #ef4444; }
    .cat-finance { background: rgba(6,182,212,0.15); color: #06b6d4; }
    .cat-general { background: rgba(100,116,139,0.15); color: #64748b; }
    .qa-question { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); line-height: 1.4; }
    .qa-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
    .qa-answer-preview { padding: 0 1rem 0.6rem; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; max-height: 100px; overflow: hidden; mask-image: linear-gradient(to bottom, black 60%, transparent); -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent); }
    .qa-answer-preview p { margin: 0 0 0.4rem; }
    .qa-answer-preview code { background: var(--bg-tertiary); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.82rem; }
    .qa-card-footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; padding: 0.5rem 1rem; background: var(--bg-tertiary); border-top: 1px solid var(--border-color); gap: 0.5rem; }
    .qa-meta-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
    .meta-chip { font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 20px; font-weight: 600; }
    .employee-chip { background: rgba(139,92,246,0.12); color: #8b5cf6; }
    .project-chip { background: rgba(6,182,212,0.12); color: #06b6d4; }
    .tag-chip { font-size: 0.68rem; padding: 0.15rem 0.45rem; border-radius: 20px; background: var(--accent-surface); color: var(--accent-primary); font-weight: 600; }
    .qa-date { font-size: 0.7rem; color: var(--text-secondary); white-space: nowrap; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(3px); }
    .modal { background: var(--bg-secondary); border-radius: 18px; width: 640px; max-width: 96vw; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); display: flex; flex-direction: column; max-height: 92vh; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary); font-weight: 700; }
    .modal-body { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; flex: 1; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 0.75rem 1rem; border-top: 1px solid var(--border-color); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; position: relative; }
    .form-row label { font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); }
    .form-row .input-field { width: 100%; box-sizing: border-box; }
    .form-row-group { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .required { color: #ef4444; }
    .searchable-select { position: relative; width: 100%; }
    .select-trigger { display: flex; justify-content: space-between; align-items: center; padding: 0.48rem 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.88rem; background: var(--bg-input); color: var(--text-primary); cursor: pointer; }
    .select-trigger:hover { border-color: var(--accent-primary); }
    .arrow { font-size: 0.65rem; opacity: 0.6; }
    .select-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 60; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.5rem; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 0.4rem; }
    .select-search { width: 100%; box-sizing: border-box; }
    .options-list { overflow-y: auto; max-height: 170px; display: flex; flex-direction: column; gap: 2px; }
    .option-item { padding: 0.38rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.83rem; color: var(--text-primary); transition: background 0.15s; }
    .option-item:hover { background: var(--accent-surface); color: var(--accent-primary); }
    .option-item.selected { background: var(--accent-primary); color: white; }
    .option-item.selected .opt-sub { color: rgba(255,255,255,0.75); }
    .opt-title { font-weight: 600; }
    .opt-sub { font-size: 0.7rem; color: var(--text-secondary); }
    .reset-opt { font-style: italic; color: var(--text-secondary); border-bottom: 1px dashed var(--border-color); padding-bottom: 4px; margin-bottom: 2px; }
    .tags-row { position: relative; }
    .tags-input-area { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; min-height: 40px; padding: 0.35rem 0.6rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-input); cursor: text; }
    .tags-input-area:focus-within { border-color: var(--accent-primary); }
    .selected-tag { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--accent-primary); color: white; font-size: 0.72rem; padding: 0.15rem 0.55rem; border-radius: 20px; font-weight: 600; }
    .remove-tag { cursor: pointer; font-size: 0.9rem; opacity: 0.8; }
    .remove-tag:hover { opacity: 1; }
    .tag-input { border: none; outline: none; background: transparent; font-size: 0.85rem; color: var(--text-primary); min-width: 80px; flex: 1; }
    .tag-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 60; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.4rem; box-shadow: var(--shadow-lg); max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
    .tag-option { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.83rem; color: var(--text-primary); transition: background 0.15s; }
    .tag-option:hover { background: var(--accent-surface); color: var(--accent-primary); }
    .tag-option.checked { color: var(--accent-primary); font-weight: 600; }
    .add-new-tag { border-top: 1px dashed var(--border-color); margin-top: 4px; padding-top: 6px; color: var(--accent-primary); font-weight: 600; }
    .no-tags { color: var(--text-secondary); font-size: 0.78rem; padding: 0.3rem 0.5rem; font-style: italic; }
    .answer-row { gap: 0 !important; }
    .answer-tabs { display: flex; gap: 0.25rem; margin-top: 0.4rem; margin-bottom: 0; }
    .answer-tab { padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 600; border-radius: 6px 6px 0 0; border: 1px solid var(--border-color); border-bottom: none; background: var(--bg-input); color: var(--text-secondary); cursor: pointer; }
    .answer-tab.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
    .rt-toolbar { display: flex; flex-wrap: wrap; gap: 3px; padding: 0.35rem 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-bottom: none; }
    .rt-btn { padding: 0.2rem 0.5rem; font-size: 0.78rem; border: 1px solid var(--border-color); border-radius: 5px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; }
    .rt-btn:hover { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
    .answer-textarea { width: 100%; box-sizing: border-box; resize: vertical; font-family: monospace; font-size: 0.84rem; line-height: 1.5; border-radius: 0 0 8px 8px; border-top: none !important; }
    .answer-preview-panel { min-height: 160px; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 0 0 8px 8px; border-top: none; background: var(--bg-input); font-size: 0.88rem; color: var(--text-primary); line-height: 1.7; overflow-y: auto; }
    .answer-preview-panel p { margin: 0 0 0.5rem; }
    .answer-preview-panel code { background: var(--bg-tertiary); padding: 0.15rem 0.4rem; border-radius: 4px; }
    .answer-preview-panel blockquote { border-left: 3px solid var(--accent-primary); margin: 0; padding-left: 0.75rem; color: var(--text-secondary); font-style: italic; }
    .answer-preview-panel h3 { margin: 0 0 0.4rem; font-size: 0.95rem; }
    .answer-preview-panel ul, .answer-preview-panel ol { padding-left: 1.25rem; margin: 0 0 0.5rem; }
    @media (max-width: 768px) { .form-row-group { grid-template-columns: 1fr; } .filter-row-top { flex-direction: column; } }
  `]
})
export class KnowledgeBaseComponent implements OnInit {
  private svc = inject(StandupNoteService);

  employees: Employee[] = [];
  projects: Project[] = [];
  allEntries: QAEntry[] = [];
  filtered: QAEntry[] = [];

  search = '';
  fCategory = '';
  fEmployee = '';
  fProject = '';
  fTag = '';

  showModal = false;
  editMode = false;
  form!: QAEntry;
  answerTab: 'write' | 'preview' = 'write';

  empDropOpen = false;
  empSearch = '';
  projDropOpen = false;
  projSearch = '';
  tagDropOpen = false;
  tagInputText = '';

  @ViewChild('answerRef') answerRef!: ElementRef<HTMLTextAreaElement>;

  readonly PRESET_CATEGORIES = PRESET_CATEGORIES;

  ngOnInit() {
    this.svc.state$.subscribe(s => {
      this.employees = s.employees;
      this.projects = s.projects;
      this.allEntries = s.qaEntries || [];
      this.applyFilters();
    });
  }

  @HostListener('document:click')
  onDocClick() {
    this.empDropOpen = false;
    this.projDropOpen = false;
    this.tagDropOpen = false;
  }

  stopProp(e: Event) { e.stopPropagation(); }

  get allCategories(): string[] {
    return Array.from(new Set(this.allEntries.map(e => e.category).filter(Boolean))).sort();
  }
  get allTags(): string[] {
    return Array.from(new Set(this.allEntries.flatMap(e => e.tags))).sort();
  }
  get hasFilters(): boolean { return !!(this.search || this.fCategory || this.fEmployee || this.fProject || this.fTag); }
  get allTagOptions(): string[] { return Array.from(new Set(this.allEntries.flatMap(e => e.tags))).sort(); }
  get filteredTagOptions(): string[] {
    const txt = this.tagInputText.trim().toLowerCase();
    return this.allTagOptions.filter(t => !txt || t.toLowerCase().includes(txt));
  }
  get filteredEmpsForSelect(): Employee[] {
    const txt = this.empSearch.trim().toLowerCase();
    return txt ? this.employees.filter(e => e.name.toLowerCase().includes(txt)) : this.employees;
  }
  get filteredProjsForSelect(): Project[] {
    const txt = this.projSearch.trim().toLowerCase();
    return txt ? this.projects.filter(p => p.name.toLowerCase().includes(txt)) : this.projects;
  }
  get selectedEmpName(): string {
    if (!this.form?.responsibleEmployeeId) return '— None —';
    return this.employees.find(e => e.id === this.form.responsibleEmployeeId)?.name || '— None —';
  }
  get selectedProjName(): string {
    if (!this.form?.projectId) return '— None —';
    return this.projects.find(p => p.id === this.form.projectId)?.name || '— None —';
  }

  applyFilters() {
    let data = [...this.allEntries];
    if (this.search) {
      const t = this.search.toLowerCase();
      data = data.filter(e => e.question.toLowerCase().includes(t) || e.answer.toLowerCase().includes(t) || e.category.toLowerCase().includes(t) || e.tags.some(tag => tag.toLowerCase().includes(t)));
    }
    if (this.fCategory) data = data.filter(e => e.category === this.fCategory);
    if (this.fEmployee) data = data.filter(e => e.responsibleEmployeeId === this.fEmployee);
    if (this.fProject) data = data.filter(e => e.projectId === this.fProject);
    if (this.fTag) data = data.filter(e => e.tags.includes(this.fTag));
    this.filtered = data.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  }

  clearFilters() {
    this.search = this.fCategory = this.fEmployee = this.fProject = this.fTag = '';
    this.applyFilters();
  }

  getEmpName(id: string | undefined) { return id ? (this.employees.find(e => e.id === id)?.name || id) : ''; }
  getProjName(id: string | undefined) { return id ? (this.projects.find(p => p.id === id)?.name || id) : ''; }
  getCategoryClass(cat: string) { return (cat || 'general').toLowerCase().split(' ')[0]; }
  trackById(_: number, e: QAEntry) { return e.id; }

  blankForm(): QAEntry {
    return { id: '', question: '', answer: '', category: '', responsibleEmployeeId: '', projectId: '', tags: [], lastUpdated: new Date().toISOString().split('T')[0] };
  }

  openAdd() { this.form = this.blankForm(); this.editMode = false; this.answerTab = 'write'; this.tagInputText = ''; this.showModal = true; }
  openEdit(entry: QAEntry) { this.form = { responsibleEmployeeId: '', projectId: '', ...JSON.parse(JSON.stringify(entry)) }; this.editMode = true; this.answerTab = 'write'; this.tagInputText = ''; this.showModal = true; }
  closeModal() { this.showModal = false; this.empDropOpen = this.projDropOpen = this.tagDropOpen = false; }

  saveEntry() {
    if (!this.form.question.trim()) { alert('Question is required.'); return; }
    if (!this.form.answer.trim()) { alert('Answer is required.'); return; }
    this.form.lastUpdated = new Date().toISOString().split('T')[0];
    if (this.editMode) {
      this.svc.updateQAEntry(this.form);
    } else {
      this.form.id = this.svc.generateId('QA', this.allEntries);
      this.svc.addQAEntry(this.form);
    }
    this.closeModal();
  }

  deleteEntry(id: string) { if (confirm('Delete this Q&A entry?')) this.svc.deleteQAEntry(id); }

  toggleTag(tag: string) { const idx = this.form.tags.indexOf(tag); idx === -1 ? this.form.tags.push(tag) : this.form.tags.splice(idx, 1); }
  removeTag(tag: string) { this.form.tags = this.form.tags.filter(t => t !== tag); }
  addCustomTag() { const t = this.tagInputText.trim(); if (t && !this.form.tags.includes(t)) this.form.tags.push(t); this.tagInputText = ''; }

  insertFormat(type: string) {
    const ta = this.answerRef?.nativeElement;
    if (!ta) return;
    const start = ta.selectionStart ?? 0, end = ta.selectionEnd ?? 0;
    const sel = ta.value.substring(start, end);
    const before = ta.value.substring(0, start), after = ta.value.substring(end);
    const MAP: Record<string, () => string> = {
      bold: () => '<strong>' + (sel || 'bold text') + '</strong>',
      italic: () => '<em>' + (sel || 'italic text') + '</em>',
      underline: () => '<u>' + (sel || 'underline text') + '</u>',
      code: () => '<code>' + (sel || 'code') + '</code>',
      ul: () => '<ul>\n  <li>' + (sel || 'Item 1') + '</li>\n  <li>Item 2</li>\n</ul>',
      ol: () => '<ol>\n  <li>' + (sel || 'Item 1') + '</li>\n  <li>Item 2</li>\n</ol>',
      quote: () => '<blockquote>' + (sel || 'Quote text') + '</blockquote>',
      h3: () => '<h3>' + (sel || 'Heading') + '</h3>',
      link: () => '<a href="https://example.com">' + (sel || 'Link text') + '</a>',
    };
    const snippet = (MAP[type] || (() => sel))();
    this.form.answer = before + snippet + after;
    setTimeout(() => { ta.focus(); const c = (before + snippet).length; ta.setSelectionRange(c, c); }, 0);
  }
}
