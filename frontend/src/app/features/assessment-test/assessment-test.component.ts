import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AssessmentTestService,
  AssessmentQuestion,
  QuestionInputType,
  Category,
  QuestionSet,
} from './assessment-test.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-assessment-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="assessment-page"
      [class.library-collapsed]="libraryCollapsed()"
      [class.jarvis-mode]="themeService.isJarvis()"
    >
      <!-- Mobile Drawer Backdrop Overlay -->
      <div
        class="sidebar-backdrop"
        *ngIf="service.sideNavOpenMobile()"
        (click)="closeMobileLibrary()"
      ></div>

      <div class="assessment-layout">
        <!-- Collapsible Left Panel: Question Library (Edge Positioned) -->
        <aside class="side-nav" [class.mobile-open]="service.sideNavOpenMobile()">
          <div class="sidebar-header">
            <div class="header-titles">
              <div class="library-header-row">
                <div class="lib-title-box">
                  <span class="lib-icon">📁</span>
                  <h2>Question Library</h2>
                </div>
                <button
                  class="btn-icon collapse-btn-desktop"
                  type="button"
                  [title]="libraryCollapsed() ? 'Expand Library' : 'Collapse Library'"
                  (click)="toggleLibrary()"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path [attr.d]="libraryCollapsed() ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'"/>
                  </svg>
                </button>
              </div>
              <p class="tool-subtitle">Categories & question sheets</p>
            </div>
            <button
              class="close-nav-mobile"
              type="button"
              aria-label="Close drawer"
              (click)="closeMobileLibrary()"
            >
              ×
            </button>
          </div>

          <div class="sidebar-tools">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                type="search"
                placeholder="Search categories or sheets..."
                [(ngModel)]="searchQuery"
              />
            </div>
            <div class="sidebar-buttons">
              <button class="btn btn-primary btn-sm btn-interactive" (click)="createCategory()">
                <span>➕</span> Category
              </button>
              <button class="btn btn-secondary btn-sm btn-interactive" (click)="createQuestionSet()">
                <span>➕</span> Sheet
              </button>
            </div>
            <div class="sidebar-buttons">
              <label class="file-upload btn btn-ghost btn-sm btn-interactive">
                📥 Import
                <input type="file" accept=".xlsx,.xls" hidden (change)="handleImport($event)" />
              </label>
              <button class="btn btn-ghost btn-sm btn-interactive" (click)="exportToExcel()">
                📤 Export
              </button>
              <button class="btn btn-ghost btn-sm btn-interactive" (click)="syncToCloud()">
                ☁️ Sync
              </button>
            </div>
            <div class="sound-toggle-wrapper">
              <label class="sound-toggle">
                <input
                  type="checkbox"
                  [ngModel]="service.interactionSoundsEnabled()"
                  (ngModelChange)="service.interactionSoundsEnabled.set($event)"
                />
                <span>🔊 Interaction sounds</span>
              </label>
            </div>
          </div>

          <!-- Category Accordions List -->
          <div class="sidebar-content">
            <div
              *ngFor="let category of filteredCategories"
              class="category-block glass-card"
              [class.drag-target]="dragOverCategoryId() === category.id"
              (dragover)="onCategoryDragOver($event, category.id)"
              (dragleave)="onCategoryDragLeave(category.id)"
              (drop)="onSheetDrop($event, category.id)"
            >
              <div class="category-header">
                <button class="category-toggle" type="button" (click)="toggleCategory(category.id)">
                  <span class="chevron" [class.expanded]="expandedCategories.has(category.id)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </span>
                  <div class="category-title-wrap">
                    <strong class="category-name">{{ category.name }}</strong>
                    <span class="sheet-badge">
                      {{ questionSetCount(category.id) }} sheet{{ questionSetCount(category.id) === 1 ? '' : 's' }}
                    </span>
                  </div>
                </button>
                <div class="category-header-actions">
                  <button
                    class="icon-action-btn"
                    title="Add Sheet to Category"
                    (click)="addSheetToCategory(category.id); $event.stopPropagation()"
                  >
                    ➕
                  </button>
                  <button
                    class="icon-action-btn"
                    title="Edit Category"
                    (click)="editCategory(category); $event.stopPropagation()"
                  >
                    ✏️
                  </button>
                  <button
                    class="icon-action-btn icon-action-danger"
                    title="Delete Category"
                    (click)="deleteCategory(category.id); $event.stopPropagation()"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Sheets List inside expanded category -->
              <div class="sheet-list" *ngIf="expandedCategories.has(category.id)">
                <button
                  *ngFor="let sheet of sheetsForCategory(category.id)"
                  class="sheet-item btn-interactive"
                  draggable="true"
                  [class.active]="service.selectedSetId() === sheet.id"
                  (dragstart)="onSheetDragStart($event, sheet.id)"
                  (dragend)="onSheetDragEnd()"
                  (click)="selectSheet(sheet.id)"
                >
                  <div class="sheet-item-header">
                    <span class="drag-handle" title="Drag to move sheet">⋮⋮</span>
                    <span class="sheet-name">{{ sheet.name }}</span>
                  </div>
                  <div class="sheet-meta-tags">
                    <span class="tag-pill">{{ sheet.questions.length }} qns</span>
                    <span class="tag-pill">{{ formatSeconds(sheet.timerSeconds || 0) }}</span>
                  </div>
                </button>
                <div *ngIf="sheetsForCategory(category.id).length === 0" class="empty-sheet-msg">
                  No sheets in category. Click ➕ to add one.
                </div>
              </div>
            </div>
          </div>

          <div class="sidebar-footer">
            <small *ngIf="service.syncMessage()">{{ service.syncMessage() }}</small>
            <small *ngIf="service.exportMessage()">{{ service.exportMessage() }}</small>
            <div *ngIf="service.importErrors().length" class="import-errors">
              <p>Import problems:</p>
              <ul>
                <li *ngFor="let error of service.importErrors()">{{ error }}</li>
              </ul>
            </div>
          </div>
        </aside>

        <!-- Main Content Area (Full Width) -->
        <main class="assessment-main">
          <!-- Main Top Header Card with Title, Subtitle, and View Mode Buttons -->
          <div class="main-top-card glass-card">
            <div class="top-card-header">
              <div class="title-with-mobile-btn">
                <button
                  class="btn btn-secondary btn-sm btn-interactive mobile-menu-btn"
                  (click)="toggleSideNav()"
                >
                  📁 Question Library
                </button>
                <div class="arc-reactor-mini" *ngIf="themeService.isJarvis()" title="J.A.R.V.I.S. HUD Core Active">
                  <svg viewBox="0 0 40 40" width="32" height="32">
                    <circle cx="20" cy="20" r="16" stroke="#00c8ff" stroke-width="1.5" fill="rgba(0, 200, 255, 0.12)" />
                    <circle cx="20" cy="20" r="11" stroke="#00c8ff" stroke-width="1" stroke-dasharray="4,3" class="spin-hud" />
                    <polygon points="20,7 24,15 32,15 26,20 28,28 20,23 12,28 14,20 8,15 16,15" fill="none" stroke="#00c8ff" stroke-width="0.8" opacity="0.6" />
                    <circle cx="20" cy="20" r="5" fill="#00c8ff" class="core-glow" />
                  </svg>
                </div>
                <h1 class="tool-title">Assessment Test</h1>
              </div>
              <p class="tool-subtitle">
                Build categories, question sheets, and run assessments with automatic scoring, certificates, import/export, and cloud sync.
              </p>
            </div>

            <div class="top-card-right">
              <button
                *ngIf="libraryCollapsed()"
                class="btn btn-secondary btn-sm btn-interactive expand-library-btn"
                (click)="toggleLibrary()"
              >
                ▶ Question Library
              </button>
              <div class="mode-tabs">
                <button
                  class="tab-btn btn-interactive"
                  [class.active]="viewMode() === 'builder'"
                  (click)="switchViewMode('builder')"
                >
                  🛠️ Builder
                </button>
                <button
                  class="tab-btn btn-interactive"
                  [class.active]="viewMode() === 'test'"
                  (click)="switchViewMode('test')"
                >
                  📝 Take Test
                </button>
                <button
                  class="tab-btn btn-interactive"
                  [class.active]="viewMode() === 'results'"
                  (click)="switchViewMode('results')"
                >
                  📊 Results
                </button>
              </div>
            </div>
          </div>

          <!-- BUILDER MODE -->
          <section *ngIf="viewMode() === 'builder'" class="builder-section">
            <!-- 1. Selected Sheet Accordion (Top) -->
            <div class="panel glass-card selected-sheet-panel">
              <button
                class="accordion-heading"
                type="button"
                (click)="selectedSheetOpen.set(!selectedSheetOpen()); service.playSound('navigate')"
              >
                <div class="accordion-title-box">
                  <span class="accordion-icon">📋</span>
                  <div class="accordion-text">
                    <h3>Selected Sheet Details</h3>
                    <div class="compact-summary-pills">
                      <span class="summary-pill highlight">{{ activeSetName || 'No sheet selected' }}</span>
                      <span class="summary-pill">Category: {{ service.getCategoryName(service.activeSet()?.categoryId || null) }}</span>
                      <span class="summary-pill">{{ activeSetQuestionCount }} Questions</span>
                      <span class="summary-pill">{{ activeSetTotalMarks }} Marks</span>
                      <span class="summary-pill">Duration: {{ formatSeconds(setTimer || 0) }}</span>
                    </div>
                  </div>
                </div>
                <span class="chevron" [class.expanded]="selectedSheetOpen()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>

              <div *ngIf="selectedSheetOpen()" class="accordion-content">
                <ng-container *ngIf="service.activeSet(); else noSetPrompt">
                  <div class="form-grid">
                    <div class="form-group span-2">
                      <label>Sheet Name</label>
                      <input type="text" [(ngModel)]="setName" placeholder="Enter sheet title" />
                    </div>
                    <div class="form-group span-2">
                      <label>Description</label>
                      <textarea [(ngModel)]="setDescription" rows="2" placeholder="Brief sheet instructions or description"></textarea>
                    </div>

                    <div class="form-group">
                      <label>Total Exam Duration Preset</label>
                      <select [(ngModel)]="durationPreset" (ngModelChange)="applyDurationPreset($event)">
                        <option value="600">10 minutes</option>
                        <option value="1200">20 minutes</option>
                        <option value="1800">30 minutes</option>
                        <option value="2700">45 minutes</option>
                        <option value="3600">60 minutes</option>
                        <option value="custom">Custom duration</option>
                      </select>
                    </div>

                    <div class="form-group">
                      <label>Custom Duration (Seconds)</label>
                      <input type="number" [(ngModel)]="setTimer" min="0" placeholder="e.g. 600 for 10 min" />
                    </div>
                  </div>

                  <div class="sheet-meta-grid">
                    <div class="meta-card">
                      <small>Category</small>
                      <strong>{{ service.getCategoryName(service.activeSet()?.categoryId || null) }}</strong>
                    </div>
                    <div class="meta-card">
                      <small>Total Questions</small>
                      <strong>{{ activeSetQuestionCount }}</strong>
                    </div>
                    <div class="meta-card">
                      <small>Total Marks</small>
                      <strong>{{ activeSetTotalMarks }}</strong>
                    </div>
                    <div class="meta-card">
                      <small>Configured Duration</small>
                      <strong>{{ formatSeconds(setTimer || 0) }}</strong>
                    </div>
                  </div>

                  <div class="panel-actions">
                    <button class="btn btn-primary btn-interactive" (click)="saveSet()">
                      💾 Save Sheet Details
                    </button>
                    <button
                      class="btn btn-danger btn-interactive"
                      (click)="service.deleteQuestionSet(service.selectedSetId() || ''); service.playSound('action')"
                    >
                      🗑️ Delete Sheet
                    </button>
                  </div>
                </ng-container>
                <ng-template #noSetPrompt>
                  <p class="empty-state">Select a question sheet from the Question Library panel on the left, or create a new sheet to begin.</p>
                </ng-template>
              </div>
            </div>

            <!-- 2. Questions & Question Editor Accordion (Below Selected Sheet) -->
            <div class="panel glass-card questions-editor-accordion">
              <button
                class="accordion-heading"
                type="button"
                (click)="questionsEditorOpen.set(!questionsEditorOpen()); service.playSound('navigate')"
              >
                <div class="accordion-title-box">
                  <span class="accordion-icon">✏️</span>
                  <div class="accordion-text">
                    <h3>Questions & Question Editor</h3>
                    <div class="compact-summary-pills">
                      <span class="summary-pill highlight">Active Q: {{ currentQuestion?.title || 'None' }}</span>
                      <span class="summary-pill">{{ activeSetQuestionCount }} Available Questions</span>
                    </div>
                  </div>
                </div>
                <span class="chevron" [class.expanded]="questionsEditorOpen()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>

              <div *ngIf="questionsEditorOpen()" class="accordion-content">
                <div class="builder-2col-layout">
                  <!-- Column 1: Questions List -->
                  <div class="questions-list-col">
                    <div class="list-col-header">
                      <h4>Questions ({{ activeSetQuestionCount }})</h4>
                      <button class="btn btn-sm btn-primary btn-interactive" (click)="addNewQuestion()">
                        ➕ Add Question
                      </button>
                    </div>

                    <div class="question-scroll-list" *ngIf="service.activeSet() as activeSet">
                      <div
                        *ngFor="let question of activeSet.questions; let i = index"
                        class="question-list-card btn-interactive"
                        [class.selected]="question.id === currentQuestion?.id"
                        (click)="selectQuestion(question)"
                      >
                        <div class="q-card-top">
                          <span class="q-number">Q{{ i + 1 }}</span>
                          <span class="type-pill">{{ question.type }}</span>
                          <span class="weight-badge">{{ question.weight }} pt</span>
                        </div>
                        <div class="q-title-text">{{ question.title }}</div>
                      </div>

                      <div *ngIf="activeSet.questions.length === 0" class="empty-state">
                        No questions in this sheet yet. Click "+ Add Question" above.
                      </div>
                    </div>
                  </div>

                  <!-- Column 2: Question Editor -->
                  <div class="question-editor-col">
                    <ng-container *ngIf="currentQuestion; else noQuestionSelected">
                      <div class="editor-header">
                        <h4>Editing Question</h4>
                        <span class="type-pill">{{ currentQuestion.type }}</span>
                      </div>

                      <div class="form-grid">
                        <div class="form-group span-2">
                          <label>Question Title</label>
                          <input type="text" [(ngModel)]="currentQuestion.title" placeholder="Enter question text" />
                        </div>

                        <div class="form-group span-2">
                          <label>Instructions / Help Text</label>
                          <textarea [(ngModel)]="currentQuestion.description" rows="2" placeholder="Optional instructions for learner"></textarea>
                        </div>

                        <div class="form-group">
                          <label>Input Type</label>
                          <select [(ngModel)]="currentQuestion.type">
                            <option *ngFor="let type of questionTypes" [value]="type">{{ type }}</option>
                          </select>
                        </div>

                        <div class="form-group">
                          <label>Weight (Marks)</label>
                          <input type="number" [(ngModel)]="currentQuestion.weight" min="0" />
                        </div>

                        <div class="form-group">
                          <label>Negative Mark</label>
                          <input type="number" [(ngModel)]="currentQuestion.negativeMark" min="0" />
                        </div>

                        <div class="form-group checkbox-group">
                          <label class="custom-checkbox">
                            <input type="checkbox" [(ngModel)]="currentQuestion.required" />
                            <span>Required Question</span>
                          </label>
                        </div>
                      </div>

                      <!-- Options Editor for Radio / Checkbox / Mixed -->
                      <div *ngIf="showOptionsEditor(currentQuestion.type)" class="options-editor-box">
                        <div class="options-header">
                          <label>Answer Options</label>
                          <button class="btn btn-secondary btn-xs btn-interactive" (click)="addOption()">
                            ➕ Add Option
                          </button>
                        </div>

                        <div
                          *ngFor="let option of currentQuestion.options; let idx = index"
                          class="option-row"
                        >
                          <input type="text" [(ngModel)]="option.label" placeholder="Option Label" />
                          <input type="text" [(ngModel)]="option.value" placeholder="Option Value" />
                          <button
                            class="btn btn-danger btn-xs btn-interactive"
                            (click)="removeOption(idx)"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div class="form-group">
                        <label>Correct Answer(s)</label>
                        <input
                          type="text"
                          [(ngModel)]="correctAnswerText"
                          placeholder="Single value or comma-separated list of values"
                        />
                        <small class="help-text">Enter matching value(s) for automatic grading.</small>
                      </div>

                      <div class="panel-actions">
                        <button class="btn btn-primary btn-interactive" (click)="saveQuestion()">
                          💾 Save Question
                        </button>
                        <button class="btn btn-secondary btn-interactive" (click)="duplicateQuestion()">
                          📄 Duplicate
                        </button>
                        <button class="btn btn-danger btn-interactive" (click)="removeQuestion()">
                          🗑️ Delete
                        </button>
                      </div>
                    </ng-container>
                    <ng-template #noQuestionSelected>
                      <div class="empty-state">
                        Select a question from the left list or click "+ Add Question".
                      </div>
                    </ng-template>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- TAKE TEST MODE -->
          <section *ngIf="viewMode() === 'test'" class="test-section">
            <!-- 1. Assessment Overview Accordion (Sticky Header with Timer) -->
            <div
              class="panel glass-card test-overview"
              [class.sticky-timer]="service.testStarted() || service.testSubmitted()"
              [class.low-time]="timerState === 'low'"
              [class.critical-time]="timerState === 'critical'"
            >
              <button
                class="accordion-heading"
                type="button"
                (click)="overviewOpen.set(!overviewOpen()); service.playSound('navigate')"
              >
                <div class="accordion-title-box">
                  <span class="accordion-icon">📝</span>
                  <div class="accordion-text">
                    <h3>Assessment Overview</h3>
                    <div class="compact-summary-pills">
                      <span class="summary-pill highlight">{{ activeSetName }}</span>
                      <span class="summary-pill">Category: {{ service.getCategoryName(service.activeSet()?.categoryId || null) }}</span>
                      <span class="summary-pill">{{ activeSetQuestionCount }} Qns</span>
                      <span class="summary-pill">{{ activeSetTotalMarks }} Marks</span>
                      <span class="summary-pill">Duration: {{ formatSeconds(service.activeSet()?.timerSeconds || 0) }}</span>
                      <span class="summary-pill">Pass: 60%</span>
                      <span class="summary-pill badge-attempt">{{ attemptLabel }}</span>
                    </div>
                  </div>
                </div>

                <div class="timer-display-badge" *ngIf="service.testStarted() || service.testSubmitted()">
                  ⏱️ {{ formatSeconds(service.remainingSeconds()) }}
                </div>

                <span class="chevron" [class.expanded]="overviewOpen()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>

              <div *ngIf="overviewOpen()" class="accordion-content">
                <p class="sheet-desc-text" *ngIf="service.activeSet()?.description">
                  {{ service.activeSet()?.description }}
                </p>

                <div class="timer-strip" *ngIf="service.testStarted() || service.testSubmitted()">
                  <div class="timer-metric">
                    <small>Time Remaining</small>
                    <strong class="timer-val">{{ formatSeconds(service.remainingSeconds()) }}</strong>
                  </div>
                  <div class="timer-metric">
                    <small>Total Duration</small>
                    <strong>{{ formatSeconds(service.activeSet()?.timerSeconds || 0) }}</strong>
                  </div>
                  <div class="timer-metric">
                    <small>Answered Progress</small>
                    <strong>{{ service.progress() }}%</strong>
                  </div>
                  <div class="progress-bar-container">
                    <div class="progress-bar-fill" [style.width.%]="service.progress()"></div>
                  </div>
                </div>

                <div class="panel-actions">
                  <button class="btn btn-primary btn-lg btn-interactive" (click)="startAssessment()">
                    {{ testStartLabel }}
                  </button>
                  <button
                    class="btn btn-secondary btn-lg btn-interactive"
                    [disabled]="!service.testStarted() || service.testSubmitted()"
                    (click)="submitAndShowResults()"
                  >
                    Submit Assessment
                  </button>
                </div>
              </div>
            </div>

            <!-- Time Over Banner -->
            <div class="time-over-banner glass-card" *ngIf="service.autoSubmitted()">
              ⚠️ Time Over! The assessment was submitted automatically.
            </div>

            <!-- Question Display Area (Maximum Content Width) -->
            <div
              class="panel glass-card test-question-card"
              *ngIf="service.activeQuestion() as question"
            >
              <div class="question-card-top-bar">
                <div class="q-badge">
                  Question {{ service.activeQuestionIndex() + 1 }} of {{ activeSetQuestionCount }}
                </div>
                <div class="q-weight-badge">Weight: {{ question.weight }} mark(s)</div>
              </div>

              <div class="question-header">
                <h2 class="question-title">{{ question.title }}</h2>
                <p class="question-desc" *ngIf="question.description">{{ question.description }}</p>
              </div>

              <div class="question-body">
                <ng-container [ngSwitch]="question.type">
                  <!-- Radio Options -->
                  <div *ngSwitchCase="'radio'" class="options-container">
                    <label
                      *ngFor="let option of question.options"
                      class="answer-option-card btn-interactive"
                      [class.selected]="service.valueForQuestion(question) === option.value"
                    >
                      <input
                        type="radio"
                        [name]="question.id"
                        [value]="option.value"
                        [disabled]="answersLocked"
                        [checked]="service.valueForQuestion(question) === option.value"
                        (change)="service.updateResponse(question.id, option.value); service.playSound('click')"
                      />
                      <span class="option-text">{{ option.label }}</span>
                    </label>
                  </div>

                  <!-- Checkbox Options -->
                  <div *ngSwitchCase="'checkbox'" class="options-container">
                    <label
                      *ngFor="let option of question.options"
                      class="answer-option-card btn-interactive"
                      [class.selected]="isCheckboxOptionChecked(question, option.value)"
                    >
                      <input
                        type="checkbox"
                        [value]="option.value"
                        [disabled]="answersLocked"
                        [checked]="isCheckboxOptionChecked(question, option.value)"
                        (change)="
                          toggleCheckbox(question, option.value, $any($event.target).checked);
                          service.playSound('click')
                        "
                      />
                      <span class="option-text">{{ option.label }}</span>
                    </label>
                  </div>

                  <!-- Textbox Option -->
                  <div *ngSwitchCase="'textbox'" class="text-input-box">
                    <input
                      type="text"
                      class="answer-text-input"
                      placeholder="Type your answer here..."
                      [disabled]="answersLocked"
                      [value]="textResponse(question)"
                      (input)="service.updateResponse(question.id, $any($event.target).value)"
                    />
                  </div>

                  <!-- Textarea Option -->
                  <div *ngSwitchCase="'textarea'" class="text-input-box">
                    <textarea
                      rows="6"
                      class="answer-textarea-input"
                      placeholder="Type your detailed response here..."
                      [disabled]="answersLocked"
                      [value]="textResponse(question)"
                      (input)="service.updateResponse(question.id, $any($event.target).value)"
                    ></textarea>
                  </div>

                  <!-- Mixed Question Option -->
                  <div *ngSwitchCase="'mixed'" class="mixed-controls-box">
                    <div *ngFor="let child of question.controls || []" class="mixed-sub-card">
                      <h4 class="sub-q-title">{{ child.title }}</h4>
                      <ng-container [ngSwitch]="child.type">
                        <div *ngSwitchCase="'radio'" class="options-container">
                          <label
                            *ngFor="let option of child.options"
                            class="answer-option-card btn-interactive"
                            [class.selected]="mixedResponseChecked(question, child.id, option.value)"
                          >
                            <input
                              type="radio"
                              [name]="child.id"
                              [value]="option.value"
                              [disabled]="answersLocked"
                              [checked]="mixedResponseChecked(question, child.id, option.value)"
                              (change)="
                                updateMixedResponse(question, child.id, option.value);
                                service.playSound('click')
                              "
                            />
                            <span class="option-text">{{ option.label }}</span>
                          </label>
                        </div>
                        <div *ngSwitchCase="'textbox'" class="text-input-box">
                          <input
                            type="text"
                            class="answer-text-input"
                            placeholder="Type response..."
                            [disabled]="answersLocked"
                            [value]="mixedResponseValue(question, child.id)"
                            (input)="
                              updateMixedResponse(question, child.id, $any($event.target).value)
                            "
                          />
                        </div>
                      </ng-container>
                    </div>
                  </div>
                </ng-container>
              </div>

              <!-- Question Action Controls -->
              <div class="question-nav-bar">
                <button
                  class="btn btn-secondary btn-interactive"
                  [disabled]="service.activeQuestionIndex() === 0"
                  (click)="service.previousQuestion(); service.playSound('navigate')"
                >
                  ← Previous
                </button>

                <div class="question-pills">
                  <button
                    *ngFor="let q of service.activeSet()?.questions; let idx = index"
                    class="q-pill btn-interactive"
                    [class.active]="idx === service.activeQuestionIndex()"
                    [class.answered]="service.hasResponseForQuestion(q)"
                    (click)="service.jumpToQuestion(idx); service.playSound('navigate')"
                  >
                    {{ idx + 1 }}
                  </button>
                </div>

                <button
                  *ngIf="service.activeQuestionIndex() < activeSetQuestionCount - 1"
                  class="btn btn-primary btn-interactive"
                  (click)="service.nextQuestion(); service.playSound('navigate')"
                >
                  Next →
                </button>

                <button
                  *ngIf="service.activeQuestionIndex() === activeSetQuestionCount - 1"
                  class="btn btn-success btn-interactive"
                  [disabled]="!service.testStarted() || service.testSubmitted()"
                  (click)="submitAndShowResults()"
                >
                  Submit Test ✓
                </button>
              </div>
            </div>
          </section>

          <!-- RESULTS MODE -->
          <section *ngIf="viewMode() === 'results'" class="results-section">
            <div class="panel glass-card results-summary" *ngIf="service.lastResult() as result">
              <div class="results-header-banner">
                <h3>Assessment Results</h3>
                <div class="pass-status-pill" [class.passed]="result.passed" [class.failed]="!result.passed">
                  {{ result.passed ? 'PASSED ✓' : 'FAILED ✗' }}
                </div>
              </div>

              <div class="auto-status-banner" *ngIf="result.submissionStatus === 'auto-time-over'">
                ⏱️ Submitted Automatically — Time Over
              </div>

              <div class="score-hero">
                <div class="score-val">{{ result.score }} / {{ result.maxScore }}</div>
                <div class="percentage-badge">{{ result.percentage }}%</div>
                <div class="badge-pill">{{ result.badge }}</div>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <small>Correct Answers</small>
                  <strong class="text-success">{{ result.correctCount }}</strong>
                </div>
                <div class="stat-card">
                  <small>Incorrect Answers</small>
                  <strong class="text-danger">{{ result.incorrectCount }}</strong>
                </div>
                <div class="stat-card">
                  <small>Unanswered / Skipped</small>
                  <strong>{{ result.skippedCount }}</strong>
                </div>
                <div class="stat-card">
                  <small>Total Questions</small>
                  <strong>{{ result.totalQuestions }}</strong>
                </div>
                <div class="stat-card">
                  <small>Total Marks</small>
                  <strong>{{ result.totalMarks }}</strong>
                </div>
                <div class="stat-card">
                  <small>Passing Score</small>
                  <strong>{{ result.passingScore }}%</strong>
                </div>
                <div class="stat-card">
                  <small>Time Taken</small>
                  <strong>{{ formatSeconds(result.timeTakenSeconds) }}</strong>
                </div>
                <div class="stat-card">
                  <small>Total Duration</small>
                  <strong>{{ formatSeconds(result.totalDurationSeconds) }}</strong>
                </div>
                <div class="stat-card">
                  <small>Submission Type</small>
                  <strong>{{ result.submissionStatus === 'manual' ? 'Manual' : 'Time Over' }}</strong>
                </div>
              </div>

              <div class="panel-actions">
                <button class="btn btn-primary btn-interactive" (click)="previewCertificate()">
                  📜 Preview Certificate
                </button>
              </div>
            </div>

            <!-- Question Feedback Breakdown -->
            <div class="panel glass-card" *ngIf="service.lastResult() as result">
              <h4>Detailed Question Feedback</h4>
              <div *ngFor="let detail of result.details" class="feedback-row">
                <div class="feedback-top">
                  <strong>{{ detail.questionTitle }}</strong>
                  <span class="earned-badge" [class.earned-full]="detail.correct">
                    {{ detail.earned }} / {{ detail.possible }} pts
                  </span>
                </div>
                <div class="feedback-text">{{ detail.feedback }}</div>
              </div>
            </div>

            <!-- Certificate Preview -->
            <div
              *ngIf="service.certificatePreview() as certificate"
              class="panel glass-card certificate-card"
            >
              <h4>Certificate Preview</h4>
              <div class="certificate-box">
                <h2>🏆 {{ certificate.badge }}</h2>
                <p>This certifies that</p>
                <h3 class="learner-name">{{ certificate.userName }}</h3>
                <p>
                  has completed the assessment <strong>{{ certificate.assessmentName }}</strong> in category
                  <strong>{{ certificate.category }}</strong>.
                </p>
                <div class="cert-stats">
                  <span>Score: {{ certificate.score }} ({{ certificate.percentage }}%)</span>
                  <span>Date: {{ certificate.completedAt | date: 'mediumDate' }}</span>
                </div>
              </div>
              <div class="panel-actions">
                <button class="btn btn-primary btn-interactive" (click)="downloadCertificate()">
                  📥 Download PDF Certificate
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
        width: 100%;
        min-height: calc(100vh - 60px);
        padding: 0 1.25rem 2rem 0;
        margin: 0;
        box-sizing: border-box;
      }

      .assessment-layout {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        gap: 1.25rem;
        align-items: start;
        width: 100%;
        transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .assessment-page.library-collapsed .assessment-layout {
        grid-template-columns: 68px minmax(0, 1fr);
      }

      /* Collapsible Left Panel (Edge Positioned) */
      aside.side-nav {
        position: sticky;
        top: 4.5rem;
        height: calc(100vh - 5.5rem);
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, rgba(226, 232, 240, 0.8));
        border-left: none;
        border-radius: 0 16px 16px 0;
        padding: 1.1rem 0.9rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        box-shadow: 2px 0 12px rgba(0, 0, 0, 0.03);
        margin-left: 0;
        transition: transform 0.3s ease, width 0.3s ease, padding 0.3s ease;
      }
      .assessment-page.library-collapsed aside.side-nav {
        padding: 0.75rem 0.4rem;
      }
      .assessment-page.library-collapsed aside.side-nav .sidebar-header .tool-subtitle,
      .assessment-page.library-collapsed aside.side-nav .sidebar-tools,
      .assessment-page.library-collapsed aside.side-nav .sidebar-content,
      .assessment-page.library-collapsed aside.side-nav .sidebar-footer {
        display: none;
      }
      .assessment-page.library-collapsed aside.side-nav .sidebar-header .lib-title-box h2 {
        display: none;
      }

      .sidebar-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .header-titles {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        width: 100%;
      }
      .library-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }
      .lib-title-box {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .lib-icon {
        font-size: 1.25rem;
      }
      .library-header-row h2 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--text-primary, #0f172a);
      }
      .tool-subtitle {
        margin: 0;
        font-size: 0.8rem;
        color: var(--text-secondary, #64748b);
        line-height: 1.35;
      }
      .btn-icon {
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 6px;
        color: var(--text-secondary, #64748b);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .btn-icon:hover {
        background: rgba(0, 0, 0, 0.05);
        color: var(--accent-primary, #6366f1);
      }
      .close-nav-mobile {
        display: none;
        border: none;
        background: transparent;
        font-size: 1.6rem;
        cursor: pointer;
        color: var(--text-secondary, #64748b);
      }

      .sidebar-tools {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .search-box {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-icon {
        position: absolute;
        left: 0.75rem;
        font-size: 0.85rem;
        pointer-events: none;
      }
      .search-box input {
        width: 100%;
        padding: 0.55rem 0.75rem 0.55rem 2.2rem;
        border-radius: 10px;
        border: 1px solid var(--border-color, #e2e8f0);
        background: var(--bg-surface, #f8fafc);
        font-size: 0.85rem;
      }
      .sidebar-buttons {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .sound-toggle-wrapper {
        padding-top: 0.1rem;
      }
      .sound-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.82rem;
        color: var(--text-secondary, #64748b);
        cursor: pointer;
      }

      .sidebar-content {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow-y: auto;
      }
      .category-block {
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 12px;
        background: var(--bg-surface, #ffffff);
        overflow: hidden;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .category-block.drag-target {
        border-color: var(--accent-primary, #6366f1);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
      }
      .category-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(99, 102, 241, 0.06);
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        padding: 0.5rem 0.6rem;
      }
      .category-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: none;
        background: transparent;
        cursor: pointer;
        flex: 1;
        text-align: left;
        padding: 0;
        color: var(--text-primary, #0f172a);
      }
      .chevron {
        display: inline-flex;
        transition: transform 0.2s ease;
      }
      .chevron.expanded {
        transform: rotate(90deg);
      }
      .category-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
      .category-name {
        font-size: 0.92rem;
        font-weight: 700;
      }
      .sheet-badge {
        font-size: 0.75rem;
        color: var(--text-secondary, #64748b);
      }
      .category-header-actions {
        display: flex;
        gap: 0.2rem;
      }
      .icon-action-btn {
        border: none;
        background: transparent;
        padding: 0.25rem 0.4rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        opacity: 0.8;
        transition: opacity 0.15s ease, background 0.15s ease;
      }
      .icon-action-btn:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.05);
      }

      .sheet-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem;
      }
      .sheet-item {
        width: 100%;
        text-align: left;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        padding: 0.55rem 0.75rem;
        background: var(--bg-card, #ffffff);
        cursor: grab;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .sheet-item.active {
        background: rgba(99, 102, 241, 0.1);
        border-color: var(--accent-primary, #6366f1);
      }
      .sheet-item-header {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .drag-handle {
        color: var(--text-secondary, #94a3b8);
        font-size: 0.9rem;
      }
      .sheet-name {
        font-weight: 600;
        font-size: 0.88rem;
      }
      .sheet-meta-tags {
        display: flex;
        gap: 0.4rem;
      }
      .tag-pill {
        font-size: 0.72rem;
        background: rgba(0, 0, 0, 0.04);
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        color: var(--text-secondary, #64748b);
      }
      .empty-sheet-msg {
        font-size: 0.78rem;
        color: var(--text-secondary, #64748b);
        padding: 0.4rem;
        font-style: italic;
      }
      .sidebar-footer {
        margin-top: auto;
        font-size: 0.8rem;
        color: var(--text-secondary, #64748b);
      }

      /* Main Content Area (Full Width) */
      .assessment-main {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        min-width: 0;
        width: 100%;
      }

      /* Top Header Card containing Assessment Test Title, Subtitle, and View Mode Buttons */
      .main-top-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem 1.5rem;
        border-radius: 16px;
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
        flex-wrap: wrap;
        gap: 1rem;
      }
      .top-card-header {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .title-with-mobile-btn {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .tool-title {
        margin: 0;
        font-size: 1.8rem;
        font-weight: 900;
        background: linear-gradient(135deg, var(--accent-primary, #6366f1) 0%, #a855f7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .top-card-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .mobile-menu-btn {
        display: none;
      }
      .mode-tabs {
        display: flex;
        gap: 0.5rem;
      }
      .tab-btn {
        border: 1px solid var(--border-color, #e2e8f0);
        background: var(--bg-surface, #f8fafc);
        color: var(--text-primary, #0f172a);
        padding: 0.6rem 1.2rem;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.92rem;
        cursor: pointer;
      }
      .tab-btn.active {
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border-color: var(--accent-primary, #6366f1);
        box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
      }

      /* Accordion Panel Styling */
      .glass-card {
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, rgba(226, 232, 240, 0.8));
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      }
      .accordion-heading {
        width: 100%;
        border: none;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding: 0;
        color: var(--text-primary, #0f172a);
        text-align: left;
      }
      .accordion-title-box {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
      }
      .accordion-icon {
        font-size: 1.4rem;
      }
      .accordion-text h3 {
        margin: 0 0 0.25rem;
        font-size: 1.15rem;
        font-weight: 700;
      }
      .compact-summary-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .summary-pill {
        font-size: 0.78rem;
        background: rgba(0, 0, 0, 0.04);
        padding: 0.2rem 0.55rem;
        border-radius: 6px;
        color: var(--text-secondary, #475569);
      }
      .summary-pill.highlight {
        background: rgba(99, 102, 241, 0.12);
        color: var(--accent-primary, #6366f1);
        font-weight: 700;
      }
      .accordion-content {
        margin-top: 1.25rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--border-color, #e2e8f0);
      }

      /* Form Grids */
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }
      .span-2 {
        grid-column: span 2;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .form-group label {
        font-weight: 600;
        font-size: 0.88rem;
      }
      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 0.7rem 0.9rem;
        border-radius: 10px;
        border: 1px solid var(--border-color, #cbd5e1);
        background: var(--bg-surface, #ffffff);
        color: var(--text-primary, #0f172a);
        font-size: 0.9rem;
      }
      .help-text {
        font-size: 0.78rem;
        color: var(--text-secondary, #64748b);
      }

      .sheet-meta-grid,
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-top: 1.25rem;
      }
      .meta-card,
      .stat-card {
        border: 1px solid var(--border-color, #e2e8f0);
        padding: 0.75rem 1rem;
        border-radius: 12px;
        background: var(--bg-surface, #f8fafc);
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .meta-card small,
      .stat-card small {
        color: var(--text-secondary, #64748b);
        font-size: 0.78rem;
      }
      .meta-card strong,
      .stat-card strong {
        font-size: 1.05rem;
      }

      .panel-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1.25rem;
      }

      /* Builder 2-Column Layout */
      .builder-2col-layout {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 1.25rem;
      }
      .questions-list-col {
        border-right: 1px solid var(--border-color, #e2e8f0);
        padding-right: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .list-col-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .list-col-header h4 {
        margin: 0;
        font-size: 1rem;
      }
      .question-scroll-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 480px;
        overflow-y: auto;
      }
      .question-list-card {
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 10px;
        padding: 0.65rem 0.85rem;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        background: var(--bg-surface, #ffffff);
      }
      .question-list-card.selected {
        border-color: var(--accent-primary, #6366f1);
        background: rgba(99, 102, 241, 0.08);
      }
      .q-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .q-number {
        font-weight: 700;
        font-size: 0.85rem;
      }
      .type-pill {
        font-size: 0.72rem;
        background: rgba(99, 102, 241, 0.12);
        color: var(--accent-primary, #6366f1);
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        font-weight: 600;
      }
      .weight-badge {
        font-size: 0.75rem;
        color: var(--text-secondary, #64748b);
      }
      .q-title-text {
        font-size: 0.88rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .question-editor-col {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .editor-header h4 {
        margin: 0;
        font-size: 1.05rem;
      }
      .options-editor-box {
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 12px;
        padding: 0.9rem;
        background: var(--bg-surface, #f8fafc);
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .options-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .option-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 0.5rem;
        align-items: center;
      }
      .option-row input[type='text'] {
        padding: 0.7rem 0.9rem;
        border-radius: 10px;
        border: 1px solid var(--border-color, #cbd5e1);
        background: var(--bg-surface, #ffffff);
        color: var(--text-primary, #0f172a);
        font-size: 0.9rem;
        min-height: 2.75rem;
        width: 100%;
        box-sizing: border-box;
      }

      /* Take Test Styles */
      .test-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .test-overview.sticky-timer {
        position: sticky;
        top: 4.5rem;
        z-index: 100;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        transition: border-color 0.3s ease;
      }
      .test-overview.low-time {
        border-color: #f97316;
      }
      .test-overview.critical-time {
        border-color: #ef4444;
        animation: pulseBorder 1.2s infinite;
      }
      .timer-display-badge {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--accent-primary, #6366f1);
        background: rgba(99, 102, 241, 0.12);
        padding: 0.45rem 1rem;
        border-radius: 10px;
      }
      .test-overview.low-time .timer-display-badge {
        color: #f97316;
        background: rgba(249, 115, 22, 0.15);
      }
      .test-overview.critical-time .timer-display-badge {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.18);
        animation: pulseText 1s infinite;
      }

      .timer-strip {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        flex-wrap: wrap;
        background: var(--bg-surface, #f8fafc);
        border: 1px solid var(--border-color, #e2e8f0);
        padding: 0.85rem 1.1rem;
        border-radius: 12px;
        margin-bottom: 1rem;
      }
      .timer-metric {
        display: flex;
        flex-direction: column;
      }
      .timer-metric small {
        font-size: 0.75rem;
        color: var(--text-secondary, #64748b);
      }
      .progress-bar-container {
        flex: 1;
        height: 10px;
        background: #e2e8f0;
        border-radius: 999px;
        overflow: hidden;
        min-width: 140px;
      }
      .progress-bar-fill {
        height: 100%;
        background: var(--accent-primary, #6366f1);
        transition: width 0.3s ease;
      }

      .time-over-banner {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid #ef4444;
        color: #ef4444;
        padding: 1rem 1.25rem;
        border-radius: 12px;
        font-weight: 700;
        font-size: 1.05rem;
        text-align: center;
      }

      /* Question Display Card (Wide) */
      .test-question-card {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .question-card-top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .q-badge {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--accent-primary, #6366f1);
        background: rgba(99, 102, 241, 0.1);
        padding: 0.3rem 0.75rem;
        border-radius: 8px;
      }
      .q-weight-badge {
        font-size: 0.85rem;
        color: var(--text-secondary, #64748b);
      }
      .question-title {
        margin: 0 0 0.5rem;
        font-size: 1.4rem;
        line-height: 1.4;
      }
      .question-desc {
        color: var(--text-secondary, #64748b);
        margin: 0;
        font-size: 0.95rem;
      }

      .options-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .answer-option-card {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        padding: 1rem 1.2rem;
        border: 1px solid var(--border-color, #cbd5e1);
        border-radius: 12px;
        background: var(--bg-surface, #ffffff);
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .answer-option-card:hover {
        border-color: var(--accent-primary, #6366f1);
        background: rgba(99, 102, 241, 0.03);
      }
      .answer-option-card.selected {
        border-color: var(--accent-primary, #6366f1);
        background: rgba(99, 102, 241, 0.1);
        font-weight: 600;
      }
      .answer-option-card input {
        width: 1.25rem;
        height: 1.25rem;
        accent-color: var(--accent-primary, #6366f1);
      }
      .option-text {
        font-size: 1.05rem;
      }

      .answer-text-input,
      .answer-textarea-input {
        width: 100%;
        padding: 1rem 1.2rem;
        border-radius: 12px;
        border: 1px solid var(--border-color, #cbd5e1);
        background: var(--bg-surface, #ffffff);
        color: var(--text-primary, #0f172a);
        font-size: 1.05rem;
      }
      .answer-textarea-input {
        min-height: 140px;
        line-height: 1.5;
      }

      .question-nav-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color, #e2e8f0);
        flex-wrap: wrap;
      }
      .question-pills {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }
      .q-pill {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: 1px solid var(--border-color, #cbd5e1);
        background: var(--bg-surface, #f8fafc);
        color: var(--text-primary, #0f172a);
        cursor: pointer;
        font-weight: 600;
        font-size: 0.85rem;
      }
      .q-pill.active {
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border-color: var(--accent-primary, #6366f1);
      }
      .q-pill.answered {
        border-color: #10b981;
        color: #10b981;
      }
      .q-pill.active.answered {
        background: #10b981;
        color: #ffffff;
      }

      /* Results Styling */
      .results-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .results-header-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .results-header-banner h3 {
        margin: 0;
        font-size: 1.4rem;
      }
      .pass-status-pill {
        padding: 0.5rem 1.2rem;
        border-radius: 999px;
        font-weight: 800;
        font-size: 1rem;
        color: #ffffff;
      }
      .pass-status-pill.passed {
        background: #16a34a;
      }
      .pass-status-pill.failed {
        background: #dc2626;
      }

      .auto-status-banner {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid #ef4444;
        color: #ef4444;
        padding: 0.75rem 1rem;
        border-radius: 10px;
        font-weight: 700;
        margin-top: 1rem;
      }
      .score-hero {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        margin-top: 1.25rem;
        padding: 1.25rem;
        background: var(--bg-surface, #f8fafc);
        border-radius: 16px;
        border: 1px solid var(--border-color, #e2e8f0);
      }
      .score-val {
        font-size: 2.5rem;
        font-weight: 900;
      }
      .percentage-badge {
        font-size: 1.6rem;
        font-weight: 800;
        color: var(--accent-primary, #6366f1);
      }
      .badge-pill {
        background: rgba(99, 102, 241, 0.12);
        color: var(--accent-primary, #6366f1);
        padding: 0.4rem 0.9rem;
        border-radius: 999px;
        font-weight: 700;
      }
      .text-success {
        color: #16a34a;
      }
      .text-danger {
        color: #dc2626;
      }

      .feedback-row {
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 12px;
        padding: 0.9rem 1.1rem;
        margin-top: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        background: var(--bg-surface, #ffffff);
      }
      .feedback-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .earned-badge {
        font-size: 0.82rem;
        font-weight: 700;
        padding: 0.2rem 0.55rem;
        border-radius: 6px;
        background: rgba(239, 68, 68, 0.12);
        color: #dc2626;
      }
      .earned-badge.earned-full {
        background: rgba(22, 163, 74, 0.12);
        color: #16a34a;
      }

      .certificate-box {
        text-align: center;
        padding: 2rem 1.5rem;
        border: 2px dashed var(--border-color, #cbd5e1);
        border-radius: 16px;
        background: var(--bg-surface, #f8fafc);
        margin-top: 1rem;
      }
      .learner-name {
        font-size: 1.8rem;
        color: var(--accent-primary, #6366f1);
        margin: 0.5rem 0;
      }
      .cert-stats {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        margin-top: 1rem;
        font-weight: 600;
      }

      /* Button Interaction Feedback */
      .btn-interactive {
        transition: transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease;
      }
      .btn-interactive:active {
        transform: scale(0.96);
        filter: brightness(0.95);
      }
      .btn-success {
        background: #16a34a;
        color: #ffffff;
      }
      .btn-success:hover {
        background: #15803d;
      }

      /* ────── J.A.R.V.I.S. Theme Customizations ────── */
      .jarvis-mode .tool-title {
        font-family: 'Orbitron', sans-serif !important;
        letter-spacing: 1px;
        background: linear-gradient(135deg, #00c8ff 0%, #00ff88 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: 0 0 12px rgba(0, 200, 255, 0.6);
      }
      .jarvis-mode .tool-subtitle {
        color: #5fb4d8 !important;
      }
      .jarvis-mode .glass-card,
      .jarvis-mode .main-top-card,
      .jarvis-mode .panel {
        background: rgba(0, 20, 40, 0.88) !important;
        border: 1px solid rgba(0, 200, 255, 0.35) !important;
        box-shadow: 0 0 25px rgba(0, 200, 255, 0.15) !important;
        color: #c8eeff !important;
      }
      .jarvis-mode aside.side-nav {
        background: rgba(0, 15, 30, 0.95) !important;
        border-right: 1px solid rgba(0, 200, 255, 0.35) !important;
        box-shadow: 4px 0 20px rgba(0, 200, 255, 0.12) !important;
      }
      .jarvis-mode .library-header-row h2 {
        font-family: 'Orbitron', sans-serif !important;
        color: #c8eeff !important;
        letter-spacing: 0.5px;
      }
      .jarvis-mode .tab-btn {
        background: rgba(0, 20, 40, 0.7) !important;
        color: #5fb4d8 !important;
        border: 1px solid rgba(0, 200, 255, 0.3) !important;
        font-family: 'Orbitron', sans-serif !important;
        font-size: 0.82rem !important;
        letter-spacing: 0.5px;
      }
      .jarvis-mode .tab-btn.active {
        background: linear-gradient(135deg, rgba(0, 200, 255, 0.25) 0%, rgba(0, 100, 200, 0.4) 100%) !important;
        color: #00c8ff !important;
        border-color: #00c8ff !important;
        box-shadow: 0 0 16px rgba(0, 200, 255, 0.45) !important;
      }
      .jarvis-mode input,
      .jarvis-mode select,
      .jarvis-mode textarea {
        background: rgba(0, 15, 30, 0.95) !important;
        border: 1px solid rgba(0, 200, 255, 0.35) !important;
        color: #c8eeff !important;
      }
      .jarvis-mode input::placeholder,
      .jarvis-mode textarea::placeholder {
        color: #2d7a9a !important;
      }
      .jarvis-mode input:focus,
      .jarvis-mode select:focus,
      .jarvis-mode textarea:focus {
        border-color: #00c8ff !important;
        box-shadow: 0 0 12px rgba(0, 200, 255, 0.35) !important;
      }
      .jarvis-mode .score-hero,
      .jarvis-mode .meta-card,
      .jarvis-mode .stat-card,
      .jarvis-mode .feedback-row,
      .jarvis-mode .answer-option-card,
      .jarvis-mode .question-list-card,
      .jarvis-mode .category-block,
      .jarvis-mode .sheet-item,
      .jarvis-mode .options-editor-box,
      .jarvis-mode .timer-strip,
      .jarvis-mode .q-pill,
      .jarvis-mode .certificate-box {
        background: rgba(0, 25, 50, 0.85) !important;
        border: 1px solid rgba(0, 200, 255, 0.28) !important;
        color: #c8eeff !important;
      }
      .jarvis-mode .answer-option-card:hover,
      .jarvis-mode .question-list-card:hover,
      .jarvis-mode .sheet-item:hover {
        border-color: rgba(0, 200, 255, 0.6) !important;
        box-shadow: 0 0 14px rgba(0, 200, 255, 0.22) !important;
      }
      .jarvis-mode .answer-option-card.selected,
      .jarvis-mode .question-list-card.selected,
      .jarvis-mode .sheet-item.active {
        background: rgba(0, 200, 255, 0.18) !important;
        border-color: #00c8ff !important;
        box-shadow: 0 0 16px rgba(0, 200, 255, 0.35) !important;
      }
      .jarvis-mode .summary-pill,
      .jarvis-mode .type-pill,
      .jarvis-mode .tag-pill,
      .jarvis-mode .q-badge,
      .jarvis-mode .badge-pill {
        background: rgba(0, 200, 255, 0.15) !important;
        color: #00c8ff !important;
        border: 1px solid rgba(0, 200, 255, 0.3) !important;
        font-family: 'Orbitron', monospace;
      }
      .jarvis-mode .score-hero .score-val {
        font-family: 'Orbitron', sans-serif !important;
        color: #c8eeff !important;
        text-shadow: 0 0 14px rgba(0, 200, 255, 0.6);
      }
      .jarvis-mode .score-hero .percentage-badge {
        font-family: 'Orbitron', sans-serif !important;
        color: #00c8ff !important;
        text-shadow: 0 0 12px rgba(0, 200, 255, 0.5);
      }
      .jarvis-mode .pass-status-pill.passed {
        background: rgba(0, 255, 136, 0.2) !important;
        border: 1px solid #00ff88 !important;
        color: #00ff88 !important;
        font-family: 'Orbitron', sans-serif !important;
        box-shadow: 0 0 14px rgba(0, 255, 136, 0.35);
      }
      .jarvis-mode .pass-status-pill.failed {
        background: rgba(255, 51, 85, 0.2) !important;
        border: 1px solid #ff3355 !important;
        color: #ff3355 !important;
        font-family: 'Orbitron', sans-serif !important;
        box-shadow: 0 0 14px rgba(255, 51, 85, 0.35);
      }
      .jarvis-mode .timer-display-badge {
        font-family: 'Orbitron', monospace !important;
        color: #00c8ff !important;
        background: rgba(0, 200, 255, 0.18) !important;
        border: 1px solid #00c8ff !important;
        box-shadow: 0 0 14px rgba(0, 200, 255, 0.35) !important;
      }
      .jarvis-mode .learner-name {
        font-family: 'Orbitron', sans-serif !important;
        color: #00c8ff !important;
      }

      /* Animations */
      .spin-hud {
        animation: spinClockwise 12s linear infinite;
        transform-origin: center;
      }
      .core-glow {
        animation: jarvisGlowCore 2s infinite alternate;
      }

      @keyframes spinClockwise {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes jarvisGlowCore {
        from { fill: #00c8ff; filter: drop-shadow(0 0 2px #00c8ff); }
        to { fill: #ffffff; filter: drop-shadow(0 0 8px #00c8ff); }
      }
      @keyframes pulseBorder {
        50% {
          border-color: rgba(239, 68, 68, 0.4);
        }
      }
      @keyframes pulseText {
        50% {
          opacity: 0.5;
        }
      }

      /* Responsive Media Queries */
      @media (max-width: 1024px) {
        .builder-2col-layout {
          grid-template-columns: 1fr;
        }
        .questions-list-col {
          border-right: none;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          padding-right: 0;
          padding-bottom: 1.25rem;
        }
      }

      @media (max-width: 850px) {
        .assessment-page {
          padding: 0 0.75rem 2rem;
        }
        .assessment-layout {
          grid-template-columns: 1fr !important;
        }
        aside.side-nav {
          position: fixed;
          left: 0;
          top: 0;
          width: min(100%, 300px);
          height: 100vh;
          max-height: 100vh;
          z-index: 2000;
          transform: translateX(-120%);
          background: var(--bg-card, #ffffff);
          border-radius: 0;
          border-left: none;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        aside.side-nav.mobile-open {
          transform: translateX(0);
        }
        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 1999;
        }
        .close-nav-mobile {
          display: block;
        }
        .mobile-menu-btn {
          display: inline-flex;
        }
        .expand-library-btn {
          display: none;
        }
        .collapse-btn-desktop {
          display: none;
        }
        .form-grid {
          grid-template-columns: 1fr;
        }
        .span-2 {
          grid-column: span 1;
        }
        .main-top-card {
          flex-direction: column;
          align-items: flex-start;
        }
        .top-card-right {
          width: 100%;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class AssessmentTestComponent {
  service = inject(AssessmentTestService);
  themeService = inject(ThemeService);
  viewMode = signal<'builder' | 'test' | 'results'>('builder');
  libraryCollapsed = signal(false);
  selectedSheetOpen = signal(true);
  questionsEditorOpen = signal(true);
  overviewOpen = signal(true);
  dragOverCategoryId = signal<string | null>(null);
  searchQuery = '';
  expandedCategories = new Set<string>();

  setName = '';
  setDescription = '';
  setTimer: number | null = null;
  durationPreset = 'custom';

  currentQuestion: AssessmentQuestion | null = null;
  correctAnswerText = '';
  questionTypes: QuestionInputType[] = ['radio', 'checkbox', 'textbox', 'textarea', 'mixed'];

  get activeSetName(): string {
    return this.service.activeSet()?.name ?? '';
  }

  get activeSetQuestionCount(): number {
    return this.service.activeSet()?.questions.length ?? 0;
  }

  get activeSetTotalMarks(): number {
    return (
      this.service
        .activeSet()
        ?.questions.reduce((total, question) => total + Number(question.weight || 0), 0) ?? 0
    );
  }

  get answersLocked(): boolean {
    return !this.service.testStarted() || this.service.testSubmitted();
  }

  get attemptLabel(): string {
    if (this.service.testSubmitted()) return 'Submitted';
    if (this.service.testStarted()) return 'In progress';
    if (this.service.lastResult()) return 'Completed';
    return 'Not started';
  }

  get testStartLabel(): string {
    if (this.service.testSubmitted()) return 'Start New Test';
    return this.service.testStarted() ? 'Resume Test' : 'Start Test';
  }

  get timerState(): 'normal' | 'low' | 'critical' {
    const total = this.service.activeSet()?.timerSeconds || 0;
    const remaining = this.service.remainingSeconds();
    if (!total || remaining <= 0) return 'normal';
    if (remaining <= 60 || remaining / total <= 0.1) return 'critical';
    if (remaining <= 300 || remaining / total <= 0.25) return 'low';
    return 'normal';
  }

  constructor() {
    effect(() => {
      this.service.selectedSetId();
      const activeSet = this.service.activeSet();
      if (activeSet) {
        this.setName = activeSet.name;
        this.setDescription = activeSet.description || '';
        this.setTimer = activeSet.timerSeconds || null;
        this.durationPreset = this.durationPresetForSeconds(activeSet.timerSeconds || 0);
        this.currentQuestion = activeSet.questions[0] || null;
        this.correctAnswerText = this.currentQuestion
          ? this.answerTextForQuestion(this.currentQuestion)
          : '';
        if (activeSet.categoryId) {
          this.expandedCategories.add(activeSet.categoryId);
        }
      } else {
        this.setName = '';
        this.setDescription = '';
        this.setTimer = null;
        this.durationPreset = 'custom';
        this.currentQuestion = null;
        this.correctAnswerText = '';
      }
    });

    effect(() => {
      if (this.service.testSubmitted() && this.service.lastResult()) {
        this.viewMode.set('results');
      }
    });
  }

  get filteredCategories(): Category[] {
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

  sheetsForCategory(categoryId: string): QuestionSet[] {
    return this.service.questionSets().filter((set) => set.categoryId === categoryId);
  }

  toggleLibrary(): void {
    this.libraryCollapsed.set(!this.libraryCollapsed());
    this.service.playSound('navigate');
  }

  toggleSideNav(): void {
    this.service.sideNavOpenMobile.set(!this.service.sideNavOpenMobile());
    this.service.playSound('navigate');
  }

  closeMobileLibrary(): void {
    this.service.sideNavOpenMobile.set(false);
  }

  switchViewMode(mode: 'builder' | 'test' | 'results'): void {
    this.viewMode.set(mode);
    this.service.playSound('navigate');
  }

  addSheetToCategory(categoryId: string): void {
    this.service.selectedCategoryId.set(categoryId);
    this.createQuestionSet();
    this.expandedCategories.add(categoryId);
  }

  applyDurationPreset(value: string): void {
    if (value === 'custom') return;
    this.setTimer = Number(value);
  }

  durationPresetForSeconds(seconds: number): string {
    const value = String(seconds);
    return ['600', '1200', '1800', '2700', '3600'].includes(value) ? value : 'custom';
  }

  formatSeconds(seconds: number): string {
    const total = Math.max(0, Math.round(seconds || 0));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  onSheetDragStart(event: DragEvent, sheetId: string): void {
    event.dataTransfer?.setData('text/plain', sheetId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onCategoryDragOver(event: DragEvent, categoryId: string): void {
    event.preventDefault();
    this.dragOverCategoryId.set(categoryId);
  }

  onCategoryDragLeave(categoryId: string): void {
    if (this.dragOverCategoryId() === categoryId) {
      this.dragOverCategoryId.set(null);
    }
  }

  onSheetDrop(event: DragEvent, categoryId: string): void {
    event.preventDefault();
    const sheetId = event.dataTransfer?.getData('text/plain');
    this.dragOverCategoryId.set(null);
    if (!sheetId) return;
    const sheet = this.service.questionSets().find((item) => item.id === sheetId);
    if (!sheet || sheet.categoryId === categoryId) return;
    this.service.moveQuestionSetToCategory(sheetId, categoryId);
    this.expandedCategories.add(categoryId);
    this.service.playSound('action');
  }

  onSheetDragEnd(): void {
    this.dragOverCategoryId.set(null);
  }

  toggleCategory(categoryId: string): void {
    if (this.expandedCategories.has(categoryId)) {
      this.expandedCategories.delete(categoryId);
    } else {
      this.expandedCategories.add(categoryId);
    }
    this.service.playSound('navigate');
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
    this.service.playSound('click');
  }

  createCategory(): void {
    const name = window.prompt('New category name');
    if (name) {
      this.service.createCategory(name);
      if (this.service.selectedCategoryId()) {
        this.expandedCategories.add(this.service.selectedCategoryId()!);
      }
      this.service.playSound('action');
    }
  }

  editCategory(category: Category): void {
    const name = window.prompt('Category name', category.name);
    const description = window.prompt('Category description', category.description || '');
    if (name) {
      this.service.updateCategory(category.id, name, description || '');
      this.service.playSound('action');
    }
  }

  deleteCategory(categoryId: string): void {
    if (confirm('Delete this category and all its sheets?')) {
      this.service.deleteCategory(categoryId);
      this.service.playSound('action');
    }
  }

  createQuestionSet(): void {
    const name = window.prompt('New sheet name');
    if (!name) return;
    const description = window.prompt('Sheet description', '') || '';
    this.service.createQuestionSet(name, description, 600);
    const activeSet = this.service.activeSet();
    if (activeSet) {
      this.setName = activeSet.name;
      this.setDescription = activeSet.description || '';
      this.setTimer = activeSet.timerSeconds || null;
    }
    this.service.playSound('action');
  }

  saveSet(): void {
    if (!this.service.selectedSetId()) return;
    this.service.updateQuestionSet(
      this.service.selectedSetId()!,
      this.setName || 'Untitled',
      this.setDescription,
      this.setTimer || undefined,
    );
    this.service.playSound('action');
  }

  addNewQuestion(): void {
    this.service.addQuestion();
    const activeSet = this.service.activeSet();
    if (activeSet) {
      this.currentQuestion = activeSet.questions[activeSet.questions.length - 1];
      this.correctAnswerText = this.answerTextForQuestion(this.currentQuestion);
    }
    this.service.playSound('action');
  }

  selectQuestion(question: AssessmentQuestion): void {
    const selectedQuestion = structuredClone(question);
    this.currentQuestion = selectedQuestion;
    this.correctAnswerText = this.answerTextForQuestion(selectedQuestion);
    this.service.playSound('click');
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
    this.service.playSound('action');
  }

  removeOption(index: number): void {
    if (!this.currentQuestion?.options) return;
    const options = [...this.currentQuestion.options];
    options.splice(index, 1);
    this.currentQuestion.options = options;
    this.service.playSound('action');
  }

  saveQuestion(): void {
    if (!this.currentQuestion || !this.service.selectedSetId()) return;
    const question = {
      ...this.currentQuestion,
      correctAnswers: this.parseCorrectAnswers(this.correctAnswerText),
    };
    this.service.saveQuestion(this.service.selectedSetId()!, question);
    this.currentQuestion = question;
    this.service.playSound('action');
  }

  duplicateQuestion(): void {
    if (!this.currentQuestion || !this.service.selectedSetId()) return;
    this.service.duplicateQuestion(this.service.selectedSetId()!, this.currentQuestion.id);
    this.service.playSound('action');
  }

  removeQuestion(): void {
    if (!this.currentQuestion || !this.service.selectedSetId()) return;
    if (confirm('Delete this question?')) {
      this.service.removeQuestion(this.service.selectedSetId()!, this.currentQuestion.id);
      this.currentQuestion = this.service.activeSet()?.questions[0] || null;
      this.service.playSound('action');
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
    this.service.startOrResumeAssessment();
    this.viewMode.set('test');
    this.service.playSound('start');
  }

  submitAndShowResults(): void {
    this.service.submitAssessment(false);
    this.viewMode.set('results');
    this.service.playSound('submit');
  }

  previewCertificate(): void {
    if (!this.service.lastResult()) {
      alert('Submit the assessment first to preview the certificate.');
      return;
    }
    const name = window.prompt('Enter your name for the certificate', 'Learner');
    if (name) {
      this.service.generateCertificate(name);
      this.service.playSound('action');
    }
  }

  downloadCertificate(): void {
    const name =
      this.service.certificatePreview()?.userName ||
      window.prompt('Enter your name for the certificate', 'Learner');
    if (name) {
      this.service.downloadCertificatePdf(name);
      this.service.playSound('action');
    }
  }

  handleImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.service.importFromExcel(file);
    input.value = '';
    this.service.playSound('action');
  }

  exportToExcel(): void {
    this.service.exportToExcel();
    this.service.playSound('action');
  }

  syncToCloud(): void {
    this.service.syncToFirebase();
    this.service.playSound('action');
  }
}
