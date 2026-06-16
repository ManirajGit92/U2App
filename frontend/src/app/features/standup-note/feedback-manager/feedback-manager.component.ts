import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StandupNoteService, FeedbackEntry } from '../standup-note.service';

@Component({
  selector: 'app-feedback-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="feedback-shell">
      <header class="feedback-header">
        <div>
          <p class="eyebrow">Feedback Center</p>
          <h2>Collect and manage team feedback</h2>
        </div>
        <button class="btn btn-primary action-btn" (click)="openModal()">
          <span class="icon">＋</span>
          Add Feedback
        </button>
      </header>

      <div *ngIf="!feedbacks.length" class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>No feedback submitted yet</h3>
        <p>Use the button above to capture employee or project feedback instantly.</p>
      </div>

      <div class="cards" *ngIf="feedbacks.length">
        <article *ngFor="let f of feedbacks" class="feedback-card">
          <div class="card-top">
            <span class="badge">{{ f.targetType }}</span>
            <span class="date">{{ f.createdAt | date: 'mediumDate' }}</span>
          </div>
          <h3 class="feedback-subject">{{ f.subject }}</h3>
          <p class="feedback-preview" [innerHTML]="f.message"></p>
          <div class="card-meta">
            <span class="meta-label">{{ getTargetName(f) }}</span>
          </div>
          <div class="card-actions">
            <button class="icon-btn" title="Edit feedback" (click)="edit(f)">✏️</button>
            <button class="icon-btn danger" title="Delete feedback" (click)="remove(f.id)">
              🗑️
            </button>
          </div>
        </article>
      </div>

      <div class="modal" *ngIf="showModal">
        <div class="modal-backdrop" (click)="closeModal()"></div>
        <div class="modal-body">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Feedback Form</p>
              <h3>{{ editing ? 'Edit Feedback' : 'Send Feedback' }}</h3>
            </div>
            <button class="icon-btn" type="button" (click)="closeModal()">✕</button>
          </div>
          <form class="modal-form" (ngSubmit)="submit()">
            <div class="field-grid">
              <label class="field">
                <span>Target Type</span>
                <select
                  [(ngModel)]="form.targetType"
                  name="targetType"
                  (ngModelChange)="onTargetTypeChange($event)"
                >
                  <option value="Employee">Employee</option>
                  <option value="Project">Project</option>
                </select>
              </label>

              <label class="field">
                <span>Employee / Project</span>
                <select [(ngModel)]="form.targetId" name="targetId">
                  <option *ngFor="let item of targets" [value]="item.id">{{ item.display }}</option>
                </select>
                <small class="field-error" *ngIf="formTouched && !form.targetId"
                  >Please select a target.</small
                >
              </label>
            </div>

            <label class="field">
              <span>Subject</span>
              <input
                [(ngModel)]="form.subject"
                name="subject"
                placeholder="Enter a short subject"
              />
              <small class="field-error" *ngIf="formTouched && !form.subject?.trim()"
                >Subject is required.</small
              >
            </label>

            <label class="field">
              <span>Feedback</span>
              <textarea
                [(ngModel)]="form.message"
                name="message"
                rows="5"
                placeholder="Write your feedback here"
              ></textarea>
              <small class="field-error" *ngIf="formTouched && !form.message?.trim()"
                >Feedback message is required.</small
              >
            </label>

            <div class="modal-actions">
              <button class="btn btn-secondary" type="button" (click)="closeModal()">Cancel</button>
              <button class="btn btn-primary" type="submit">
                {{ editing ? 'Save' : 'Submit' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .feedback-shell {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .feedback-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
      }
      .eyebrow {
        margin: 0 0 6px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--text-secondary);
        font-size: 0.78rem;
      }
      .feedback-header h2 {
        margin: 0;
        font-size: clamp(1.5rem, 2vw, 2rem);
        line-height: 1.1;
      }
      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 0.95rem 1.3rem;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 48px;
        border-radius: 24px;
        border: 1px dashed rgba(148, 163, 184, 0.4);
        background: rgba(59, 130, 246, 0.08);
        text-align: center;
        color: var(--text-secondary);
      }
      .empty-icon {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.16);
        font-size: 1.8rem;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
      }
      .feedback-card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 22px;
        border-radius: 24px;
        background: var(--bg-secondary);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        transition:
          transform 0.24s ease,
          border-color 0.24s ease;
        height: 55vh;
        min-height: 320px;
        box-sizing: border-box;
      }
      .feedback-card:hover {
        transform: translateY(-2px);
        border-color: rgba(99, 102, 241, 0.32);
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-primary);
        font-size: 0.85rem;
        font-weight: 700;
      }
      .date {
        color: var(--text-secondary);
        font-size: 0.86rem;
      }
      .feedback-subject {
        margin: 0;
        font-size: 1.1rem;
        line-height: 1.3;
      }
      .feedback-preview {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.7;
        white-space: pre-wrap;
        flex: 1;
        overflow-y: auto;
      }
      .card-meta {
        display: flex;
        gap: 8px;
        color: var(--text-secondary);
        font-size: 0.93rem;
      }
      .meta-label {
        background: rgba(15, 23, 42, 0.05);
        padding: 8px 12px;
        border-radius: 999px;
      }
      .card-actions {
        display: flex;
        gap: 10px;
      }
      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: rgba(148, 163, 184, 0.12);
        border: none;
        cursor: pointer;
        transition:
          transform 0.2s ease,
          background 0.2s ease;
      }
      .icon-btn:hover {
        transform: scale(1.04);
        background: rgba(99, 102, 241, 0.18);
      }
      .icon-btn.danger {
        background: rgba(248, 113, 113, 0.16);
        color: #991b1b;
      }
      .modal {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20;
      }
      .modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.42);
      }
      .modal-body {
        position: relative;
        z-index: 2;
        width: min(760px, 92vw);
        background: var(--bg-primary);
        border-radius: 28px;
        padding: 26px;
        box-shadow: 0 28px 72px rgba(15, 23, 42, 0.18);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      .modal-header h3 {
        margin: 0;
        font-size: 1.45rem;
      }
      .modal-form {
        display: grid;
        gap: 16px;
      }
      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .field span {
        font-size: 0.92rem;
        color: var(--text-secondary);
      }
      .field input,
      .field select,
      .field textarea {
        width: 100%;
        min-height: 46px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: var(--bg-primary);
        color: var(--text-primary);
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
      }
      .field textarea {
        min-height: 140px;
        resize: vertical;
      }
      .field input:focus,
      .field select:focus,
      .field textarea:focus {
        outline: none;
        border-color: rgba(99, 102, 241, 0.75);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
      }
      .field-error {
        color: #dc2626;
        font-size: 0.82rem;
        margin-top: 4px;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 12px;
      }
      .btn {
        border-radius: 14px;
        padding: 0.95rem 1.1rem;
        border: none;
        cursor: pointer;
        transition:
          transform 0.2s ease,
          filter 0.2s ease;
      }
      .btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.04);
      }
      .btn-primary {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95));
        color: white;
      }
      .btn-secondary {
        background: rgba(15, 23, 42, 0.07);
        color: var(--text-primary);
      }
      @media (max-width: 768px) {
        .feedback-header {
          flex-direction: column;
          align-items: stretch;
        }
        .cards {
          grid-template-columns: 1fr;
        }
        .field-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 576px) {
        .feedback-card {
          padding: 16px;
        }
        .modal-body {
          padding: 16px;
        }
        .modal-actions {
          flex-direction: column-reverse;
          gap: 8px;
          align-items: stretch;
        }
        .modal-actions button {
          width: 100%;
        }
      }
    `,
  ],
})
export class FeedbackManagerComponent {
  svc = inject(StandupNoteService);

  feedbacks: FeedbackEntry[] = [];
  employees = [] as any[];
  projects = [] as any[];

  showModal = false;
  editing = false;
  formTouched = false;
  form: any = { targetType: 'Employee', targetId: '', subject: '', message: '' };

  constructor() {
    this.svc.state$.subscribe((s) => {
      this.feedbacks = s.feedbacks || [];
      this.employees = s.employees || [];
      this.projects = s.projects || [];
    });
  }

  get targets() {
    if (this.form.targetType === 'Employee') {
      return this.employees.map((e) => ({ id: e.id, display: e.name }));
    }
    return this.projects.map((p) => ({ id: p.id, display: p.name }));
  }

  openModal() {
    this.editing = false;
    this.form = {
      targetType: 'Employee',
      targetId: this.employees[0]?.id || this.projects[0]?.id || '',
      subject: '',
      message: '',
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  isValid() {
    return this.form.targetId && this.form.subject?.trim() && this.form.message?.trim();
  }

  submit() {
    this.formTouched = true;
    if (!this.isValid()) return;
    if (this.editing) {
      this.svc.updateFeedback(this.form as FeedbackEntry);
    } else {
      this.svc.addFeedback({
        targetType: this.form.targetType,
        targetId: this.form.targetId,
        subject: this.form.subject,
        message: this.form.message,
      });
    }
    this.closeModal();
  }

  onTargetTypeChange(type: 'Employee' | 'Project') {
    const nextTarget = this.targets[0];
    this.form.targetId = nextTarget?.id || '';
  }

  remove(id: string) {
    if (!confirm('Delete feedback?')) return;
    this.svc.deleteFeedback(id);
  }

  edit(entry: FeedbackEntry) {
    this.editing = true;
    this.form = { ...entry };
    this.showModal = true;
  }

  getTargetName(f: FeedbackEntry) {
    if (f.targetType === 'Employee') {
      const e = this.employees.find((x) => x.id === f.targetId);
      return e ? e.name : f.targetId;
    }
    const p = this.projects.find((x) => x.id === f.targetId);
    return p ? p.name : f.targetId;
  }
}
