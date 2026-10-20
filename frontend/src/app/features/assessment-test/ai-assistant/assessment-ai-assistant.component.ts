import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  AssessmentAiService,
  AssessmentChatSession,
  GeneratedQuestion,
  GeneratedQuestionSet,
  AiModel,
  QuestionDifficulty,
  DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS,
} from './assessment-ai.service';
import {
  AssessmentTestService,
  Category,
  QuestionSet,
} from '../assessment-test.service';
import { ThemeService } from '../../../core/services/theme.service';

type MainTab = 'chat' | 'review' | 'json';
type HistoryGroup = { label: string; sessions: AssessmentChatSession[] };

@Component({
  selector: 'app-assessment-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    <div class="ai-assistant-shell" [class.sidebar-expanded]="chatSidebarOpen" [class.jarvis-mode]="themeSvc.isJarvis()">
      <!-- ==================== LEFT CHAT SIDEBAR ==================== -->
      <aside class="chat-sidebar" [class.open]="chatSidebarOpen">
        <!-- New Chat Button -->
        <button class="new-chat-btn" (click)="newChat()" id="ai-as-new-chat-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New Chat</span>
        </button>

        <!-- Search -->
        <div class="sidebar-search">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearch()"
            class="search-input"
            id="ai-as-search-input"
          />
        </div>

        <!-- Session List -->
        <div class="session-list">
          <!-- Pinned -->
          <ng-container *ngIf="pinnedSessions.length > 0">
            <div class="session-group-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
              Pinned
            </div>
            <div class="session-item" *ngFor="let s of pinnedSessions"
              [class.active]="s.id === aiSvc.activeSessionId()"
              (click)="selectSession(s.id)"
              id="as-session-{{s.id}}">
              <svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div class="session-info">
                <span class="session-title" *ngIf="!isRenaming(s.id)">{{ s.title }}</span>
                <input *ngIf="isRenaming(s.id)" class="rename-input" [value]="s.title"
                  (blur)="finishRename($event, s.id)" (keydown.enter)="finishRename($event, s.id)"
                  autofocus />
                <span class="session-date">{{ formatSessionDate(s.updatedAt) }}</span>
                <span class="session-tokens" *ngIf="aiSvc.getSessionTotalTokens(s) > 0">{{ formatSessionTokens(s) }}</span>
              </div>
              <div class="session-actions" (click)="$event.stopPropagation()">
                <button class="session-action-btn" (click)="aiSvc.togglePin(s.id)" title="Unpin">📌</button>
                <button class="session-action-btn" (click)="startRename(s.id)" title="Rename">✏️</button>
                <button class="session-action-btn danger" (click)="confirmDelete(s.id)" title="Delete">🗑️</button>
              </div>
            </div>
          </ng-container>

          <!-- History Groups -->
          <ng-container *ngFor="let group of historyGroups">
            <div class="session-group-label" *ngIf="group.sessions.length > 0">{{ group.label }}</div>
            <div class="session-item" *ngFor="let s of group.sessions"
              [class.active]="s.id === aiSvc.activeSessionId()"
              (click)="selectSession(s.id)"
              id="as-session-{{s.id}}">
              <svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div class="session-info">
                <span class="session-title" *ngIf="!isRenaming(s.id)">{{ s.title }}</span>
                <input *ngIf="isRenaming(s.id)" class="rename-input" [value]="s.title"
                  (blur)="finishRename($event, s.id)" (keydown.enter)="finishRename($event, s.id)"
                  autofocus />
                <span class="session-date">{{ formatSessionDate(s.updatedAt) }}</span>
                <span class="session-tokens" *ngIf="aiSvc.getSessionTotalTokens(s) > 0">{{ formatSessionTokens(s) }}</span>
              </div>
              <div class="session-actions" (click)="$event.stopPropagation()">
                <button class="session-action-btn" (click)="aiSvc.togglePin(s.id)" title="Pin">📌</button>
                <button class="session-action-btn" (click)="startRename(s.id)" title="Rename">✏️</button>
                <button class="session-action-btn danger" (click)="confirmDelete(s.id)" title="Delete">🗑️</button>
              </div>
            </div>
          </ng-container>

          <div class="empty-history" *ngIf="sessions.length === 0">
            <p>No conversations yet.</p>
            <p>Start a new chat!</p>
          </div>
        </div>

        <!-- Sidebar Footer Clear Action -->
        <div class="sidebar-footer" *ngIf="sessions.length > 0">
          <button class="clear-all-history-btn" (click)="confirmClearAllHistory()" id="ai-as-clear-all-btn" title="Clear all chat history and generated questions">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span *ngIf="chatSidebarOpen">Clear All History</span>
          </button>
        </div>

        <!-- Collapse Toggle -->
        <button class="sidebar-collapse-btn" (click)="chatSidebarOpen = !chatSidebarOpen" title="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline *ngIf="chatSidebarOpen" points="15 18 9 12 15 6"/>
            <polyline *ngIf="!chatSidebarOpen" points="9 18 15 12 9 6"/>
          </svg>
          <span *ngIf="chatSidebarOpen">Collapse</span>
        </button>
      </aside>

      <!-- ==================== MAIN CONTENT ==================== -->
      <div class="main-content">
        <!-- Page Header -->
        <div class="page-header">
          <div class="header-left">
            <button class="hamburger-sidebar-btn" (click)="chatSidebarOpen = !chatSidebarOpen" *ngIf="!chatSidebarOpen" title="Expand Sidebar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div class="page-title">
              <div class="title-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div>
                <h1>AI Assessment Assistant</h1>
                <p>Generate high-quality multiple choice question sets from study materials (PDF, Word, Text) or directly for certifications and skills.</p>
              </div>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn-header" (click)="showHowItWorks = !showHowItWorks" id="ai-as-how-it-works-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              How it works?
            </button>
            <button class="btn-header btn-settings" (click)="showSettings = true" id="ai-as-settings-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83-2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
            <button class="btn-header btn-danger-header" (click)="confirmClearAllHistory()" id="ai-as-header-clear-btn" title="Clear all chat history and generated questions">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear All History
            </button>
          </div>
        </div>

        <!-- Success Toast Notification -->
        <div class="toast-banner success" *ngIf="actionSuccessMsg">
          <span>✓ {{ actionSuccessMsg }}</span>
          <button class="toast-close" (click)="actionSuccessMsg = ''">✕</button>
        </div>

        <!-- Tab Bar -->
        <div class="tab-bar-row">
          <div class="tab-bar">
            <button class="tab-btn" [class.active]="activeTab === 'chat'" (click)="activeTab = 'chat'" id="ai-as-tab-chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat & Generate
            </button>
            <button class="tab-btn" [class.active]="activeTab === 'review'" (click)="openReviewTab()" id="ai-as-tab-review">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              Review Questions
              <span class="tab-badge" *ngIf="generatedQuestions.length > 0">{{ generatedQuestions.length }}</span>
            </button>
            <button class="tab-btn" [class.active]="activeTab === 'json'" (click)="openJsonTab()" id="ai-as-tab-json">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Generated JSON
            </button>
          </div>
          <div class="tab-bar-tools">
            <!-- Model selector -->
            <div class="model-selector" *ngIf="activeTab === 'chat'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/>
              </svg>
              <select [(ngModel)]="selectedModel" (ngModelChange)="saveModelSelection()" class="model-select" id="ai-as-model-select">
                <optgroup label="Azure AI Foundry (Backend Default)">
                  <option value="gpt-5.6-luna">gpt-5.6-luna (Foundry)</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </optgroup>
                <optgroup label="Google Gemini">
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </optgroup>
                <optgroup label="Anthropic Claude">
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                </optgroup>
              </select>
            </div>
            <!-- API Key indicator -->
            <div class="api-key-indicator" [class.configured]="hasApiKey" (click)="showSettings = true" title="AI Service Status">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              <span>{{ hasApiKey ? (aiSvc.config().provider === 'foundry' && !aiSvc.config().apiKey ? 'Backend Key ✓' : 'API Key ✓') : 'API Key' }}</span>
            </div>
            <!-- Cumulative tokens -->
            <div class="chat-tokens-indicator" *ngIf="activeTab === 'chat' && currentSession && aiSvc.getSessionTotalTokens(currentSession) > 0" title="Cumulative tokens used in this conversation">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
              {{ currentChatTokensText }}
            </div>
          </div>
        </div>

        <!-- ==================== TAB 1: CHAT & GENERATION ==================== -->
        <div class="tab-content" *ngIf="activeTab === 'chat'">
          <!-- Direct Exam Question Generation Shortcut Bar -->
          <div class="direct-generator-bar glass-card">
            <div class="direct-bar-title">
              <span class="lightning-icon">⚡</span>
              <strong>Direct Exam Question Generator</strong>
              <span class="direct-bar-sub">Quickly create question sets by topic, difficulty, & count</span>
            </div>
            <div class="direct-bar-form">
              <div class="form-field topic-field">
                <input
                  type="text"
                  [(ngModel)]="directTopic"
                  placeholder="Exam / Topic (e.g. Microsoft Azure AI-900 or Python Expert)"
                  (keydown.enter)="generateDirectQuestions()"
                  id="ai-direct-topic-input"
                />
              </div>
              <div class="form-field select-field">
                <select [(ngModel)]="directDifficulty" id="ai-direct-diff-select">
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <div class="form-field select-field-sm">
                <select [(ngModel)]="directCount" id="ai-direct-count-select">
                  <option [ngValue]="5">5 Questions</option>
                  <option [ngValue]="10">10 Questions</option>
                  <option [ngValue]="15">15 Questions</option>
                  <option [ngValue]="20">20 Questions</option>
                </select>
              </div>
              <button
                class="btn-direct-generate"
                (click)="generateDirectQuestions()"
                [disabled]="!directTopic.trim() || aiSvc.isProcessing()"
                id="ai-direct-generate-btn"
              >
                <span>⚡ Generate</span>
              </button>
            </div>
          </div>

          <div class="chat-area" #chatArea>
            <!-- Empty State -->
            <div class="chat-empty" *ngIf="!currentSession || currentSession.messages.length === 0">
              <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <h3>Generate Certification & Skill Assessments</h3>
              <p>Upload your study materials (PDF, Word, Text, Notes) or prompt directly to generate structured multiple-choice questions with full explanations, ready to be reviewed and inserted into Assessment Test.</p>
              
              <div class="example-prompts">
                <button class="example-prompt" (click)="useExamplePrompt('azure')" id="ai-ex-azure">
                  ☁️ Azure AI-900 Certification
                </button>
                <button class="example-prompt" (click)="useExamplePrompt('python')" id="ai-ex-python">
                  🐍 Expert Python Assessment
                </button>
                <button class="example-prompt" (click)="useExamplePrompt('aws')" id="ai-ex-aws">
                  🌐 AWS Cloud Practitioner
                </button>
                <button class="example-prompt" (click)="useExamplePrompt('k8s')" id="ai-ex-k8s">
                  🐳 Docker & Kubernetes
                </button>
                <button class="example-prompt" (click)="useExamplePrompt('angular')" id="ai-ex-angular">
                  ⚡ Angular 21 Architecture
                </button>
              </div>
            </div>

            <!-- Messages Stream -->
            <div class="messages" *ngIf="currentSession && currentSession.messages.length > 0">
              <div class="message" *ngFor="let msg of currentSession.messages"
                [class.user-message]="msg.role === 'user'"
                [class.assistant-message]="msg.role === 'assistant'">

                <div class="msg-avatar" *ngIf="msg.role === 'assistant'">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                    <path d="M12 8v4l3 3"/>
                  </svg>
                </div>

                <div class="msg-bubble">
                  <div class="msg-attachment" *ngIf="msg.attachmentName">
                    📎 Attached Study Material: <strong>{{ msg.attachmentName }}</strong>
                  </div>
                  <div class="msg-content" [innerHTML]="formatMessage(msg.content)"></div>

                  <!-- Question Set Summary Card -->
                  <div class="extraction-summary-card" *ngIf="msg.questionSetSummary">
                    <div class="summary-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                      Assessment Question Set Ready
                    </div>
                    <div class="summary-details">
                      <div class="summary-meta-item">
                        <span class="meta-label">Sheet:</span>
                        <strong class="meta-value">{{ msg.questionSetSummary.setName }}</strong>
                      </div>
                      <div class="summary-meta-item">
                        <span class="meta-label">Category:</span>
                        <span class="meta-value">{{ msg.questionSetSummary.categoryName }}</span>
                      </div>
                      <div class="summary-meta-item">
                        <span class="meta-label">Questions:</span>
                        <span class="badge-count">{{ msg.questionSetSummary.totalQuestions }} MCQs</span>
                      </div>
                      <div class="summary-meta-item">
                        <span class="meta-label">Difficulty:</span>
                        <span class="badge-diff">{{ msg.questionSetSummary.difficulty }}</span>
                      </div>
                    </div>
                    <button class="view-extracted-btn" (click)="openReviewTab()">
                      Review & Approve Questions →
                    </button>
                  </div>

                  <!-- Message footer -->
                  <div class="msg-footer">
                    <span class="msg-time">{{ formatTime(msg.timestamp) }}</span>
                    <span class="msg-tokens" *ngIf="!msg.tokensUnavailable && msg.tokens !== undefined">
                      {{ msg.role === 'user' ? '📥' : '📤' }} {{ msg.tokens | number }} {{ msg.role === 'user' ? 'input' : 'output' }} tokens
                    </span>
                    <span class="msg-tokens unavailable" *ngIf="msg.tokensUnavailable">Token usage unavailable</span>
                    <button class="msg-copy-btn" (click)="copyMessageContent(msg.id, msg.content)" [id]="'copy-msg-' + msg.id" title="Copy message">
                      {{ copiedMessageIds.has(msg.id) ? '✓ Copied' : '⎘ Copy' }}
                    </button>
                  </div>
                </div>

                <div class="msg-avatar user-avatar" *ngIf="msg.role === 'user'">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              </div>

              <!-- Loading indicator -->
              <div class="message assistant-message" *ngIf="aiSvc.isProcessing()">
                <div class="msg-avatar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                    <path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div class="msg-bubble">
                  <div class="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                  <span class="generating-text">Analyzing material & generating assessment questions...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Banner -->
          <div class="error-banner" *ngIf="aiSvc.error()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {{ aiSvc.error() }}
            <button (click)="aiSvc.error.set(null)">✕</button>
          </div>

          <!-- File Attachment Status Preview -->
          <div class="attachment-preview-strip" *ngIf="currentAttachment">
            <div class="att-info">
              <span class="att-icon">📄</span>
              <span class="att-name">{{ currentAttachment.fileName }}</span>
              <span class="att-type">({{ currentAttachment.fileType }}, {{ currentAttachment.content.length | number }} chars)</span>
            </div>
            <button class="att-remove" (click)="clearAttachment()" title="Remove attached file">✕</button>
          </div>

          <!-- Input Area -->
          <div class="input-area">
            <div class="input-wrapper">
              <textarea
                #msgInput
                [(ngModel)]="messageText"
                placeholder="Type your exam request (e.g., 'Create 10 expert Python questions' or paste syllabus / study notes)..."
                (keydown)="onKeydown($event)"
                rows="3"
                class="message-input"
                id="ai-as-message-input"
              ></textarea>
              <div class="input-actions">
                <label class="attach-btn" title="Upload study material: PDF, Word (.docx), Text, Markdown, Excel (.xlsx)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  <input
                    type="file"
                    (change)="onFileSelected($event)"
                    hidden
                    accept=".pdf,.docx,.txt,.md,.json,.csv,.xlsx,.xls"
                    id="ai-as-file-input"
                  />
                </label>
                <button
                  class="send-btn"
                  (click)="sendMessage()"
                  [disabled]="(!messageText.trim() && !currentAttachment) || aiSvc.isProcessing()"
                  id="ai-as-send-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 2: REVIEW QUESTIONS ==================== -->
        <div class="tab-content review-tab" *ngIf="activeTab === 'review'">
          <!-- Header Bar with Target Sheet Selection and Bulk Actions -->
          <div class="review-header glass-card">
            <div class="review-header-top">
              <div class="review-stats">
                <h3>Question Review & Approval</h3>
                <div class="stats-pills">
                  <span class="stat-pill total">{{ generatedQuestions.length }} Total</span>
                  <span class="stat-pill pending">{{ pendingQuestions.length }} Pending</span>
                  <span class="stat-pill approved">{{ approvedQuestions.length }} Approved</span>
                  <span class="stat-pill rejected" *ngIf="rejectedQuestions.length > 0">{{ rejectedQuestions.length }} Rejected</span>
                  <span class="stat-pill applied" *ngIf="appliedQuestions.length > 0">{{ appliedQuestions.length }} Inserted</span>
                </div>
              </div>

              <div class="review-top-actions">
                <button class="btn-review-action" (click)="selectAllQuestions()" title="Select All">
                  ✓ Select All
                </button>
                <button class="btn-review-action btn-approve-all" (click)="approveAllQuestions()" title="Approve All">
                  ✓✓ Approve All
                </button>
                <button
                  class="btn-insert-assessment"
                  (click)="insertApprovedIntoAssessment()"
                  [disabled]="isInserting || (insertableQuestions.length === 0 && appliedQuestions.length > 0) || generatedQuestions.length === 0"
                  id="ai-insert-approved-btn"
                  title="Insert questions into Assessment Test Question Library"
                >
                  <span *ngIf="isInserting">⏳ Inserting Questions...</span>
                  <span *ngIf="!isInserting && insertableQuestions.length > 0">
                    📥 Insert {{ approvedQuestions.length > 0 ? 'Approved' : 'Generated' }} Questions into Assessment Test ({{ insertableQuestions.length }})
                  </span>
                  <span *ngIf="!isInserting && insertableQuestions.length === 0 && appliedQuestions.length > 0">
                    ✓ All Questions Inserted ({{ appliedQuestions.length }})
                  </span>
                  <span *ngIf="!isInserting && insertableQuestions.length === 0 && appliedQuestions.length === 0">
                    📥 Insert into Assessment Test (0)
                  </span>
                </button>
              </div>
            </div>

            <!-- Target Sheet & Category Configuration -->
            <div class="target-config-grid">
              <div class="config-col">
                <label>Target Question Sheet</label>
                <select [(ngModel)]="targetSetChoice" class="config-select" id="ai-target-set-select">
                  <option value="__NEW__">➕ [Create New Sheet: {{ targetNewSetName }}]</option>
                  <optgroup label="Existing Sheets in Question Library">
                    <option *ngFor="let s of assessmentSvc.questionSets()" [value]="s.id">
                      {{ s.name }} ({{ s.questions.length }} qns)
                    </option>
                  </optgroup>
                </select>
              </div>

              <div class="config-col" *ngIf="targetSetChoice === '__NEW__'">
                <label>New Sheet Title</label>
                <input type="text" [(ngModel)]="targetNewSetName" class="config-input" placeholder="Sheet title" />
              </div>

              <div class="config-col">
                <label>Target Category</label>
                <select [(ngModel)]="targetCategoryChoice" class="config-select" id="ai-target-cat-select">
                  <option value="__NEW__">➕ [Create New Category: {{ targetNewCatName }}]</option>
                  <optgroup label="Existing Categories">
                    <option *ngFor="let c of assessmentSvc.categories()" [value]="c.id">
                      {{ c.name }}
                    </option>
                  </optgroup>
                </select>
              </div>

              <div class="config-col" *ngIf="targetCategoryChoice === '__NEW__'">
                <label>New Category Name</label>
                <input type="text" [(ngModel)]="targetNewCatName" class="config-input" placeholder="Category name" />
              </div>

              <div class="config-col filter-col">
                <label>Filter Difficulty</label>
                <select [(ngModel)]="difficultyFilter" class="config-select">
                  <option value="">All Difficulties</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Empty Questions State -->
          <div class="review-empty glass-card" *ngIf="generatedQuestions.length === 0">
            <div class="empty-icon">📝</div>
            <h3>No Generated Questions in Current Session</h3>
            <p>Upload a PDF, Word document, text file, or use the Direct Generator on the Chat tab to generate questions.</p>
            <button class="btn-go-chat" (click)="activeTab = 'chat'">← Back to Chat & Generator</button>
          </div>

          <!-- Question Cards List -->
          <div class="question-cards-list" *ngIf="filteredQuestions.length > 0">
            <div
              class="q-review-card glass-card"
              *ngFor="let q of filteredQuestions; let idx = index"
              [class.status-approved]="q.status === 'approved'"
              [class.status-rejected]="q.status === 'rejected'"
              [class.status-applied]="q.status === 'applied'"
              [class.has-duplicate]="q.isDuplicate"
              id="q-card-{{q.id}}"
            >
              <!-- Card Header -->
              <div class="q-card-header">
                <div class="q-header-left">
                  <span class="q-index-pill">#{{ idx + 1 }}</span>
                  <span class="badge-type">{{ q.type === 'radio' ? 'Single Choice' : 'Multiple Choice' }}</span>
                  <span class="badge-difficulty" [attr.data-diff]="q.difficulty">{{ q.difficulty }}</span>
                  <span class="badge-category">{{ q.category }}</span>
                  <span class="badge-weight">{{ q.weight }} Mark{{ q.weight === 1 ? '' : 's' }}</span>
                  <span class="badge-status-applied" *ngIf="q.status === 'applied'">✓ Saved</span>
                </div>

                <div class="q-header-actions">
                  <span class="badge-status-applied-pill" *ngIf="q.status === 'applied'">✓ Inserted</span>
                  <button
                    *ngIf="q.status !== 'applied'"
                    class="btn-status-toggle approve"
                    [class.active]="q.status === 'approved'"
                    (click)="toggleApproveQuestion(q)"
                    title="Approve Question"
                  >
                    ✓ {{ q.status === 'approved' ? 'Approved' : 'Approve' }}
                  </button>
                  <button
                    *ngIf="q.status !== 'applied'"
                    class="btn-status-toggle reject"
                    [class.active]="q.status === 'rejected'"
                    (click)="toggleRejectQuestion(q)"
                    title="Reject / Exclude Question"
                  >
                    ✕ {{ q.status === 'rejected' ? 'Rejected' : 'Reject' }}
                  </button>
                  <button
                    class="btn-icon-delete"
                    (click)="deleteQuestion(q.id)"
                    title="Delete permanently from session"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Duplicate Warning Banner -->
              <div class="duplicate-alert" *ngIf="q.isDuplicate">
                <span class="alert-icon">⚠️</span>
                <span><strong>Possible Duplicate:</strong> {{ q.duplicateReason }}</span>
              </div>

              <!-- Validation Error Banner -->
              <div class="validation-alert" *ngIf="q.validationErrors && q.validationErrors.length > 0">
                <span class="alert-icon">⚠️</span>
                <div>
                  <div *ngFor="let err of q.validationErrors">• {{ err }}</div>
                </div>
              </div>

              <!-- Question Title & Description -->
              <div class="q-body">
                <div class="field-label-row">
                  <label>Question Text</label>
                  <button class="btn-mini-action" (click)="q.edited = true" *ngIf="!q.edited">✏️ Edit</button>
                </div>
                <textarea
                  [(ngModel)]="q.title"
                  (ngModelChange)="onQuestionEdited(q)"
                  class="q-title-input"
                  rows="2"
                  placeholder="Enter question text..."
                ></textarea>

                <div class="field-label-row" *ngIf="q.description || q.edited">
                  <label>Scenario / Instructions (Optional)</label>
                </div>
                <input
                  *ngIf="q.description || q.edited"
                  type="text"
                  [(ngModel)]="q.description"
                  (ngModelChange)="onQuestionEdited(q)"
                  class="q-desc-input"
                  placeholder="Additional scenario or context..."
                />

                <!-- Options List -->
                <div class="options-block">
                  <div class="options-title-row">
                    <strong>Options (Click radio / checkbox to set correct answer)</strong>
                    <button class="btn-mini-add-opt" (click)="addOption(q)">➕ Add Option</button>
                  </div>

                  <div class="options-items">
                    <div
                      class="option-row"
                      *ngFor="let opt of q.options; let oIdx = index"
                      [class.is-correct]="isOptionCorrect(q, opt)"
                    >
                      <!-- Radio / Checkbox selector for correct answer -->
                      <div class="opt-selector" (click)="setOptionCorrect(q, opt)">
                        <input
                          *ngIf="q.type === 'radio'"
                          type="radio"
                          [name]="'correct-' + q.id"
                          [checked]="isOptionCorrect(q, opt)"
                          (change)="setOptionCorrect(q, opt)"
                        />
                        <input
                          *ngIf="q.type === 'checkbox'"
                          type="checkbox"
                          [checked]="isOptionCorrect(q, opt)"
                          (change)="setOptionCorrect(q, opt)"
                        />
                        <span class="opt-letter">{{ getOptionLetter(oIdx) }}.</span>
                      </div>

                      <!-- Option Text Input -->
                      <input
                        type="text"
                        [(ngModel)]="opt.label"
                        (ngModelChange)="onOptionLabelChange(q, opt)"
                        class="opt-input"
                        placeholder="Option label"
                      />

                      <!-- Correct Indicator Tag -->
                      <span class="correct-badge-pill" *ngIf="isOptionCorrect(q, opt)">
                        ✓ Correct Answer
                      </span>

                      <!-- Delete Option button -->
                      <button
                        class="btn-delete-opt"
                        *ngIf="q.options.length > 2"
                        (click)="removeOption(q, oIdx)"
                        title="Remove option"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Explanation / Reason for Correct Answer -->
                <div class="explanation-block">
                  <label class="field-label">Explanation & Why This Answer is Correct</label>
                  <textarea
                    [(ngModel)]="q.correctAnswerReason"
                    (ngModelChange)="onQuestionEdited(q)"
                    class="explanation-input"
                    rows="2"
                    placeholder="Provide educational explanation why this option is correct..."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 3: GENERATED JSON ==================== -->
        <div class="tab-content json-tab" *ngIf="activeTab === 'json'">
          <div class="json-header glass-card">
            <div class="json-header-left">
              <h3>Raw Generated Question Set JSON</h3>
              <p>Directly inspect, edit, or copy the generated structured assessment JSON schema.</p>
            </div>
            <div class="json-actions">
              <button class="btn-json-action" (click)="formatJsonText()" title="Format JSON">
                <span>🪄 Format</span>
              </button>
              <button class="btn-json-action" (click)="copyJsonText()" title="Copy JSON">
                <span>{{ jsonCopySuccess ? '✓ Copied' : '⎘ Copy' }}</span>
              </button>
              <button class="btn-json-action btn-json-apply" (click)="applyJsonEdits()" title="Parse & Update Questions">
                <span>✓ Apply & Update Questions</span>
              </button>
            </div>
          </div>

          <div class="json-error-banner" *ngIf="jsonError">
            <span>⚠️ {{ jsonError }}</span>
          </div>

          <div class="json-editor-container">
            <textarea
              [(ngModel)]="rawJsonText"
              class="json-editor"
              rows="24"
              spellcheck="false"
              placeholder="Paste or edit questions JSON here..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- ==================== SETTINGS MODAL ==================== -->
      <div class="modal-backdrop" *ngIf="showSettings" (click)="showSettings = false">
        <div class="modal-dialog glass-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>AI Provider & Assistant Settings</h3>
            <button class="modal-close" (click)="showSettings = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>AI Provider</label>
              <select [(ngModel)]="settingsConfig.provider" (ngModelChange)="onProviderChange()" class="modal-select">
                <option value="foundry">Azure AI Foundry (Backend Service Default)</option>
                <option value="openai">OpenAI (Direct API)</option>
                <option value="gemini">Google Gemini (Direct API)</option>
                <option value="anthropic">Anthropic Claude (Direct API)</option>
              </select>
              <small class="field-hint" *ngIf="settingsConfig.provider === 'foundry'">
                Uses the U2Tools Python backend service with Azure Foundry. No client API key required.
              </small>
            </div>

            <div class="form-group">
              <label>Model</label>
              <select [(ngModel)]="settingsConfig.model" class="modal-select">
                <optgroup label="Azure AI Foundry" *ngIf="settingsConfig.provider === 'foundry'">
                  <option value="gpt-5.6-luna">gpt-5.6-luna (Foundry)</option>
                </optgroup>
                <optgroup label="OpenAI" *ngIf="settingsConfig.provider === 'openai'">
                  <option value="gpt-4o">GPT-4o (Recommended)</option>
                  <option value="gpt-4o-mini">GPT-4o mini (Fast)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </optgroup>
                <optgroup label="Google Gemini" *ngIf="settingsConfig.provider === 'gemini'">
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </optgroup>
                <optgroup label="Anthropic" *ngIf="settingsConfig.provider === 'anthropic'">
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                </optgroup>
              </select>
            </div>

            <div class="form-group">
              <label>API Key (Optional for Foundry, Required for Direct API)</label>
              <div class="password-wrapper">
                <input
                  [type]="showApiKey ? 'text' : 'password'"
                  [(ngModel)]="settingsConfig.apiKey"
                  class="modal-input"
                  placeholder="Enter API Key (sk-... or AIza...)"
                />
                <button type="button" class="btn-toggle-eye" (click)="showApiKey = !showApiKey">
                  {{ showApiKey ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>System Instructions (Assessment Generator)</label>
              <textarea
                [(ngModel)]="settingsConfig.systemInstructions"
                rows="6"
                class="modal-textarea"
              ></textarea>
              <button class="btn-reset-inst" (click)="resetSystemInstructions()">Reset to Default Instructions</button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="showSettings = false">Cancel</button>
            <button class="btn-primary" (click)="saveSettings()">Save Settings</button>
          </div>
        </div>
      </div>

      <!-- ==================== HOW IT WORKS MODAL ==================== -->
      <div class="modal-backdrop" *ngIf="showHowItWorks" (click)="showHowItWorks = false">
        <div class="modal-dialog glass-card how-it-works-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>How AI Assessment Assistant Works</h3>
            <button class="modal-close" (click)="showHowItWorks = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="how-step">
              <div class="step-num">1</div>
              <div class="step-content">
                <h4>Study Material Input (PDF, Word, Text)</h4>
                <p>Click the 📎 paperclip button to attach PDF, Word (.docx), Markdown, or plain text files. The assistant automatically extracts the contents so you don't have to copy-paste.</p>
              </div>
            </div>

            <div class="how-step">
              <div class="step-num">2</div>
              <div class="step-content">
                <h4>Direct Certification & Exam Generation</h4>
                <p>Use the Quick Generator bar or chat prompts like <em>"Create an expert-level Python question set"</em> or <em>"Create an Azure AI-900 practice test"</em>. The AI will generate realistic exam questions with multiple options and detailed explanations.</p>
              </div>
            </div>

            <div class="how-step">
              <div class="step-num">3</div>
              <div class="step-content">
                <h4>Review, Edit & Detect Duplicates</h4>
                <p>Switch to the <strong>Review Questions</strong> tab. Edit questions, change options, toggle correct answers, and view duplicate warnings before saving anything.</p>
              </div>
            </div>

            <div class="how-step">
              <div class="step-num">4</div>
              <div class="step-content">
                <h4>Seamless Assessment Integration</h4>
                <p>Click <strong>"Insert Approved into Assessment Test"</strong>. Your questions are saved directly into the Question Library. You can take tests with timers, automatic scoring, and certificate downloads.</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" (click)="showHowItWorks = false">Got it!</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        width: 100%;
      }

      .ai-assistant-shell {
        display: flex;
        height: 100%;
        width: 100%;
        background: var(--bg-primary, #0f172a);
        color: var(--text-primary, #f8fafc);
        font-family: inherit;
        position: relative;
        overflow: hidden;
      }

      /* ==================== LEFT CHAT SIDEBAR ==================== */
      .chat-sidebar {
        width: 60px;
        min-width: 60px;
        background: var(--bg-secondary, #1e293b);
        border-right: 1px solid var(--border-color, #334155);
        display: flex;
        flex-direction: column;
        transition: width 0.2s ease, min-width 0.2s ease;
        z-index: 20;
        overflow: hidden;
      }

      .chat-sidebar.open {
        width: 260px;
        min-width: 260px;
      }

      .new-chat-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 12px;
        padding: 10px 14px;
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }

      .new-chat-btn:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }

      .chat-sidebar:not(.open) .new-chat-btn span {
        display: none;
      }

      .sidebar-search {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 12px 10px;
        padding: 6px 10px;
        background: var(--bg-tertiary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        border-radius: 8px;
      }

      .chat-sidebar:not(.open) .sidebar-search {
        display: none;
      }

      .search-icon {
        color: var(--text-secondary, #94a3b8);
        flex-shrink: 0;
      }

      .search-input {
        background: transparent;
        border: none;
        outline: none;
        color: inherit;
        font-size: 0.84rem;
        width: 100%;
      }

      .session-list {
        flex: 1;
        overflow-y: auto;
        padding: 4px 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .session-group-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--text-secondary, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 8px 6px 4px;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .chat-sidebar:not(.open) .session-group-label {
        display: none;
      }

      .session-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s ease;
        color: var(--text-secondary, #cbd5e1);
        position: relative;
      }

      .session-item:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-primary, #ffffff);
      }

      .session-item.active {
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-primary, #a5b4fc);
        font-weight: 600;
      }

      .session-icon {
        flex-shrink: 0;
      }

      .session-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .chat-sidebar:not(.open) .session-info,
      .chat-sidebar:not(.open) .session-actions {
        display: none;
      }

      .session-title {
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .session-date {
        font-size: 0.7rem;
        color: var(--text-secondary, #64748b);
      }

      .session-tokens {
        font-size: 0.68rem;
        color: var(--accent-primary, #818cf8);
      }

      .rename-input {
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--accent-primary, #6366f1);
        color: #ffffff;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.85rem;
        width: 100%;
        outline: none;
      }

      .session-actions {
        display: none;
        align-items: center;
        gap: 4px;
      }

      .session-item:hover .session-actions {
        display: flex;
      }

      .session-action-btn {
        background: none;
        border: none;
        color: var(--text-secondary, #94a3b8);
        cursor: pointer;
        font-size: 0.78rem;
        padding: 2px;
        border-radius: 4px;
      }

      .session-action-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }

      .sidebar-footer {
        padding: 8px 12px;
        border-top: 1px solid var(--border-color, #334155);
      }

      .clear-all-history-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 6px 10px;
        background: none;
        border: 1px solid rgba(239, 68, 68, 0.25);
        color: #ef4444;
        border-radius: 6px;
        font-size: 0.78rem;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .clear-all-history-btn:hover {
        background: rgba(239, 68, 68, 0.1);
      }

      .sidebar-collapse-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: none;
        border: none;
        border-top: 1px solid var(--border-color, #334155);
        color: var(--text-secondary, #94a3b8);
        cursor: pointer;
        font-size: 0.82rem;
        width: 100%;
      }

      .sidebar-collapse-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.04);
      }

      .empty-history {
        padding: 20px 10px;
        text-align: center;
        font-size: 0.8rem;
        color: var(--text-secondary, #64748b);
      }

      /* ==================== MAIN CONTENT ==================== */
      .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        height: 100%;
        overflow: hidden;
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        border-bottom: 1px solid var(--border-color, #334155);
        background: var(--bg-secondary, #1e293b);
        flex-shrink: 0;
        gap: 12px;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .hamburger-sidebar-btn {
        background: none;
        border: 1px solid var(--border-color, #334155);
        color: var(--text-primary, #ffffff);
        border-radius: 6px;
        padding: 5px 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
      }

      .page-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .title-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-primary, #818cf8);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .page-title h1 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: -0.2px;
      }

      .page-title p {
        margin: 0;
        font-size: 0.78rem;
        color: var(--text-secondary, #94a3b8);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .btn-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-color, #334155);
        border-radius: 8px;
        color: var(--text-secondary, #cbd5e1);
        font-size: 0.82rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-header:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .btn-danger-header {
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.3);
      }

      .btn-danger-header:hover {
        background: rgba(239, 68, 68, 0.15);
      }

      .toast-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        background: rgba(16, 185, 129, 0.15);
        border-bottom: 1px solid rgba(16, 185, 129, 0.3);
        color: #34d399;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .toast-close {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
      }

      /* ==================== TAB BAR ==================== */
      .tab-bar-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        background: var(--bg-secondary, #1e293b);
        border-bottom: 1px solid var(--border-color, #334155);
        flex-shrink: 0;
        gap: 12px;
      }

      .tab-bar {
        display: flex;
        gap: 4px;
      }

      .tab-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border: none;
        background: none;
        color: var(--text-secondary, #94a3b8);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.15s ease;
      }

      .tab-btn:hover {
        color: var(--text-primary, #ffffff);
      }

      .tab-btn.active {
        color: var(--accent-primary, #818cf8);
        border-bottom-color: var(--accent-primary, #818cf8);
      }

      .tab-badge {
        font-size: 0.7rem;
        padding: 1px 6px;
        border-radius: 10px;
        background: rgba(99, 102, 241, 0.2);
        color: var(--accent-primary, #a5b4fc);
      }

      .tab-bar-tools {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .model-selector {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--bg-tertiary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        border-radius: 8px;
        padding: 2px 8px;
        font-size: 0.8rem;
      }

      .model-select {
        background: transparent;
        border: none;
        color: inherit;
        font-size: 0.8rem;
        outline: none;
        cursor: pointer;
      }

      .api-key-indicator {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        background: rgba(239, 68, 68, 0.12);
        color: #f87171;
        cursor: pointer;
      }

      .api-key-indicator.configured {
        background: rgba(16, 185, 129, 0.12);
        color: #34d399;
      }

      .chat-tokens-indicator {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.75rem;
        color: var(--text-secondary, #94a3b8);
      }

      /* ==================== TAB CONTENT ==================== */
      .tab-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }

      /* Direct Generator Bar */
      .direct-generator-bar {
        margin: 12px 16px 0;
        padding: 10px 14px;
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid var(--border-color, #334155);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
      }

      .direct-bar-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.84rem;
      }

      .lightning-icon {
        color: #eab308;
      }

      .direct-bar-sub {
        font-size: 0.74rem;
        color: var(--text-secondary, #94a3b8);
        margin-left: 6px;
      }

      .direct-bar-form {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .form-field.topic-field {
        flex: 1;
        min-width: 220px;
      }

      .direct-bar-form input,
      .direct-bar-form select {
        width: 100%;
        padding: 7px 10px;
        border-radius: 8px;
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        color: inherit;
        font-size: 0.84rem;
        outline: none;
      }

      .direct-bar-form input:focus,
      .direct-bar-form select:focus {
        border-color: var(--accent-primary, #6366f1);
      }

      .btn-direct-generate {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 16px;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.84rem;
        cursor: pointer;
        transition: transform 0.12s ease, filter 0.12s ease;
        white-space: nowrap;
      }

      .btn-direct-generate:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: scale(1.02);
      }

      .btn-direct-generate:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Chat Messages Area */
      .chat-area {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
      }

      .chat-empty {
        margin: auto;
        max-width: 580px;
        text-align: center;
        padding: 24px;
      }

      .chat-empty h3 {
        margin: 12px 0 8px;
        font-size: 1.2rem;
      }

      .chat-empty p {
        margin: 0 0 20px;
        font-size: 0.88rem;
        color: var(--text-secondary, #94a3b8);
        line-height: 1.5;
      }

      .example-prompts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
      }

      .example-prompt {
        padding: 8px 12px;
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        color: var(--text-primary, #f1f5f9);
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .example-prompt:hover {
        border-color: var(--accent-primary, #6366f1);
        background: rgba(99, 102, 241, 0.1);
        transform: translateY(-1px);
      }

      .messages {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .message {
        display: flex;
        gap: 12px;
        max-width: 85%;
      }

      .message.user-message {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      .message.assistant-message {
        align-self: flex-start;
      }

      .msg-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .msg-avatar.user-avatar {
        background: #0284c7;
      }

      .msg-bubble {
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        border-radius: 14px;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
      }

      .user-message .msg-bubble {
        background: #312e81;
        border-color: #4338ca;
        color: #ffffff;
      }

      .msg-attachment {
        font-size: 0.78rem;
        background: rgba(0, 0, 0, 0.2);
        padding: 4px 8px;
        border-radius: 6px;
        display: inline-block;
      }

      .msg-content {
        font-size: 0.9rem;
        line-height: 1.55;
        word-break: break-word;
      }

      /* Extraction Summary Card */
      .extraction-summary-card {
        margin-top: 6px;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(99, 102, 241, 0.35);
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .summary-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 0.85rem;
        color: #818cf8;
      }

      .summary-details {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 0.8rem;
      }

      .summary-meta-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .meta-label {
        color: var(--text-secondary, #94a3b8);
      }

      .badge-count {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .badge-diff {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .view-extracted-btn {
        align-self: flex-start;
        padding: 6px 14px;
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .view-extracted-btn:hover {
        filter: brightness(1.1);
      }

      .msg-footer {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.7rem;
        color: var(--text-secondary, #94a3b8);
        margin-top: 4px;
      }

      .msg-copy-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0 4px;
        font-size: 0.72rem;
      }

      .msg-copy-btn:hover {
        color: #ffffff;
      }

      .typing-indicator {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .typing-indicator span {
        width: 6px;
        height: 6px;
        background: var(--accent-primary, #818cf8);
        border-radius: 50%;
        animation: typingDot 1.4s infinite ease-in-out both;
      }

      .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
      .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

      @keyframes typingDot {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      .generating-text {
        font-size: 0.8rem;
        color: var(--text-secondary, #94a3b8);
        font-style: italic;
      }

      .error-banner {
        margin: 8px 16px;
        padding: 8px 14px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #f87171;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.84rem;
      }

      .error-banner button {
        margin-left: auto;
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
      }

      .attachment-preview-strip {
        margin: 0 16px 8px;
        padding: 6px 12px;
        background: rgba(14, 165, 233, 0.12);
        border: 1px solid rgba(14, 165, 233, 0.35);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8rem;
      }

      .att-info {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .att-type {
        color: var(--text-secondary, #94a3b8);
      }

      .att-remove {
        background: none;
        border: none;
        color: var(--text-secondary, #94a3b8);
        cursor: pointer;
      }

      .att-remove:hover {
        color: #ef4444;
      }

      /* Input Area */
      .input-area {
        padding: 12px 16px 16px;
        background: var(--bg-secondary, #1e293b);
        border-top: 1px solid var(--border-color, #334155);
        flex-shrink: 0;
      }

      .input-wrapper {
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .input-wrapper:focus-within {
        border-color: var(--accent-primary, #6366f1);
      }

      .message-input {
        background: transparent;
        border: none;
        outline: none;
        color: inherit;
        font-family: inherit;
        font-size: 0.9rem;
        resize: vertical;
        min-height: 50px;
      }

      .input-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .attach-btn {
        padding: 6px;
        border-radius: 6px;
        color: var(--text-secondary, #94a3b8);
        cursor: pointer;
        display: flex;
        align-items: center;
        transition: color 0.15s ease;
      }

      .attach-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
      }

      .send-btn {
        padding: 7px 14px;
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .send-btn:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: scale(1.04);
      }

      .send-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* ==================== TAB 2: REVIEW QUESTIONS ==================== */
      .review-tab {
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .review-header {
        padding: 14px 18px;
        border-radius: 12px;
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .review-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }

      .review-stats h3 {
        margin: 0 0 6px;
        font-size: 1.1rem;
      }

      .stats-pills {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .stat-pill {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 10px;
      }

      .stat-pill.total { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; }
      .stat-pill.pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
      .stat-pill.approved { background: rgba(16, 185, 129, 0.15); color: #34d399; }
      .stat-pill.rejected { background: rgba(239, 68, 68, 0.15); color: #f87171; }
      .stat-pill.applied { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }

      .review-top-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .btn-review-action {
        padding: 7px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-color, #334155);
        color: var(--text-secondary, #cbd5e1);
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-review-action:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .btn-approve-all {
        color: #34d399;
        border-color: rgba(16, 185, 129, 0.3);
      }

      .btn-approve-all:hover {
        background: rgba(16, 185, 129, 0.15);
      }

      .btn-insert-assessment {
        padding: 8px 16px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-insert-assessment:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: scale(1.02);
      }

      .btn-insert-assessment:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .target-config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .config-col {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .config-col label {
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--text-secondary, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .config-select, .config-input {
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        color: inherit;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 0.82rem;
        outline: none;
      }

      .review-empty {
        text-align: center;
        padding: 40px;
        border-radius: 12px;
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
      }

      .btn-go-chat {
        margin-top: 12px;
        padding: 8px 16px;
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      }

      /* Question Review Cards */
      .question-cards-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .q-review-card {
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .q-review-card.status-approved {
        border-left: 4px solid #10b981;
      }

      .q-review-card.status-rejected {
        border-left: 4px solid #ef4444;
        opacity: 0.65;
      }

      .q-review-card.status-applied {
        border-left: 4px solid #3b82f6;
      }

      .badge-status-applied {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
      }

      .badge-status-applied-pill {
        font-size: 0.76rem;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 6px;
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.35);
        color: #60a5fa;
      }

      .q-review-card.has-duplicate {
        border-color: #f59e0b;
      }

      .q-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
      }

      .q-header-left {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .q-index-pill {
        font-weight: 800;
        font-size: 0.85rem;
        color: var(--accent-primary, #818cf8);
      }

      .badge-type, .badge-difficulty, .badge-category, .badge-weight {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 6px;
      }

      .badge-type { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; }
      .badge-difficulty { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
      .badge-category { background: rgba(14, 165, 233, 0.15); color: #38bdf8; }
      .badge-weight { background: rgba(255, 255, 255, 0.08); color: var(--text-secondary, #cbd5e1); }

      .q-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .btn-status-toggle {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid transparent;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-secondary, #94a3b8);
      }

      .btn-status-toggle.approve.active {
        background: rgba(16, 185, 129, 0.2);
        border-color: #10b981;
        color: #34d399;
      }

      .btn-status-toggle.reject.active {
        background: rgba(239, 68, 68, 0.2);
        border-color: #ef4444;
        color: #f87171;
      }

      .btn-icon-delete {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        font-size: 0.85rem;
      }

      .btn-icon-delete:hover {
        background: rgba(239, 68, 68, 0.15);
      }

      .duplicate-alert {
        padding: 8px 12px;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.35);
        border-radius: 6px;
        color: #fbbf24;
        font-size: 0.78rem;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .validation-alert {
        padding: 8px 12px;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 6px;
        color: #f87171;
        font-size: 0.78rem;
        display: flex;
        align-items: flex-start;
        gap: 6px;
      }

      .q-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .field-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .field-label-row label, .field-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-secondary, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .btn-mini-action {
        background: none;
        border: none;
        color: var(--accent-primary, #818cf8);
        font-size: 0.74rem;
        cursor: pointer;
      }

      .q-title-input {
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        color: inherit;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 0.92rem;
        font-weight: 600;
        font-family: inherit;
        width: 100%;
        resize: vertical;
        box-sizing: border-box;
      }

      .q-desc-input {
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        color: var(--text-secondary, #cbd5e1);
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 0.82rem;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
      }

      /* Options */
      .options-block {
        background: rgba(15, 23, 42, 0.5);
        border: 1px solid var(--border-color, #334155);
        border-radius: 8px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .options-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.78rem;
        color: var(--text-secondary, #cbd5e1);
      }

      .btn-mini-add-opt {
        background: none;
        border: 1px solid var(--border-color, #334155);
        color: var(--accent-primary, #818cf8);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.72rem;
        cursor: pointer;
      }

      .options-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .option-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 6px;
        background: var(--bg-primary, #0f172a);
        border: 1px solid transparent;
        transition: all 0.15s ease;
      }

      .option-row.is-correct {
        border-color: rgba(16, 185, 129, 0.4);
        background: rgba(16, 185, 129, 0.08);
      }

      .opt-selector {
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
      }

      .opt-letter {
        font-weight: 700;
        font-size: 0.82rem;
      }

      .opt-input {
        flex: 1;
        background: transparent;
        border: none;
        color: inherit;
        font-size: 0.85rem;
        outline: none;
      }

      .correct-badge-pill {
        font-size: 0.7rem;
        font-weight: 700;
        background: rgba(16, 185, 129, 0.18);
        color: #34d399;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
      }

      .btn-delete-opt {
        background: none;
        border: none;
        color: var(--text-secondary, #64748b);
        cursor: pointer;
        padding: 0 4px;
      }

      .btn-delete-opt:hover {
        color: #ef4444;
      }

      /* Explanation */
      .explanation-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .explanation-input {
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        color: var(--text-secondary, #cbd5e1);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 0.82rem;
        font-family: inherit;
        resize: vertical;
        line-height: 1.45;
        width: 100%;
        box-sizing: border-box;
      }

      /* ==================== TAB 3: GENERATED JSON ==================== */
      .json-tab {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
      }

      .json-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 18px;
        border-radius: 10px;
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        flex-wrap: wrap;
        gap: 12px;
        flex-shrink: 0;
      }

      .json-header-left h3 {
        margin: 0 0 4px;
        font-size: 1.05rem;
      }

      .json-header-left p {
        margin: 0;
        font-size: 0.78rem;
        color: var(--text-secondary, #94a3b8);
      }

      .json-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-json-action {
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-color, #334155);
        border-radius: 6px;
        color: var(--text-secondary, #cbd5e1);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-json-action:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .btn-json-apply {
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border-color: var(--accent-primary, #6366f1);
      }

      .btn-json-apply:hover {
        filter: brightness(1.1);
      }

      .json-error-banner {
        padding: 8px 12px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.35);
        color: #f87171;
        border-radius: 6px;
        font-size: 0.8rem;
      }

      .json-editor-container {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      .json-editor {
        flex: 1;
        background: var(--bg-primary, #0a0f1d);
        border: 1px solid var(--border-color, #334155);
        border-radius: 10px;
        padding: 14px;
        color: #38bdf8;
        font-family: 'Consolas', 'Courier New', monospace;
        font-size: 0.84rem;
        line-height: 1.5;
        outline: none;
        resize: none;
        box-sizing: border-box;
      }

      /* ==================== MODALS ==================== */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 16px;
      }

      .modal-dialog {
        background: var(--bg-secondary, #1e293b);
        border: 1px solid var(--border-color, #334155);
        border-radius: 14px;
        width: 100%;
        max-width: 540px;
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color, #334155);
      }

      .modal-header h3 {
        margin: 0;
        font-size: 1.1rem;
      }

      .modal-close {
        background: none;
        border: none;
        color: var(--text-secondary, #94a3b8);
        cursor: pointer;
        font-size: 1.1rem;
      }

      .modal-body {
        padding: 20px;
        overflow-y: auto;
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
        font-size: 0.8rem;
        font-weight: 600;
      }

      .modal-select, .modal-input, .modal-textarea {
        background: var(--bg-primary, #0f172a);
        border: 1px solid var(--border-color, #334155);
        color: inherit;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 0.85rem;
        outline: none;
        font-family: inherit;
      }

      .password-wrapper {
        display: flex;
        align-items: center;
        position: relative;
      }

      .password-wrapper input {
        width: 100%;
        padding-right: 36px;
      }

      .btn-toggle-eye {
        position: absolute;
        right: 8px;
        background: none;
        border: none;
        cursor: pointer;
      }

      .field-hint {
        font-size: 0.72rem;
        color: var(--text-secondary, #94a3b8);
      }

      .btn-reset-inst {
        align-self: flex-start;
        background: none;
        border: none;
        color: var(--accent-primary, #818cf8);
        font-size: 0.74rem;
        cursor: pointer;
        padding: 0;
      }

      .modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 20px;
        border-top: 1px solid var(--border-color, #334155);
      }

      .btn-primary {
        padding: 8px 16px;
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-secondary {
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-color, #334155);
        color: inherit;
        border-radius: 8px;
        cursor: pointer;
      }

      /* How it works steps */
      .how-step {
        display: flex;
        gap: 14px;
        align-items: flex-start;
      }

      .step-num {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--accent-primary, #6366f1);
        color: #ffffff;
        font-weight: 700;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .step-content h4 {
        margin: 0 0 4px;
        font-size: 0.95rem;
      }

      .step-content p {
        margin: 0;
        font-size: 0.82rem;
        color: var(--text-secondary, #94a3b8);
        line-height: 1.45;
      }

      /* ==================== JARVIS THEME OVERRIDES ==================== */
      .jarvis-mode {
        --accent-primary: #00c8ff;
        background: rgba(0, 15, 30, 0.95) !important;
        color: #c8eeff !important;
      }

      .jarvis-mode .chat-sidebar,
      .jarvis-mode .page-header,
      .jarvis-mode .tab-bar-row,
      .jarvis-mode .input-area {
        background: rgba(0, 20, 40, 0.9) !important;
        border-color: rgba(0, 200, 255, 0.25) !important;
      }

      .jarvis-mode .new-chat-btn {
        background: linear-gradient(135deg, rgba(0, 200, 255, 0.8) 0%, rgba(0, 100, 200, 0.8) 100%) !important;
        box-shadow: 0 0 12px rgba(0, 200, 255, 0.35);
      }

      .jarvis-mode .msg-bubble {
        background: rgba(0, 25, 50, 0.85) !important;
        border-color: rgba(0, 200, 255, 0.3) !important;
      }

      .jarvis-mode .user-message .msg-bubble {
        background: rgba(0, 50, 100, 0.85) !important;
        border-color: #00c8ff !important;
      }

      .jarvis-mode .page-title h1 {
        font-family: 'Orbitron', sans-serif !important;
        color: #00c8ff !important;
        text-shadow: 0 0 10px rgba(0, 200, 255, 0.5);
      }

      .jarvis-mode .q-review-card {
        background: rgba(0, 25, 50, 0.85) !important;
        border-color: rgba(0, 200, 255, 0.3) !important;
      }

      .jarvis-mode .direct-generator-bar {
        background: rgba(0, 25, 50, 0.85) !important;
        border-color: rgba(0, 200, 255, 0.35) !important;
        box-shadow: 0 0 16px rgba(0, 200, 255, 0.15);
      }
    `,
  ],
})
export class AssessmentAiAssistantComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatArea') chatAreaRef!: ElementRef;
  @ViewChild('msgInput') msgInputRef!: ElementRef;

  @Output() takeTest = new EventEmitter<string>();
  @Output() openBuilder = new EventEmitter<string>();

  aiSvc = inject(AssessmentAiService);
  assessmentSvc = inject(AssessmentTestService);
  themeSvc = inject(ThemeService);

  activeTab: MainTab = 'chat';
  chatSidebarOpen = true;
  messageText = '';
  searchQuery = '';
  difficultyFilter = '';

  // Direct Generator fields
  directTopic = '';
  directDifficulty: QuestionDifficulty = 'Intermediate';
  directCount = 10;

  // Attachment state
  currentAttachment: { fileName: string; content: string; fileType: string } | null = null;

  // Target sheet selection state
  targetSetChoice = '__NEW__';
  targetNewSetName = 'AI Assessment Sheet';
  targetCategoryChoice = '__NEW__';
  targetNewCatName = 'AI Generated Assessments';
  isInserting = false;

  // Modal states
  showSettings = false;
  showHowItWorks = false;
  showApiKey = false;
  actionSuccessMsg = '';

  // JSON Tab state
  rawJsonText = '';
  jsonError = '';
  jsonCopySuccess = false;

  sessions: AssessmentChatSession[] = [];
  pinnedSessions: AssessmentChatSession[] = [];
  historyGroups: HistoryGroup[] = [];

  selectedModel: AiModel = 'gpt-5.6-luna';
  copiedMessageIds = new Set<string>();
  private copyTimeouts = new Map<string, any>();
  private renamingId: string | null = null;
  private subscription = new Subscription();
  private shouldScrollToBottom = false;
  private successTimeout: any = null;

  settingsConfig = { ...this.aiSvc.config() };

  ngOnInit() {
    this.subscription.add(
      this.aiSvc.sessions$.subscribe((sessions) => {
        this.sessions = sessions;
        this.rebuildHistoryGroups(sessions);
        this.pinnedSessions = sessions
          .filter((s) => s.pinned)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        this.shouldScrollToBottom = true;
        this.syncTargetSetFromActiveSession();
      })
    );

    if (this.sessions.length > 0 && !this.aiSvc.activeSessionId()) {
      this.aiSvc.setActiveSession(this.sessions[0].id);
    }

    const cfg = this.aiSvc.config();
    this.selectedModel = cfg.model;
    this.settingsConfig = { ...cfg };
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.successTimeout) clearTimeout(this.successTimeout);
    this.copyTimeouts.forEach((t) => clearTimeout(t));
    this.copyTimeouts.clear();
  }

  get currentSession(): AssessmentChatSession | null {
    return this.aiSvc.activeSession;
  }

  get hasApiKey(): boolean {
    return this.aiSvc.config().provider === 'foundry' || !!this.aiSvc.config().apiKey;
  }

  get generatedQuestions(): GeneratedQuestion[] {
    return this.currentSession?.generatedSet?.questions ?? [];
  }

  get filteredQuestions(): GeneratedQuestion[] {
    if (!this.difficultyFilter) return this.generatedQuestions;
    return this.generatedQuestions.filter((q) => q.difficulty === this.difficultyFilter);
  }

  get pendingQuestions(): GeneratedQuestion[] {
    return this.generatedQuestions.filter((q) => q.status === 'pending');
  }

  get approvedQuestions(): GeneratedQuestion[] {
    return this.generatedQuestions.filter((q) => q.status === 'approved');
  }

  get rejectedQuestions(): GeneratedQuestion[] {
    return this.generatedQuestions.filter((q) => q.status === 'rejected');
  }

  get appliedQuestions(): GeneratedQuestion[] {
    return this.generatedQuestions.filter((q) => q.status === 'applied');
  }

  get insertableQuestions(): GeneratedQuestion[] {
    if (this.approvedQuestions.length > 0) {
      return this.approvedQuestions;
    }
    return this.generatedQuestions.filter((q) => q.status === 'pending');
  }

  get currentChatTokensText(): string {
    const total = this.aiSvc.getSessionTotalTokens(this.currentSession);
    if (total === 0) return '';
    if (total >= 1000) return `${(total / 1000).toFixed(1)}k tokens`;
    return `${total} tokens`;
  }

  formatSessionTokens(session: AssessmentChatSession): string {
    const total = this.aiSvc.getSessionTotalTokens(session);
    if (total <= 0) return '';
    if (total >= 1000) return `${(total / 1000).toFixed(1)}k tok`;
    return `${total} tok`;
  }

  formatSessionDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  formatMessage(content: string): string {
    return content
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  // ── Session Management ────────────────────────────────────────────────────

  newChat() {
    this.aiSvc.createNewSession();
    this.activeTab = 'chat';
    this.currentAttachment = null;
    this.messageText = '';
  }

  selectSession(id: string) {
    this.aiSvc.setActiveSession(id);
    this.activeTab = 'chat';
    this.shouldScrollToBottom = true;
    this.syncTargetSetFromActiveSession();
  }

  confirmDelete(id: string) {
    if (confirm('Delete this assessment conversation? This will also remove any uninserted questions.')) {
      this.aiSvc.deleteSession(id);
    }
  }

  confirmClearAllHistory() {
    if (
      confirm(
        'Are you sure you want to delete ALL assessment chat history and generated questions?\n\nThis action cannot be undone.'
      )
    ) {
      this.aiSvc.clearAllSessions();
      this.currentAttachment = null;
      this.messageText = '';
      this.activeTab = 'chat';
      this.showToast('All assessment chat history has been cleared.');
    }
  }

  isRenaming(id: string): boolean {
    return this.renamingId === id;
  }

  startRename(id: string) {
    this.renamingId = id;
  }

  finishRename(event: Event, id: string) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (val) this.aiSvc.renameSession(id, val);
    this.renamingId = null;
  }

  onSearch() {
    if (!this.searchQuery) {
      this.rebuildHistoryGroups(this.sessions);
    } else {
      const filtered = this.aiSvc.searchSessions(this.searchQuery);
      this.rebuildHistoryGroups(filtered);
    }
  }

  private rebuildHistoryGroups(sessions: AssessmentChatSession[]) {
    const unpinned = sessions.filter((s) => !s.pinned);
    const now = new Date();
    const today: AssessmentChatSession[] = [];
    const yesterday: AssessmentChatSession[] = [];
    const thisWeek: AssessmentChatSession[] = [];
    const older: AssessmentChatSession[] = [];

    unpinned.forEach((s) => {
      const d = new Date(s.updatedAt);
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff === 0) today.push(s);
      else if (diff === 1) yesterday.push(s);
      else if (diff <= 7) thisWeek.push(s);
      else older.push(s);
    });

    this.historyGroups = [
      { label: 'Today', sessions: today },
      { label: 'Yesterday', sessions: yesterday },
      { label: 'This Week', sessions: thisWeek },
      { label: 'Earlier', sessions: older },
    ].filter((g) => g.sessions.length > 0);
  }

  // ── Study Material & Direct Generation ───────────────────────────────────

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      this.showToast(`Reading ${file.name}...`);
      const extracted = await this.aiSvc.extractTextFromFile(file);
      this.currentAttachment = {
        fileName: extracted.fileName,
        content: extracted.text,
        fileType: extracted.fileType,
      };
      this.showToast(`Extracted ${extracted.text.length} characters from ${file.name}.`);
      if (!this.messageText.trim()) {
        this.messageText = `Please analyze the attached ${extracted.fileType} (${file.name}) and generate a comprehensive set of 10 assessment questions testing key concepts.`;
      }
    } catch (err: any) {
      alert(`Error reading file: ${err.message || 'Unknown error'}`);
    } finally {
      input.value = '';
    }
  }

  clearAttachment() {
    this.currentAttachment = null;
  }

  async sendMessage() {
    const text = this.messageText.trim();
    if ((!text && !this.currentAttachment) || this.aiSvc.isProcessing()) return;

    const attachmentPayload = this.currentAttachment
      ? { fileName: this.currentAttachment.fileName, content: this.currentAttachment.content }
      : undefined;

    this.messageText = '';
    this.currentAttachment = null;
    this.shouldScrollToBottom = true;

    await this.aiSvc.sendUserMessage(text || 'Generate assessment questions from the attached material.', attachmentPayload);
    this.syncTargetSetFromActiveSession();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  generateDirectQuestions() {
    const topic = this.directTopic.trim();
    if (!topic || this.aiSvc.isProcessing()) return;

    const prompt = `Create a ${this.directDifficulty.toLowerCase()}-level question set for "${topic}" with ${this.directCount} high-quality multiple choice questions. Include realistic scenario-based questions, 4 distinct options per question, correct answers, and thorough educational explanations.`;
    this.messageText = prompt;
    this.sendMessage();
  }

  useExamplePrompt(key: 'azure' | 'python' | 'aws' | 'k8s' | 'angular') {
    const prompts: Record<string, string> = {
      azure: 'Create a Microsoft Azure AI-900 certification question set with 10 practice questions covering Computer Vision, Natural Language Processing, Document Intelligence, and Responsible AI.',
      python: 'Create an expert-level Python question set with 10 questions testing decorators, generators, metaclasses, asyncio concurrency, memory management, and dunder protocols.',
      aws: 'Create an AWS Certified Cloud Practitioner (CLF-C02) question set with 10 foundational questions covering EC2, S3, IAM, VPC, and Well-Architected Framework.',
      k8s: 'Create a Docker & Kubernetes certification question set with 10 questions covering Dockerfiles, Pods, Deployments, Services, ConfigMaps, and Ingress controllers.',
      angular: 'Create an advanced Angular 21 question set with 10 questions testing Signals, standalone components, deferrable views, dependency injection, and performance optimization.',
    };
    this.messageText = prompts[key];
    this.sendMessage();
  }

  // ── Review Tab Actions ───────────────────────────────────────────────────

  openReviewTab() {
    this.activeTab = 'review';
    this.syncTargetSetFromActiveSession();
  }

  private syncTargetSetFromActiveSession() {
    const set = this.currentSession?.generatedSet;
    if (set) {
      if (set.setName) this.targetNewSetName = set.setName;
      if (set.categoryName) this.targetNewCatName = set.categoryName;
      // Pre-select 'new' if not already pointing to existing set
      if (!this.assessmentSvc.questionSets().some((s) => s.id === this.targetSetChoice)) {
        this.targetSetChoice = '__NEW__';
      }
      if (!this.assessmentSvc.categories().some((c) => c.id === this.targetCategoryChoice)) {
        this.targetCategoryChoice = '__NEW__';
      }
    }
  }

  getOptionLetter(idx: number): string {
    return String.fromCharCode(65 + idx);
  }

  isOptionCorrect(q: GeneratedQuestion, opt: any): boolean {
    if (q.type === 'radio') {
      return q.correctAnswer === opt.value || q.correctAnswer === opt.label;
    }
    return (q.correctAnswers || []).includes(opt.value) || (q.correctAnswers || []).includes(opt.label);
  }

  setOptionCorrect(q: GeneratedQuestion, opt: any) {
    if (q.type === 'radio') {
      q.correctAnswer = opt.value;
      q.correctAnswers = [opt.value];
    } else {
      const answers = new Set(q.correctAnswers || []);
      if (answers.has(opt.value)) {
        answers.delete(opt.value);
      } else {
        answers.add(opt.value);
      }
      q.correctAnswers = Array.from(answers);
      q.correctAnswer = q.correctAnswers[0] || '';
    }
    q.edited = true;
    this.aiSvc.validateAndEnrichQuestions(this.generatedQuestions, this.targetSetChoice === '__NEW__' ? undefined : this.targetSetChoice);
  }

  addOption(q: GeneratedQuestion) {
    const oIdx = q.options.length;
    const letter = this.getOptionLetter(oIdx).toLowerCase();
    q.options.push({
      id: `opt-${oIdx + 1}`,
      label: `Option ${this.getOptionLetter(oIdx)}`,
      value: `option_${letter}`,
    });
    q.edited = true;
  }

  removeOption(q: GeneratedQuestion, idx: number) {
    if (q.options.length <= 2) return;
    const removed = q.options.splice(idx, 1)[0];
    if (q.correctAnswer === removed.value) {
      q.correctAnswer = q.options[0]?.value;
    }
    if (q.correctAnswers) {
      q.correctAnswers = q.correctAnswers.filter((v) => v !== removed.value);
    }
    q.edited = true;
    this.aiSvc.validateAndEnrichQuestions(this.generatedQuestions);
  }

  onOptionLabelChange(q: GeneratedQuestion, opt: any) {
    q.edited = true;
    this.aiSvc.validateAndEnrichQuestions(this.generatedQuestions);
  }

  onQuestionEdited(q: GeneratedQuestion) {
    q.edited = true;
    this.aiSvc.validateAndEnrichQuestions(this.generatedQuestions);
  }

  toggleApproveQuestion(q: GeneratedQuestion) {
    q.status = q.status === 'approved' ? 'pending' : 'approved';
  }

  toggleRejectQuestion(q: GeneratedQuestion) {
    q.status = q.status === 'rejected' ? 'pending' : 'rejected';
  }

  deleteQuestion(id: string) {
    if (!this.currentSession?.generatedSet) return;
    this.currentSession.generatedSet.questions = this.currentSession.generatedSet.questions.filter(
      (q) => q.id !== id
    );
    this.showToast('Question deleted from session.');
  }

  selectAllQuestions() {
    this.generatedQuestions.forEach((q) => {
      if (q.status !== 'rejected') q.status = 'approved';
    });
  }

  approveAllQuestions() {
    this.generatedQuestions.forEach((q) => {
      q.status = 'approved';
    });
    this.showToast(`All ${this.generatedQuestions.length} questions approved.`);
  }

  // ── Insert Approved into Assessment Test ──────────────────────────────────

  insertApprovedIntoAssessment() {
    if (this.isInserting) return;

    let toInsert = this.approvedQuestions;
    if (toInsert.length === 0) {
      toInsert = this.generatedQuestions.filter((q) => q.status === 'pending');
    }

    if (toInsert.length === 0) {
      if (this.appliedQuestions.length > 0) {
        alert('All questions have already been inserted into the Assessment Test library.');
      } else {
        alert('No questions available to insert. Please review or generate questions first.');
      }
      return;
    }

    this.isInserting = true;
    try {
      const res = this.aiSvc.insertApprovedQuestions({
        targetSetId: this.targetSetChoice,
        newSetName: this.targetNewSetName,
        newSetDescription: this.currentSession?.generatedSet?.description,
        targetCategoryId: this.targetCategoryChoice,
        newCategoryName: this.targetNewCatName,
        timerSeconds: this.currentSession?.generatedSet?.timerSeconds,
        questionsToInsert: toInsert,
      });

      if (res.success) {
        this.targetSetChoice = res.setId;
        this.showToast(res.message);
        if (confirm(`${res.message}\n\nWould you like to take the assessment test now?`)) {
          this.takeTest.emit(res.setId);
        }
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      console.error('Error inserting questions into assessment:', err);
      alert('Failed to insert questions into Assessment Test: ' + (err.message || err));
    } finally {
      this.isInserting = false;
    }
  }

  // ── JSON Tab ─────────────────────────────────────────────────────────────

  openJsonTab() {
    this.activeTab = 'json';
    const set = this.currentSession?.generatedSet;
    if (set) {
      this.rawJsonText = JSON.stringify(
        {
          setName: set.setName,
          categoryName: set.categoryName,
          description: set.description,
          difficulty: set.difficulty,
          timerSeconds: set.timerSeconds,
          questions: set.questions.map((q) => ({
            id: q.id,
            title: q.title,
            description: q.description,
            type: q.type,
            difficulty: q.difficulty,
            category: q.category,
            weight: q.weight,
            negativeMark: q.negativeMark,
            options: q.options,
            correctAnswer: q.correctAnswer,
            correctAnswers: q.correctAnswers,
            correctAnswerReason: q.correctAnswerReason,
          })),
        },
        null,
        2
      );
    } else {
      this.rawJsonText = '';
    }
  }

  formatJsonText() {
    try {
      const parsed = JSON.parse(this.rawJsonText);
      this.rawJsonText = JSON.stringify(parsed, null, 2);
      this.jsonError = '';
    } catch (e: any) {
      this.jsonError = `JSON syntax error: ${e.message}`;
    }
  }

  copyJsonText() {
    navigator.clipboard.writeText(this.rawJsonText).then(() => {
      this.jsonCopySuccess = true;
      setTimeout(() => (this.jsonCopySuccess = false), 2000);
    });
  }

  applyJsonEdits() {
    try {
      const parsed = this.aiSvc.parseGeneratedQuestionsJson(this.rawJsonText);
      if (parsed.questions.length === 0) {
        throw new Error('No valid questions found in JSON.');
      }
      this.aiSvc.validateAndEnrichQuestions(parsed.questions);
      if (this.currentSession) {
        const generatedSet: GeneratedQuestionSet = {
          setName: parsed.setName,
          categoryName: parsed.categoryName,
          description: parsed.description,
          difficulty: (parsed.difficulty as QuestionDifficulty) || 'Intermediate',
          timerSeconds: parsed.timerSeconds,
          questions: parsed.questions,
          rawJson: this.rawJsonText,
          generatedAt: new Date().toISOString(),
        };
        (this.currentSession as any).generatedSet = generatedSet;
      }
      this.jsonError = '';
      this.showToast(`Updated ${parsed.questions.length} questions from JSON!`);
      this.openReviewTab();
    } catch (e: any) {
      this.jsonError = `Failed to apply JSON: ${e.message}`;
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  onProviderChange() {
    switch (this.settingsConfig.provider) {
      case 'foundry':
        this.settingsConfig.model = 'gpt-5.6-luna';
        break;
      case 'openai':
        this.settingsConfig.model = 'gpt-4o';
        break;
      case 'gemini':
        this.settingsConfig.model = 'gemini-2.0-flash';
        break;
      case 'anthropic':
        this.settingsConfig.model = 'claude-3-5-sonnet-20241022';
        break;
    }
  }

  saveSettings() {
    this.aiSvc.updateConfig(this.settingsConfig);
    this.selectedModel = this.settingsConfig.model;
    this.showSettings = false;
    this.showToast('AI Settings updated successfully.');
  }

  saveModelSelection() {
    this.aiSvc.updateConfig({ model: this.selectedModel });
    this.settingsConfig.model = this.selectedModel;
    this.showToast(`Model set to ${this.selectedModel}`);
  }

  resetSystemInstructions() {
    this.settingsConfig.systemInstructions = DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  copyMessageContent(msgId: string, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      this.copiedMessageIds.add(msgId);
      const existing = this.copyTimeouts.get(msgId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        this.copiedMessageIds.delete(msgId);
        this.copyTimeouts.delete(msgId);
      }, 2000);
      this.copyTimeouts.set(msgId, t);
    });
  }

  private showToast(msg: string) {
    this.actionSuccessMsg = msg;
    if (this.successTimeout) clearTimeout(this.successTimeout);
    this.successTimeout = setTimeout(() => {
      this.actionSuccessMsg = '';
    }, 4000);
  }

  private scrollToBottom() {
    try {
      if (this.chatAreaRef?.nativeElement) {
        this.chatAreaRef.nativeElement.scrollTop = this.chatAreaRef.nativeElement.scrollHeight;
      }
    } catch {}
  }
}
