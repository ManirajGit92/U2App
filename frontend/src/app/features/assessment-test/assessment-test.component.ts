import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AssessmentTestService,
  AssessmentQuestion,
  QuestionInputType,
} from './assessment-test.service';

@Component({
  selector: 'app-assessment-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="assessment-page container">
      <div class="page-header">
        <div>
          <h1>Assessment Test</h1>
          <p>
            Build categories, question sheets, and run assessments with automatic scoring,
            certificates, import/export, and cloud sync.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="toggleSideNav()">📁 Menu</button>
          <button class="btn btn-secondary" (click)="service.syncToFirebase()">☁️ Sync</button>
        </div>
      </div>

      <div class="assessment-layout">
        <aside class="side-nav" [class.mobile-open]="service.sideNavOpenMobile()">
          <div class="sidebar-header">
            <div>
              <h2>Question Library</h2>
              <p>Categories and question sheets</p>
            </div>
            <button class="close-nav" type="button" (click)="service.sideNavOpenMobile.set(false)">
              ×
            </button>
          </div>

          <div class="sidebar-tools">
            <div class="search-box">
              <input
                type="search"
                placeholder="Search categories or sheets..."
                [(ngModel)]="searchQuery"
              />
            </div>
            <div class="sidebar-buttons">
              <button class="btn btn-primary btn-sm" (click)="createCategory()">+ Category</button>
              <button class="btn btn-secondary btn-sm" (click)="createQuestionSet()">
                + Sheet
              </button>
            </div>
            <div class="sidebar-buttons">
              <label class="file-upload btn btn-ghost btn-sm">
                📥 Import
                <input type="file" accept=".xlsx,.xls" hidden (change)="handleImport($event)" />
              </label>
              <button class="btn btn-ghost btn-sm" (click)="service.exportToExcel()">
                📤 Export
              </button>
            </div>
          </div>

          <div class="sidebar-content">
            <div *ngFor="let category of filteredCategories" class="category-block">
              <button class="category-toggle" (click)="toggleCategory(category.id)">
                <span>{{ category.name }}</span>
                <span class="count">{{ questionSetCount(category.id) }}</span>
              </button>
              <div class="category-actions">
                <button class="btn btn-link btn-xs" (click)="editCategory(category)">Edit</button>
                <button class="btn btn-link btn-xs" (click)="deleteCategory(category.id)">
                  Delete
                </button>
              </div>

              <div class="sheet-list" *ngIf="expandedCategories.has(category.id)">
                <button
                  *ngFor="let sheet of sheetsForCategory(category.id)"
                  class="sheet-item"
                  [class.active]="service.selectedSetId() === sheet.id"
                  (click)="selectSheet(sheet.id)"
                >
                  {{ sheet.name }}
                </button>
              </div>
            </div>
          </div>

          <div class="sidebar-footer">
            <small>{{ service.syncMessage() }}</small>
            <small *ngIf="service.exportMessage()">{{ service.exportMessage() }}</small>
            <div *ngIf="service.importErrors().length" class="import-errors">
              <p>Import problems:</p>
              <ul>
                <li *ngFor="let error of service.importErrors()">{{ error }}</li>
              </ul>
            </div>
          </div>
        </aside>

        <main class="assessment-main">
          <div class="assessment-toolbar">
            <button
              class="btn"
              [class.active]="viewMode() === 'builder'"
              (click)="viewMode.set('builder')"
            >
              Builder
            </button>
            <button
              class="btn"
              [class.active]="viewMode() === 'test'"
              (click)="viewMode.set('test')"
            >
              Take Test
            </button>
            <button
              class="btn"
              [class.active]="viewMode() === 'results'"
              (click)="viewMode.set('results')"
            >
              Results
            </button>
          </div>

          <section *ngIf="viewMode() === 'builder'" class="builder-section">
            <div class="section-grid">
              <div class="panel glass-card">
                <h3>Selected Sheet</h3>
                <ng-container *ngIf="service.activeSet(); else noSet">
                  <label>Sheet Name</label>
                  <input type="text" [(ngModel)]="setName" placeholder="Sheet name" />
                  <label>Description</label>
                  <textarea [(ngModel)]="setDescription" rows="3"></textarea>
                  <label>Timer (seconds)</label>
                  <input type="number" [(ngModel)]="setTimer" min="0" />
                  <div class="panel-actions">
                    <button class="btn btn-primary" (click)="saveSet()">Save Sheet</button>
                    <button
                      class="btn btn-secondary"
                      (click)="service.deleteQuestionSet(service.selectedSetId() || '')"
                    >
                      Delete Sheet
                    </button>
                  </div>
                </ng-container>
                <ng-template #noSet>
                  <p>Select or create a sheet to begin building questions.</p>
                </ng-template>
              </div>

              <div class="panel glass-card">
                <h3>Question Editor</h3>
                <ng-container *ngIf="currentQuestion; else addQuestionPrompt">
                  <label>Question Title</label>
                  <input type="text" [(ngModel)]="currentQuestion.title" />
                  <label>Instructions</label>
                  <textarea [(ngModel)]="currentQuestion.description" rows="2"></textarea>
                  <label>Input Type</label>
                  <select [(ngModel)]="currentQuestion.type">
                    <option *ngFor="let type of questionTypes" [value]="type">{{ type }}</option>
                  </select>
                  <label>Weight</label>
                  <input type="number" [(ngModel)]="currentQuestion.weight" min="0" />
                  <label>Negative mark</label>
                  <input type="number" [(ngModel)]="currentQuestion.negativeMark" min="0" />
                  <label>
                    <input type="checkbox" [(ngModel)]="currentQuestion.required" /> Required
                  </label>

                  <div *ngIf="showOptionsEditor(currentQuestion.type)">
                    <label>Answer Options</label>
                    <div
                      *ngFor="let option of currentQuestion.options; let idx = index"
                      class="option-row"
                    >
                      <input type="text" [(ngModel)]="option.label" placeholder="Label" />
                      <input type="text" [(ngModel)]="option.value" placeholder="Value" />
                      <button class="btn btn-danger btn-xs" (click)="removeOption(idx)">
                        Remove
                      </button>
                    </div>
                    <button class="btn btn-secondary btn-xs" (click)="addOption()">
                      Add Option
                    </button>
                  </div>

                  <label>Correct answer(s)</label>
                  <input
                    type="text"
                    [(ngModel)]="correctAnswerText"
                    placeholder="Single answer or comma-separated values"
                  />
                  <div class="panel-actions">
                    <button class="btn btn-primary" (click)="saveQuestion()">Save Question</button>
                    <button class="btn btn-secondary" (click)="duplicateQuestion()">
                      Duplicate
                    </button>
                    <button class="btn btn-danger" (click)="removeQuestion()">Delete</button>
                  </div>
                </ng-container>
                <ng-template #addQuestionPrompt>
                  <p>Select a question or click the button to create a new one.</p>
                </ng-template>
              </div>
            </div>

            <div class="question-list glass-card">
              <div class="list-header">
                <h3>Questions</h3>
                <button class="btn btn-sm btn-primary" (click)="addNewQuestion()">
                  + Add Question
                </button>
              </div>
              <ng-container *ngIf="service.activeSet() as activeSet; else noQuestions">
                <div
                  *ngFor="let question of activeSet.questions; let i = index"
                  class="question-card"
                  [class.selected]="question.id === currentQuestion?.id"
                  (click)="selectQuestion(question)"
                >
                  <div>
                    <strong>{{ i + 1 }}.</strong> {{ question.title }}
                  </div>
                  <span>{{ question.type }}</span>
                </div>
              </ng-container>
              <ng-template #noQuestions>
                <p>No questions in this sheet yet.</p>
              </ng-template>
            </div>
          </section>

          <section *ngIf="viewMode() === 'test'" class="test-section">
            <div class="section-grid">
              <div class="panel glass-card test-overview">
                <h3>Assessment Overview</h3>
                <p>
                  <strong>Category:</strong>
                  {{ service.getCategoryName(service.activeSet()?.categoryId || null) }}
                </p>
                <p><strong>Sheet:</strong> {{ activeSetName }}</p>
                <p><strong>Progress:</strong> {{ service.progress() }}%</p>
                <p><strong>Total questions:</strong> {{ activeSetQuestionCount }}</p>
                <p *ngIf="service.activeSet()?.timerSeconds">
                  <strong>Timer:</strong> {{ service.activeSet()?.timerSeconds }} seconds
                </p>
                <div class="panel-actions">
                  <button class="btn btn-primary" (click)="startAssessment()">
                    Start / Resume
                  </button>
                  <button class="btn btn-secondary" (click)="service.submitAssessment()">
                    Submit Now
                  </button>
                </div>
              </div>

              <div
                class="panel glass-card test-question"
                *ngIf="service.activeQuestion() as question"
              >
                <div class="question-header">
                  <h4>
                    Question {{ service.activeQuestionIndex() + 1 }} of {{ activeSetQuestionCount }}
                  </h4>
                  <p>{{ question.title }}</p>
                  <small>{{ question.description }}</small>
                </div>

                <div class="question-body">
                  <ng-container [ngSwitch]="question.type">
                    <div *ngSwitchCase="'radio'">
                      <label *ngFor="let option of question.options" class="answer-option">
                        <input
                          type="radio"
                          [name]="question.id"
                          [value]="option.value"
                          [checked]="service.valueForQuestion(question) === option.value"
                          (change)="service.updateResponse(question.id, option.value)"
                        />
                        {{ option.label }}
                      </label>
                    </div>
                    <div *ngSwitchCase="'checkbox'">
                      <label *ngFor="let option of question.options" class="answer-option">
                        <input
                          type="checkbox"
                          [value]="option.value"
                          [checked]="isCheckboxOptionChecked(question, option.value)"
                          (change)="toggleCheckbox(question, option.value, $event.target.checked)"
                        />
                        {{ option.label }}
                      </label>
                    </div>
                    <div *ngSwitchCase="'textbox'">
                      <input
                        type="text"
                        class="answer-text"
                        [value]="textResponse(question)"
                        (input)="service.updateResponse(question.id, $any($event.target).value)"
                      />
                    </div>
                    <div *ngSwitchCase="'textarea'">
                      <textarea
                        rows="5"
                        class="answer-textarea"
                        [value]="textResponse(question)"
                        (input)="service.updateResponse(question.id, $any($event.target).value)"
                      ></textarea>
                    </div>
                    <div *ngSwitchCase="'mixed'">
                      <ng-container *ngFor="let child of question.controls || []">
                        <div class="mixed-question">
                          <p>
                            <strong>{{ child.title }}</strong>
                          </p>
                          <ng-container [ngSwitch]="child.type">
                            <div *ngSwitchCase="'radio'">
                              <label *ngFor="let option of child.options" class="answer-option">
                                <input
                                  type="radio"
                                  [name]="child.id"
                                  [value]="option.value"
                                  [checked]="mixedResponseChecked(question, child.id, option.value)"
                                  (change)="updateMixedResponse(question, child.id, option.value)"
                                />
                                {{ option.label }}
                              </label>
                            </div>
                            <div *ngSwitchCase="'textbox'">
                              <input
                                type="text"
                                class="answer-text"
                                [value]="mixedResponseValue(question, child.id)"
                                (input)="
                                  updateMixedResponse(question, child.id, $any($event.target).value)
                                "
                              />
                            </div>
                          </ng-container>
                        </div>
                      </ng-container>
                    </div>
                  </ng-container>
                </div>

                <div class="question-actions">
                  <button class="btn btn-secondary" (click)="service.previousQuestion()">
                    Previous
                  </button>
                  <button class="btn btn-secondary" (click)="service.nextQuestion()">Next</button>
                </div>
              </div>
            </div>
          </section>

          <section *ngIf="viewMode() === 'results'" class="results-section">
            <div class="panel glass-card results-summary" *ngIf="service.lastResult() as result">
              <h3>Assessment Results</h3>
              <div class="badge-row">
                <span class="score">{{ result.score }} / {{ result.maxScore }}</span>
                <span class="badge">{{ result.badge }}</span>
              </div>
              <p>{{ result.percentage }}% completed on {{ result.completedAt | date: 'medium' }}</p>
              <div class="stats-grid">
                <div>
                  <strong>{{ result.correctCount }}</strong> correct
                </div>
                <div>
                  <strong>{{ result.incorrectCount }}</strong> incorrect
                </div>
                <div>
                  <strong>{{ result.skippedCount }}</strong> skipped
                </div>
              </div>
              <button class="btn btn-primary" (click)="previewCertificate()">
                Preview Certificate
              </button>
            </div>

            <div class="panel glass-card" *ngIf="service.lastResult() as result">
              <h4>Question Feedback</h4>
              <div *ngFor="let detail of result.details" class="feedback-row">
                <div>
                  <strong>{{ detail.questionTitle }}</strong>
                </div>
                <div>{{ detail.feedback }}</div>
                <div>{{ detail.earned }} / {{ detail.possible }}</div>
              </div>
            </div>

            <div
              *ngIf="service.certificatePreview() as certificate"
              class="panel glass-card certificate-card"
            >
              <h4>Certificate Preview</h4>
              <div class="certificate-box">
                <h2>{{ certificate.badge }}</h2>
                <p>This certifies that</p>
                <h3>{{ certificate.userName }}</h3>
                <p>
                  completed <strong>{{ certificate.assessmentName }}</strong> in category
                  <strong>{{ certificate.category }}</strong
                  >.
                </p>
                <p>Score: {{ certificate.score }} ({{ certificate.percentage }}%)</p>
                <p>Date: {{ certificate.completedAt | date: 'mediumDate' }}</p>
              </div>
              <div class="panel-actions">
                <button class="btn btn-primary" (click)="downloadCertificate()">
                  Download PDF
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .assessment-page {
        padding: 1rem 0 3rem;
      }
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .page-header h1 {
        margin: 0 0 0.5rem;
        font-size: clamp(1.8rem, 2.2vw, 2.6rem);
      }
      .page-header p {
        margin: 0;
        color: var(--text-secondary);
      }
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .assessment-layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 1.5rem;
      }
      aside.side-nav {
        position: sticky;
        top: 5rem;
        align-self: start;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 24px;
        padding: 1rem;
        max-height: calc(100vh - 6rem);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: transform 0.25s ease;
      }
      aside.side-nav.mobile-open {
        position: fixed;
        left: 0;
        top: 0;
        width: min(100%, 360px);
        height: 100vh;
        z-index: 2000;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
        transform: translateX(0);
        background: var(--bg-surface);
      }
      .sidebar-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .close-nav {
        border: none;
        background: transparent;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
      }
      .sidebar-tools {
        display: grid;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .search-box input {
        width: 100%;
        padding: 0.8rem 1rem;
        border-radius: 14px;
        border: 1px solid var(--border-color);
        background: var(--bg-surface);
      }
      .sidebar-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .file-upload {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .category-block {
        margin-bottom: 1rem;
      }
      .category-toggle {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: none;
        background: transparent;
        padding: 0.8rem 0.75rem;
        border-radius: 14px;
        cursor: pointer;
        color: var(--text-primary);
      }
      .category-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .count {
        font-weight: 700;
        color: var(--accent-primary);
      }
      .sheet-list {
        display: grid;
        gap: 0.4rem;
        margin-top: 0.75rem;
      }
      .sheet-item {
        width: 100%;
        text-align: left;
        border: 1px solid var(--border-color);
        padding: 0.75rem 0.9rem;
        border-radius: 14px;
        background: var(--bg-surface);
        cursor: pointer;
      }
      .sheet-item.active {
        background: rgba(99, 102, 241, 0.08);
        border-color: var(--accent-primary);
      }
      .sidebar-footer {
        margin-top: auto;
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      .import-errors {
        margin-top: 1rem;
        color: var(--text-danger);
      }
      .assessment-main {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .assessment-toolbar {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .assessment-toolbar .btn {
        min-width: 110px;
      }
      .assessment-toolbar .btn.active {
        background: var(--accent-primary);
        color: white;
      }
      .section-grid {
        display: grid;
        grid-template-columns: 1fr 1.2fr;
        gap: 1rem;
      }
      .panel {
        padding: 1rem;
      }
      .panel h3 {
        margin-top: 0;
      }
      .panel label {
        display: block;
        margin: 0.8rem 0 0.4rem;
        font-weight: 600;
      }
      .panel input[type='text'],
      .panel input[type='number'],
      .panel select,
      .panel textarea {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 0.9rem 1rem;
      }
      .panel-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }
      .question-list {
        margin-top: 1rem;
      }
      .list-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .question-card {
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 0.85rem;
        margin-top: 0.75rem;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .question-card.selected {
        border-color: var(--accent-primary);
        background: rgba(99, 102, 241, 0.08);
      }
      .option-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .btn-xs {
        padding: 0.45rem 0.8rem;
        font-size: 0.8rem;
      }
      .btn-danger {
        background: #ef4444;
        color: white;
      }
      .btn-danger-text {
        color: #ef4444;
        background: transparent;
      }
      .test-section {
        display: grid;
        gap: 1rem;
      }
      .test-overview {
        background: var(--bg-card);
      }
      .test-question {
        background: var(--bg-card);
      }
      .question-header h4 {
        margin: 0 0 0.5rem;
      }
      .question-body {
        margin-top: 1rem;
      }
      .answer-option {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      .answer-text,
      .answer-textarea {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 14px;
        padding: 0.9rem 1rem;
      }
      .question-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .results-summary {
        padding-bottom: 1.5rem;
      }
      .badge-row {
        display: flex;
        gap: 1rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .score {
        font-size: 2rem;
        font-weight: 700;
      }
      .badge {
        background: rgba(99, 102, 241, 0.12);
        padding: 0.5rem 0.85rem;
        border-radius: 999px;
        color: var(--accent-primary);
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }
      .feedback-row {
        padding: 0.9rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: 18px;
        margin-top: 0.9rem;
        display: grid;
        gap: 0.5rem;
      }
      .certificate-card {
        background: var(--bg-card);
      }
      .certificate-box {
        padding: 1rem;
        border: 1px dashed var(--border-color);
        border-radius: 20px;
        text-align: center;
      }
      .certificate-box h2 {
        margin: 0.5rem 0;
      }
      @media (max-width: 1150px) {
        .assessment-layout {
          grid-template-columns: 1fr;
        }
        aside.side-nav {
          position: relative;
          top: 0;
          max-height: none;
        }
      }
      @media (max-width: 850px) {
        .page-header {
          flex-direction: column;
        }
        .section-grid {
          grid-template-columns: 1fr;
        }
        aside.side-nav {
          transform: translateX(-120%);
          position: fixed;
          left: 0;
          top: 0;
          height: 100vh;
          width: min(100%, 320px);
          background: var(--bg-surface);
          z-index: 2000;
          padding-bottom: 2rem;
        }
      }
    `,
  ],
})
export class AssessmentTestComponent {
  service = inject(AssessmentTestService);
  viewMode = signal<'builder' | 'test' | 'results'>('builder');
  searchQuery = '';
  expandedCategories = new Set<string>();

  setName = '';
  setDescription = '';
  setTimer: number | null = null;

  currentQuestion: AssessmentQuestion | null = null;
  correctAnswerText = '';
  questionTypes: QuestionInputType[] = ['radio', 'checkbox', 'textbox', 'textarea', 'mixed'];

  get activeSetName(): string {
    return this.service.activeSet()?.name ?? '';
  }

  get activeSetQuestionCount(): number {
    return this.service.activeSet()?.questions.length ?? 0;
  }

  constructor() {
    effect(() => {
      this.service.selectedSetId();
      const activeSet = this.service.activeSet();
      if (activeSet) {
        this.setName = activeSet.name;
        this.setDescription = activeSet.description || '';
        this.setTimer = activeSet.timerSeconds || null;
        this.currentQuestion = activeSet.questions[0] || null;
        this.correctAnswerText = this.currentQuestion
          ? this.answerTextForQuestion(this.currentQuestion)
          : '';
      } else {
        this.setName = '';
        this.setDescription = '';
        this.setTimer = null;
        this.currentQuestion = null;
        this.correctAnswerText = '';
      }
    });
  }

  get filteredCategories() {
    const query = this.searchQuery.toLowerCase();
    return this.service.categories().filter((category) => {
      const inCategory =
        category.name.toLowerCase().includes(query) ||
        category.description?.toLowerCase().includes(query);
      const hasMatchingSheet = this.service
        .questionSets()
        .some(
          (sheet) => sheet.categoryId === category.id && sheet.name.toLowerCase().includes(query),
        );
      return query ? inCategory || hasMatchingSheet : true;
    });
  }

  questionSetCount(categoryId: string): number {
    return this.service.questionSets().filter((set) => set.categoryId === categoryId).length;
  }

  sheetsForCategory(categoryId: string) {
    return this.service.questionSets().filter((set) => set.categoryId === categoryId);
  }

  toggleCategory(categoryId: string): void {
    if (this.expandedCategories.has(categoryId)) {
      this.expandedCategories.delete(categoryId);
    } else {
      this.expandedCategories.add(categoryId);
    }
  }

  selectSheet(setId: string): void {
    this.service.setSelectedSet(setId);
    const activeSet = this.service.activeSet();
    if (activeSet) {
      this.setName = activeSet.name;
      this.setDescription = activeSet.description || '';
      this.setTimer = activeSet.timerSeconds || null;
      this.currentQuestion = activeSet.questions[0] || null;
      this.correctAnswerText = this.currentQuestion
        ? this.answerTextForQuestion(this.currentQuestion)
        : '';
    }
    this.service.sideNavOpenMobile.set(false);
  }

  createCategory(): void {
    const name = window.prompt('New category name');
    if (name) {
      this.service.createCategory(name);
      this.expandedCategories.add(this.service.selectedCategoryId() || '');
    }
  }

  editCategory(category: { id: string; name: string; description?: string }): void {
    const name = window.prompt('Category name', category.name);
    const description = window.prompt('Category description', category.description || '');
    if (name) {
      this.service.updateCategory(category.id, name, description || '');
    }
  }

  deleteCategory(categoryId: string): void {
    if (confirm('Delete this category and all its sheets?')) {
      this.service.deleteCategory(categoryId);
    }
  }

  createQuestionSet(): void {
    const name = window.prompt('New sheet name');
    if (!name) return;
    const description = window.prompt('Sheet description', '') || '';
    this.service.createQuestionSet(name, description, 0);
    const activeSet = this.service.activeSet();
    if (activeSet) {
      this.setName = activeSet.name;
      this.setDescription = activeSet.description || '';
      this.setTimer = activeSet.timerSeconds || null;
    }
  }

  saveSet(): void {
    if (!this.service.selectedSetId()) return;
    this.service.updateQuestionSet(
      this.service.selectedSetId()!,
      this.setName || 'Untitled',
      this.setDescription,
      this.setTimer || undefined,
    );
  }

  addNewQuestion(): void {
    this.service.addQuestion();
    const activeSet = this.service.activeSet();
    if (activeSet) {
      this.currentQuestion = activeSet.questions[activeSet.questions.length - 1];
      this.correctAnswerText = this.answerTextForQuestion(this.currentQuestion);
    }
  }

  selectQuestion(question: AssessmentQuestion): void {
    const selectedQuestion = structuredClone(question);
    this.currentQuestion = selectedQuestion;
    this.correctAnswerText = this.answerTextForQuestion(selectedQuestion);
  }

  addOption(): void {
    if (!this.currentQuestion) return;
    const options = this.currentQuestion.options || [];
    options.push({
      id: `o_${Math.random().toString(36).slice(2, 11)}`,
      label: 'New option',
      value: `option-${options.length + 1}`,
    });
    this.currentQuestion.options = options;
  }

  removeOption(index: number): void {
    if (!this.currentQuestion?.options) return;
    const options = [...this.currentQuestion.options];
    options.splice(index, 1);
    this.currentQuestion.options = options;
  }

  saveQuestion(): void {
    if (!this.currentQuestion || !this.service.selectedSetId()) return;
    const question = {
      ...this.currentQuestion,
      correctAnswers: this.parseCorrectAnswers(this.correctAnswerText),
    };
    this.service.saveQuestion(this.service.selectedSetId()!, question);
    this.currentQuestion = question;
  }

  duplicateQuestion(): void {
    if (!this.currentQuestion || !this.service.selectedSetId()) return;
    this.service.duplicateQuestion(this.service.selectedSetId()!, this.currentQuestion.id);
  }

  removeQuestion(): void {
    if (!this.currentQuestion || !this.service.selectedSetId()) return;
    if (confirm('Delete this question?')) {
      this.service.removeQuestion(this.service.selectedSetId()!, this.currentQuestion.id);
      this.currentQuestion = this.service.activeSet()?.questions[0] || null;
    }
  }

  answerTextForQuestion(question: AssessmentQuestion): string {
    if (!question) return '';
    if (question.type === 'checkbox') {
      return (question.correctAnswers || []).join(', ');
    }
    return question.correctAnswer || '';
  }

  parseCorrectAnswers(text: string): string[] {
    return text
      .split(/[;,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  showOptionsEditor(type: QuestionInputType): boolean {
    return type === 'radio' || type === 'checkbox' || type === 'mixed';
  }

  isCheckboxOptionChecked(question: AssessmentQuestion, optionValue: string): boolean {
    const current = this.service.valueForQuestion(question);
    return Array.isArray(current) && current.includes(optionValue);
  }

  textResponse(question: AssessmentQuestion): string {
    const current = this.service.valueForQuestion(question);
    return typeof current === 'string' ? current : '';
  }

  mixedResponseValue(question: AssessmentQuestion, controlId: string): string {
    const current = this.service.valueForQuestion(question);
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return (current as Record<string, any>)[controlId] || '';
    }
    return '';
  }

  mixedResponseChecked(
    question: AssessmentQuestion,
    controlId: string,
    optionValue: string,
  ): boolean {
    const current = this.service.valueForQuestion(question);
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return (current as Record<string, any>)[controlId] === optionValue;
    }
    return false;
  }

  toggleCheckbox(question: AssessmentQuestion, optionValue: string, checked: boolean): void {
    const current = this.service.valueForQuestion(question) as string[];
    const values = Array.isArray(current) ? [...current] : [];
    if (checked) {
      values.push(optionValue);
    } else {
      const index = values.indexOf(optionValue);
      if (index >= 0) values.splice(index, 1);
    }
    this.service.updateResponse(question.id, values);
  }

  updateMixedResponse(question: AssessmentQuestion, controlId: string, value: string): void {
    const current = this.service.valueForQuestion(question) as Record<string, string>;
    const next = { ...(current as Record<string, string>), [controlId]: value };
    this.service.updateResponse(question.id, next);
  }

  startAssessment(): void {
    this.viewMode.set('test');
  }

  previewCertificate(): void {
    if (!this.service.lastResult()) {
      alert('Submit the assessment first to preview the certificate.');
      return;
    }
    const name = window.prompt('Enter your name for the certificate', 'Learner');
    if (name) {
      this.service.generateCertificate(name);
    }
  }

  downloadCertificate(): void {
    const name =
      this.service.certificatePreview()?.userName ||
      window.prompt('Enter your name for the certificate', 'Learner');
    if (name) {
      this.service.downloadCertificatePdf(name);
    }
  }

  handleImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.service.importFromExcel(file);
    input.value = '';
  }

  toggleSideNav(): void {
    this.service.sideNavOpenMobile.set(!this.service.sideNavOpenMobile());
  }
}
