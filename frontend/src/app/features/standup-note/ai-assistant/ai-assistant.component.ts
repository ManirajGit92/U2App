import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import {
  AiAssistantService,
  ChatSession,
  ExtractedItem,
  ExtractedData,
  ExtractedCategory,
  AiModel,
  DEFAULT_SYSTEM_INSTRUCTIONS,
} from './ai-assistant.service';
import {
  StandupNoteService,
  Employee,
  Project,
  Reminder,
  Task,
  LeaveRecord,
  StandupNote,
} from '../standup-note.service';
import {
  WorkTrackerService,
  DeveloperTask,
  ReleaseTrack,
  HourlyWorkUpdate,
  HourlyUpdateStatus,
} from '../../work-tracker/work-tracker.service';


type MainTab = 'chat' | 'extracted' | 'extracted-json';
type HistoryGroup = { label: string; sessions: ChatSession[] };

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ai-assistant-shell" [class.sidebar-expanded]="chatSidebarOpen">
      <!-- ==================== LEFT CHAT SIDEBAR ==================== -->
      <aside class="chat-sidebar" [class.open]="chatSidebarOpen">
        <!-- New Chat Button -->
        <button class="new-chat-btn" (click)="newChat()" id="ai-new-chat-btn">
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
            placeholder="Search history..."
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearch()"
            class="search-input"
            id="ai-search-input"
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
              id="session-{{s.id}}">
              <svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div class="session-info">
                <span class="session-title" *ngIf="!isRenaming(s.id)">{{ s.title }}</span>
                <input *ngIf="isRenaming(s.id)" class="rename-input" [value]="s.title"
                  (blur)="finishRename($event, s.id)" (keydown.enter)="finishRename($event, s.id)"
                  autofocus />
                <span class="session-date">{{ formatSessionDate(s.updatedAt) }}</span>
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
              id="session-{{s.id}}">
              <svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div class="session-info">
                <span class="session-title" *ngIf="!isRenaming(s.id)">{{ s.title }}</span>
                <input *ngIf="isRenaming(s.id)" class="rename-input" [value]="s.title"
                  (blur)="finishRename($event, s.id)" (keydown.enter)="finishRename($event, s.id)"
                  autofocus />
                <span class="session-date">{{ formatSessionDate(s.updatedAt) }}</span>
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
          <button class="clear-all-history-btn" (click)="confirmClearAllHistory()" id="ai-clear-all-history-btn" title="Clear all chat history and extracted information">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span *ngIf="chatSidebarOpen">Clear All History</span>
          </button>
        </div>

        <!-- Collapse Toggle -->
        <button class="sidebar-collapse-btn" (click)="chatSidebarOpen = !chatSidebarOpen" title="Collapse sidebar">
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
            <button class="hamburger-sidebar-btn" (click)="chatSidebarOpen = !chatSidebarOpen" *ngIf="!chatSidebarOpen">
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
                <h1>AI Assistant</h1>
                <p>Extract insights from your standup meetings and automatically update your employees, projects, tasks, leaves and more.</p>
              </div>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn-header" (click)="showHowItWorks = !showHowItWorks" id="ai-how-it-works-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              How it works?
            </button>
            <button class="btn-header btn-settings" (click)="showSettings = true" id="ai-settings-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83-2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
            <button class="btn-header btn-danger-header" (click)="confirmClearAllHistory()" id="ai-header-clear-btn" title="Clear all chat history and extracted information">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear All History
            </button>
          </div>
        </div>

        <!-- Tab Bar -->
        <div class="tab-bar-row">
          <div class="tab-bar">
            <button class="tab-btn" [class.active]="activeTab === 'chat'" (click)="activeTab = 'chat'" id="ai-tab-chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat with AI
            </button>
            <button class="tab-btn" [class.active]="activeTab === 'extracted'" (click)="activeTab = 'extracted'; runDuplicateCheck()" id="ai-tab-extracted">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              Extracted Information
            </button>
            <button class="tab-btn" [class.active]="activeTab === 'extracted-json'" (click)="openExtractedJsonTab()" id="ai-tab-extracted-json">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Extracted Json
              <span class="tab-badge" *ngIf="extractedItems.length > 0">{{ extractedItems.length }}</span>
            </button>
          </div>
          <div class="tab-bar-tools">
            <!-- Model selector -->
            <div class="model-selector" *ngIf="activeTab === 'chat'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/>
              </svg>
              <select [(ngModel)]="selectedModel" (ngModelChange)="saveModelSelection()" class="model-select" id="ai-model-select">
                <optgroup label="Azure AI Foundry (Backend)">
                  <option value="gpt-5.6-luna">gpt-5.6-luna (Foundry)</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </optgroup>
                <optgroup label="Google">
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </optgroup>
                <optgroup label="Anthropic">
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
          </div>
        </div>

        <!-- ==================== CHAT TAB ==================== -->
        <div class="tab-content" *ngIf="activeTab === 'chat'">
          <div class="chat-area" #chatArea>
            <!-- Empty State -->
            <div class="chat-empty" *ngIf="!currentSession || currentSession.messages.length === 0">
              <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <h3>Start a Conversation</h3>
              <p>Paste chat summaries, meeting transcripts, tabular/Excel data, or attach an Excel file (.xlsx, .csv) and the AI will extract key information to update your Work Tracker, projects, tasks, employees, and more.</p>
              <div class="example-prompts">
                <button class="example-prompt" (click)="useExamplePrompt('daily')" id="ai-example-daily">
                  📋 Daily Standup Summary
                </button>
                <button class="example-prompt" (click)="useExamplePrompt('excel')" id="ai-example-excel">
                  📊 Excel / Tabular Data
                </button>
                <button class="example-prompt" (click)="useExamplePrompt('transcript')" id="ai-example-transcript">
                  🎤 Meeting Transcript
                </button>
                <button class="example-prompt" (click)="useExamplePrompt('update')" id="ai-example-update">
                  📝 Team Update Email
                </button>
              </div>
            </div>

            <!-- Messages -->
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
                    📎 {{ msg.attachmentName }}
                  </div>
                  <div class="msg-content" [innerHTML]="formatMessage(msg.content)"></div>

                  <!-- Extraction Summary Card -->
                  <div class="extraction-summary-card" *ngIf="msg.extractionSummary">
                    <div class="summary-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                      Extraction Summary
                    </div>
                    <div class="summary-grid">
                      <div class="summary-item standup" *ngIf="msg.extractionSummary.standupNotes > 0">
                        <span class="summary-count">{{ msg.extractionSummary.standupNotes }}</span>
                        <span class="summary-label">Standup Notes</span>
                      </div>
                      <div class="summary-item employee" *ngIf="msg.extractionSummary.employees > 0">
                        <span class="summary-count">{{ msg.extractionSummary.employees }}</span>
                        <span class="summary-label">Employee</span>
                      </div>
                      <div class="summary-item project" *ngIf="msg.extractionSummary.projects > 0">
                        <span class="summary-count">{{ msg.extractionSummary.projects }}</span>
                        <span class="summary-label">Project</span>
                      </div>
                      <div class="summary-item task" *ngIf="msg.extractionSummary.tasks > 0">
                        <span class="summary-count">{{ msg.extractionSummary.tasks }}</span>
                        <span class="summary-label">Tasks</span>
                      </div>
                      <div class="summary-item leave" *ngIf="msg.extractionSummary.leaves > 0">
                        <span class="summary-count">{{ msg.extractionSummary.leaves }}</span>
                        <span class="summary-label">Leave</span>
                      </div>
                      <div class="summary-item reminder" *ngIf="msg.extractionSummary.reminders > 0">
                        <span class="summary-count">{{ msg.extractionSummary.reminders }}</span>
                        <span class="summary-label">Reminder</span>
                      </div>
                    </div>
                    <button class="view-extracted-btn" (click)="goToExtracted()">
                      View Extracted Information →
                    </button>
                  </div>

                  <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
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

          <!-- Input Area -->
          <div class="input-area">
            <div class="input-wrapper">
              <textarea
                #msgInput
                [(ngModel)]="messageText"
                placeholder="Type your message, paste chat summaries/Excel data, or attach an Excel file..."
                (keydown)="onKeydown($event)"
                rows="3"
                class="message-input"
                id="ai-message-input"
              ></textarea>
              <div class="input-actions">
                <label class="attach-btn" title="Attach Excel file (.xlsx, .xls, .csv) or text document">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  <input type="file" (change)="onFileAttach($event)" hidden accept=".xlsx,.xls,.csv,.txt,.md,.json" id="ai-file-attach-input" />
                </label>
                <button
                  class="send-btn"
                  (click)="sendMessage()"
                  [disabled]="!messageText.trim() || aiSvc.isProcessing()"
                  id="ai-send-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== EXTRACTED INFORMATION TAB ==================== -->
        <div class="tab-content extracted-tab" *ngIf="activeTab === 'extracted'">
          <div class="extracted-header" *ngIf="extractedItems.length > 0">
            <div class="extracted-header-left">
              <span class="items-count">{{ pendingCount }} items pending</span>
              <select [(ngModel)]="categoryFilter" class="category-filter" id="ai-category-filter">
                <option value="">All Categories ({{ extractedItems.length }})</option>
                <option value="weekly-status">Weekly Status ({{ getItemsByCategory('weekly-status').length }})</option>
                <option value="project-status">Project Status ({{ getItemsByCategory('project-status').length }})</option>
                <option value="work-log">Work Logs ({{ getItemsByCategory('work-log').length }})</option>
                <option value="standup">Standup Notes ({{ getItemsByCategory('standup').length }})</option>
                <option value="employee">Employees ({{ getItemsByCategory('employee').length }})</option>
                <option value="project">Projects ({{ getItemsByCategory('project').length }})</option>
                <option value="task">Tasks ({{ getItemsByCategory('task').length }})</option>
                <option value="leave">Leave ({{ getItemsByCategory('leave').length }})</option>
                <option value="reminder">Reminders ({{ getItemsByCategory('reminder').length }})</option>
                <option value="meeting">Meetings ({{ getItemsByCategory('meeting').length }})</option>
              </select>
            </div>
            <div class="extracted-header-actions">
              <button class="clear-extracted-btn" (click)="confirmClearExtracted()" id="ai-clear-extracted-btn" title="Clear extracted information for this session">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Clear Extracted
              </button>
              <button class="apply-all-btn" (click)="applyAllItems()" id="ai-apply-all-btn"
                [disabled]="isApplying || pendingCount === 0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                {{ isApplying ? 'Applying...' : 'Apply All to Work Tracker' }}
              </button>
            </div>
          </div>

          <!-- Empty extracted state -->
          <div class="extracted-empty" *ngIf="extractedItems.length === 0">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <h3>No Extracted Data Yet</h3>
            <p>Send a standup summary or meeting transcript in the Chat tab, and the AI will extract structured information here.</p>
            <button class="go-chat-btn" (click)="activeTab = 'chat'">Go to Chat →</button>
          </div>

          <!-- Apply success message -->
          <div class="apply-success" *ngIf="applySuccessMsg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {{ applySuccessMsg }}
          </div>

          <!-- Category Cards -->
          <div class="category-cards" *ngIf="extractedItems.length > 0">

            <!-- Weekly Status Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'weekly-status'">
              <div class="category-card weekly-card" *ngIf="getItemsByCategory('weekly-status').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">📊</span>
                    <span>Weekly Status ({{ getItemsByCategory('weekly-status').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('weekly-status')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('weekly-status')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">
                          <strong>{{ item.data['taskId'] || 'Task' }}</strong> - {{ item.data['taskTitle'] || item.data['title'] }}
                        </div>
                        <div class="item-sub">
                          👤 {{ item.data['resourceName'] || 'Unassigned' }} | 📁 {{ item.data['projectName'] || 'General' }} | 📅 {{ item.data['week'] || 'W1' }} | ⚡ {{ item.data['status'] || 'In Progress' }}
                        </div>
                      </div>
                      <div class="item-meta">
                        <span class="duplicate-badge" *ngIf="item.isExisting">Exists</span>
                        <span class="new-badge" *ngIf="!item.isExisting">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="duplicate-warning" *ngIf="item.isExisting">
                        ⚠️ A weekly task with ID {{ item.data['taskId'] }} or same resource/title/week already exists. Applying will update the existing task.
                      </div>
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Task ID</label>
                          <input [(ngModel)]="item.data['taskId']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Week</label>
                          <input [(ngModel)]="item.data['week']" (ngModelChange)="markEdited(item)" class="edit-input" placeholder="e.g. W1, W2" />
                        </div>
                        <div class="edit-field">
                          <label>Resource / Developer</label>
                          <input [(ngModel)]="item.data['resourceName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Project</label>
                          <input [(ngModel)]="item.data['projectName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Module</label>
                          <input [(ngModel)]="item.data['module']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Task Type</label>
                          <select [(ngModel)]="item.data['taskType']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Feature</option><option>Bug</option><option>Enhancement</option><option>Architecture</option><option>Documentation</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Status</label>
                          <select [(ngModel)]="item.data['status']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Completed</option><option>In Progress</option><option>Pending</option><option>Blocked</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Priority</label>
                          <select [(ngModel)]="item.data['priority']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Size / SP</label>
                          <select [(ngModel)]="item.data['size']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Hours</label>
                          <input type="number" [(ngModel)]="item.data['hours']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Progress (%)</label>
                          <input type="number" min="0" max="100" [(ngModel)]="item.data['progress']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Due Date</label>
                          <input type="date" [(ngModel)]="item.data['dueDate']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Task Title</label>
                          <input [(ngModel)]="item.data['taskTitle']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Description</label>
                          <textarea [(ngModel)]="item.data['taskDescription']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                        <div class="edit-field full-width">
                          <label>Comments / Remarks</label>
                          <input [(ngModel)]="item.data['comments']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                      </div>
                      <div class="source-context" *ngIf="item.sourceContext">💬 {{ item.sourceContext }}</div>
                      <div class="confidence-bar">
                        <span>Confidence:</span>
                        <div class="bar"><div class="fill" [style.width.%]="item.confidence"></div></div>
                        <span>{{ item.confidence }}%</span>
                      </div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Project Status Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'project-status'">
              <div class="category-card project-status-card" *ngIf="getItemsByCategory('project-status').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">🎯</span>
                    <span>Project Status / Release Tracks ({{ getItemsByCategory('project-status').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('project-status')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('project-status')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">
                          <strong>{{ item.data['id'] || 'Track' }}</strong> - {{ item.data['title'] }}
                        </div>
                        <div class="item-sub">
                          📦 {{ item.data['module'] || 'Core' }} | 👤 {{ item.data['assignedTo'] || 'Lead' }} | 🚀 {{ item.data['status'] || 'Development' }} ({{ item.data['progress'] || 0 }}%)
                        </div>
                      </div>
                      <div class="item-meta">
                        <span class="duplicate-badge" *ngIf="item.isExisting">Exists</span>
                        <span class="new-badge" *ngIf="!item.isExisting">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="duplicate-warning" *ngIf="item.isExisting">
                        ⚠️ A release track with ID {{ item.data['id'] }} or matching title/module already exists. Applying will update it.
                      </div>
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Track ID</label>
                          <input [(ngModel)]="item.data['id']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Category / Stream</label>
                          <input [(ngModel)]="item.data['category']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Module</label>
                          <input [(ngModel)]="item.data['module']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Type</label>
                          <select [(ngModel)]="item.data['type']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Feature</option><option>Enhancement</option><option>Refactor</option><option>Bugfix</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Priority</label>
                          <select [(ngModel)]="item.data['priority']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Status</label>
                          <select [(ngModel)]="item.data['status']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Released</option><option>Testing</option><option>Development</option><option>Staging</option><option>Backlog</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>PRD Status</label>
                          <select [(ngModel)]="item.data['prdStatus']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Approved</option><option>In Review</option><option>Draft</option><option>Pending</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Environment</label>
                          <select [(ngModel)]="item.data['environment']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Production</option><option>Beta</option><option>Staging</option><option>Dev</option><option>Alpha</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Assigned To</label>
                          <input [(ngModel)]="item.data['assignedTo']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Target Date</label>
                          <input type="date" [(ngModel)]="item.data['targetDate']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Progress (%)</label>
                          <input type="number" min="0" max="100" [(ngModel)]="item.data['progress']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Title</label>
                          <input [(ngModel)]="item.data['title']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Remarks / Notes</label>
                          <textarea [(ngModel)]="item.data['remarks']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                      </div>
                      <div class="source-context" *ngIf="item.sourceContext">💬 {{ item.sourceContext }}</div>
                      <div class="confidence-bar">
                        <span>Confidence:</span>
                        <div class="bar"><div class="fill" [style.width.%]="item.confidence"></div></div>
                        <span>{{ item.confidence }}%</span>
                      </div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Work Logs Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'work-log'">
              <div class="category-card work-log-card" *ngIf="getItemsByCategory('work-log').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">⏱️</span>
                    <span>Work Logs / Hourly Updates ({{ getItemsByCategory('work-log').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('work-log')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('work-log')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">
                          <strong>{{ item.data['hour'] || 'Hour' }}</strong> - {{ item.data['taskDescription'] }}
                        </div>
                        <div class="item-sub">
                          📅 {{ item.data['date'] }} | 📁 {{ item.data['projectName'] || 'Work Tracker' }} | ⚡ {{ item.data['status'] || 'Completed' }}
                        </div>
                      </div>
                      <div class="item-meta">
                        <span class="duplicate-badge" *ngIf="item.isExisting">Exists</span>
                        <span class="new-badge" *ngIf="!item.isExisting">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="duplicate-warning" *ngIf="item.isExisting">
                        ⚠️ An hourly work update for this time slot/description already exists. Applying will update it.
                      </div>
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Date</label>
                          <input type="date" [(ngModel)]="item.data['date']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Hour Slot</label>
                          <input [(ngModel)]="item.data['hour']" (ngModelChange)="markEdited(item)" class="edit-input" placeholder="e.g. 09:00 AM - 10:00 AM" />
                        </div>
                        <div class="edit-field">
                          <label>Project</label>
                          <input [(ngModel)]="item.data['projectName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Status</label>
                          <select [(ngModel)]="item.data['status']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option value="Completed">Completed</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </div>
                        <div class="edit-field full-width">
                          <label>Activity / Task Description</label>
                          <textarea [(ngModel)]="item.data['taskDescription']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                      </div>
                      <div class="source-context" *ngIf="item.sourceContext">💬 {{ item.sourceContext }}</div>
                      <div class="confidence-bar">
                        <span>Confidence:</span>
                        <div class="bar"><div class="fill" [style.width.%]="item.confidence"></div></div>
                        <span>{{ item.confidence }}%</span>
                      </div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Standup Notes Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'standup'">
              <div class="category-card standup-card" *ngIf="getItemsByCategory('standup').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">📋</span>
                    <span>Standup Notes ({{ getItemsByCategory('standup').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('standup')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('standup')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">{{ item.data['employeeName'] }} - {{ item.data['todayPlan'] | slice:0:60 }}{{ (item.data['todayPlan']?.length > 60) ? '...' : '' }}</div>
                        <div class="item-sub" *ngIf="item.data['blockers'] && item.data['blockers'] !== 'None'">
                          ⚠️ {{ item.data['blockers'] }}
                        </div>
                      </div>
                      <div class="item-meta">
                        <span class="item-date">{{ formatDateLabel(item.data['date']) }}</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Employee</label>
                          <input [(ngModel)]="item.data['employeeName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Date</label>
                          <input [(ngModel)]="item.data['date']" (ngModelChange)="markEdited(item)" class="edit-input" type="date" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Yesterday's Work</label>
                          <textarea [(ngModel)]="item.data['previousWork']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                        <div class="edit-field full-width">
                          <label>Today's Plan</label>
                          <textarea [(ngModel)]="item.data['todayPlan']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                        <div class="edit-field">
                          <label>Blockers</label>
                          <input [(ngModel)]="item.data['blockers']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Project</label>
                          <input [(ngModel)]="item.data['projectName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                      </div>
                      <div class="source-context">💬 {{ item.sourceContext }}</div>
                      <div class="confidence-bar">
                        <span>Confidence:</span>
                        <div class="bar"><div class="fill" [style.width.%]="item.confidence"></div></div>
                        <span>{{ item.confidence }}%</span>
                      </div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Employees Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'employee'">
              <div class="category-card employee-card" *ngIf="getItemsByCategory('employee').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">👥</span>
                    <span>Employees ({{ getItemsByCategory('employee').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('employee')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('employee')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">{{ item.data['name'] }}</div>
                        <div class="item-sub">{{ item.data['position'] }}</div>
                      </div>
                      <div class="item-meta">
                        <span class="duplicate-badge" *ngIf="item.isExisting">Exists</span>
                        <span class="new-badge" *ngIf="!item.isExisting">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="duplicate-warning" *ngIf="item.isExisting">
                        ⚠️ An employee with this name already exists. Applying will update the existing record.
                      </div>
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Name</label>
                          <input [(ngModel)]="item.data['name']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Position</label>
                          <input [(ngModel)]="item.data['position']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Team</label>
                          <input [(ngModel)]="item.data['team']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Email</label>
                          <input [(ngModel)]="item.data['email']" (ngModelChange)="markEdited(item)" class="edit-input" type="email" />
                        </div>
                      </div>
                      <div class="source-context">💬 {{ item.sourceContext }}</div>
                      <div class="confidence-bar">
                        <span>Confidence:</span>
                        <div class="bar"><div class="fill" [style.width.%]="item.confidence"></div></div>
                        <span>{{ item.confidence }}%</span>
                      </div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Projects Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'project'">
              <div class="category-card project-card" *ngIf="getItemsByCategory('project').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">🚀</span>
                    <span>Projects ({{ getItemsByCategory('project').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('project')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('project')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">{{ item.data['name'] }}</div>
                        <div class="item-sub">{{ item.data['notes'] | slice:0:60 }}{{ (item.data['notes']?.length > 60) ? '...' : '' }}</div>
                      </div>
                      <div class="item-meta">
                        <span class="duplicate-badge" *ngIf="item.isExisting">Exists</span>
                        <span class="new-badge" *ngIf="!item.isExisting">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="duplicate-warning" *ngIf="item.isExisting">
                        ⚠️ A project with this name already exists.
                      </div>
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Name</label>
                          <input [(ngModel)]="item.data['name']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Status</label>
                          <select [(ngModel)]="item.data['status']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>Active</option><option>On Hold</option><option>Completed</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Lead</label>
                          <input [(ngModel)]="item.data['lead']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Notes</label>
                          <textarea [(ngModel)]="item.data['notes']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                      </div>
                      <div class="source-context">💬 {{ item.sourceContext }}</div>
                      <div class="confidence-bar">
                        <span>Confidence:</span>
                        <div class="bar"><div class="fill" [style.width.%]="item.confidence"></div></div>
                        <span>{{ item.confidence }}%</span>
                      </div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Tasks Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'task'">
              <div class="category-card task-card" *ngIf="getItemsByCategory('task').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">✅</span>
                    <span>Tasks ({{ getItemsByCategory('task').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('task')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('task')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">{{ item.data['employeeName'] }} - {{ item.data['title'] }}</div>
                        <div class="item-sub" *ngIf="item.data['projectName']">{{ item.data['projectName'] }}</div>
                      </div>
                      <div class="item-meta">
                        <span class="item-date" *ngIf="item.data['endDate']">{{ formatDateLabel(item.data['endDate']) }}</span>
                        <span class="new-badge">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Title</label>
                          <input [(ngModel)]="item.data['title']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Assigned To</label>
                          <input [(ngModel)]="item.data['employeeName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Project</label>
                          <input [(ngModel)]="item.data['projectName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>End Date</label>
                          <input [(ngModel)]="item.data['endDate']" (ngModelChange)="markEdited(item)" class="edit-input" type="date" />
                        </div>
                      </div>
                      <div class="source-context">💬 {{ item.sourceContext }}</div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Leave Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'leave'">
              <div class="category-card leave-card" *ngIf="getItemsByCategory('leave').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">🏖️</span>
                    <span>Leave ({{ getItemsByCategory('leave').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('leave')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('leave')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">{{ item.data['employeeName'] }} - {{ item.data['reason'] | slice:0:50 }}{{ (item.data['reason']?.length > 50) ? '...' : '' }}</div>
                        <div class="item-sub">{{ item.data['fromDate'] }} → {{ item.data['toDate'] }}</div>
                      </div>
                      <div class="item-meta">
                        <span class="new-badge">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Employee</label>
                          <input [(ngModel)]="item.data['employeeName']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>From Date</label>
                          <input [(ngModel)]="item.data['fromDate']" (ngModelChange)="markEdited(item)" class="edit-input" type="date" />
                        </div>
                        <div class="edit-field">
                          <label>To Date</label>
                          <input [(ngModel)]="item.data['toDate']" (ngModelChange)="markEdited(item)" class="edit-input" type="date" />
                        </div>
                        <div class="edit-field">
                          <label>Leave Type</label>
                          <select [(ngModel)]="item.data['leaveType']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option value="planned">Planned</option>
                            <option value="unplanned">Unplanned</option>
                            <option value="sick">Sick</option>
                            <option value="vacation">Vacation</option>
                            <option value="wfh">WFH</option>
                          </select>
                        </div>
                        <div class="edit-field full-width">
                          <label>Reason</label>
                          <input [(ngModel)]="item.data['reason']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                      </div>
                      <div class="source-context">💬 {{ item.sourceContext }}</div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Reminders Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'reminder'">
              <div class="category-card reminder-card" *ngIf="getItemsByCategory('reminder').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">🔔</span>
                    <span>Reminders ({{ getItemsByCategory('reminder').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('reminder')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('reminder')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">{{ item.data['title'] }}</div>
                        <div class="item-sub" *ngIf="item.data['description']">{{ item.data['description'] | slice:0:60 }}{{ (item.data['description']?.length > 60) ? '...' : '' }}</div>
                      </div>
                      <div class="item-meta">
                        <span class="item-date" *ngIf="item.data['deadline']">{{ formatDateLabel(item.data['deadline']) }}</span>
                        <span class="duplicate-badge" *ngIf="item.isExisting">Exists</span>
                        <span class="new-badge" *ngIf="!item.isExisting">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="duplicate-warning" *ngIf="item.isExisting">
                        ⚠️ A reminder with this title already exists.
                      </div>
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Title</label>
                          <input [(ngModel)]="item.data['title']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Deadline</label>
                          <input [(ngModel)]="item.data['deadline']" (ngModelChange)="markEdited(item)" class="edit-input" type="date" />
                        </div>
                        <div class="edit-field">
                          <label>Priority</label>
                          <select [(ngModel)]="item.data['priority']" (ngModelChange)="markEdited(item)" class="edit-input">
                            <option>High</option><option>Medium</option><option>Low</option>
                          </select>
                        </div>
                        <div class="edit-field">
                          <label>Assigned To</label>
                          <input [(ngModel)]="item.data['assignedTo']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Description</label>
                          <textarea [(ngModel)]="item.data['description']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                      </div>
                      <div class="source-context">💬 {{ item.sourceContext }}</div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Meetings Card -->
            <ng-container *ngIf="!categoryFilter || categoryFilter === 'meeting'">
              <div class="category-card meeting-card" *ngIf="getItemsByCategory('meeting').length > 0">
                <div class="category-header">
                  <div class="category-title">
                    <span class="category-icon">📅</span>
                    <span>Meetings ({{ getItemsByCategory('meeting').length }})</span>
                  </div>
                  <button class="review-all-btn" (click)="approveCategory('meeting')">Review All</button>
                </div>
                <div class="extracted-items">
                  <div class="extracted-item" *ngFor="let item of getItemsByCategory('meeting')"
                    [class.approved]="item.status === 'approved'"
                    [class.rejected]="item.status === 'rejected'"
                    [class.applied]="item.status === 'applied'">
                    <div class="item-row">
                      <input type="checkbox"
                        [checked]="item.status === 'approved' || item.status === 'applied'"
                        (change)="toggleItem(item)"
                        [disabled]="item.status === 'applied'"
                        class="item-check" />
                      <div class="item-content">
                        <div class="item-main">{{ item.data['title'] }}</div>
                        <div class="item-sub">{{ item.data['date'] }} {{ item.data['time'] ? 'at ' + item.data['time'] : '' }}</div>
                      </div>
                      <div class="item-meta">
                        <span class="new-badge">New</span>
                        <span class="item-status-badge" [class]="'badge-' + item.status">{{ getStatusLabel(item.status) }}</span>
                      </div>
                      <button class="item-expand-btn" (click)="toggleExpandItem(item.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline [attr.points]="expandedItems.has(item.id) ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/>
                        </svg>
                      </button>
                    </div>
                    <div class="item-expanded" *ngIf="expandedItems.has(item.id)">
                      <div class="editable-fields">
                        <div class="edit-field">
                          <label>Title</label>
                          <input [(ngModel)]="item.data['title']" (ngModelChange)="markEdited(item)" class="edit-input" />
                        </div>
                        <div class="edit-field">
                          <label>Date</label>
                          <input [(ngModel)]="item.data['date']" (ngModelChange)="markEdited(item)" class="edit-input" type="date" />
                        </div>
                        <div class="edit-field">
                          <label>Time</label>
                          <input [(ngModel)]="item.data['time']" (ngModelChange)="markEdited(item)" class="edit-input" type="time" />
                        </div>
                        <div class="edit-field full-width">
                          <label>Description</label>
                          <textarea [(ngModel)]="item.data['description']" (ngModelChange)="markEdited(item)" class="edit-input" rows="2"></textarea>
                        </div>
                      </div>
                      <div class="source-context">💬 {{ item.sourceContext }}</div>
                      <div class="item-actions">
                        <button class="action-approve" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'approved')" *ngIf="item.status !== 'applied'">✓ Approve</button>
                        <button class="action-reject" (click)="aiSvc.updateItemStatus(currentSession!.id, item.id, 'rejected')" *ngIf="item.status !== 'applied'">✗ Reject</button>
                        <button class="action-apply" (click)="applyItem(item)" *ngIf="item.status !== 'applied'" [disabled]="isApplying">Apply</button>
                        <span class="applied-badge" *ngIf="item.status === 'applied'">✅ Applied</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

          </div>
        </div>

        <!-- ==================== EXTRACTED JSON TAB ==================== -->
        <div class="tab-content extracted-json-tab" *ngIf="activeTab === 'extracted-json'">
          <div class="json-header">
            <div class="json-header-left">
              <div class="json-title-row">
                <h3>Extracted JSON</h3>
                <span class="json-badge" [class.valid]="isJsonValid" [class.invalid]="!isJsonValid && extractedJsonText.trim().length > 0">
                  {{ jsonBadgeText }}
                </span>
              </div>
              <p class="json-subtitle">
                View, edit or paste extracted JSON data below. Click <strong>Update Extracted Info</strong> to load it into the Extracted Information section.
              </p>
            </div>
            <div class="json-actions">
              <button class="btn-json-action" (click)="formatJson()" title="Format and indent JSON" [disabled]="!extractedJsonText.trim()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>
                </svg>
                Format
              </button>
              <button class="btn-json-action" (click)="copyJson()" title="Copy JSON to clipboard" [disabled]="!extractedJsonText.trim()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {{ copyButtonText }}
              </button>
              <button class="btn-json-action" (click)="syncJsonFromSession()" title="Reload JSON from current extracted items">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Reload from Items
              </button>
              <button class="btn-json-action" (click)="loadSampleJson()" title="Load sample JSON template">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Sample Template
              </button>
              <button class="btn-json-action danger" (click)="clearJson()" title="Clear JSON content" [disabled]="!extractedJsonText.trim()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Clear
              </button>
              <button class="btn-json-update" (click)="updateExtractedFromJson()" [disabled]="!extractedJsonText.trim() || isUpdatingJson" id="ai-update-json-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                {{ isUpdatingJson ? 'Updating...' : 'Update Extracted Info' }}
              </button>
            </div>
          </div>

          <!-- Error message if invalid JSON -->
          <div class="json-alert error" *ngIf="jsonError">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ jsonError }}</span>
          </div>

          <!-- Success message -->
          <div class="json-alert success" *ngIf="jsonSuccessMsg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{{ jsonSuccessMsg }}</span>
          </div>

          <!-- JSON Editor Area -->
          <div class="json-editor-wrapper">
            <div class="editor-statusbar">
              <span class="file-tag">extracted-data.json</span>
              <span class="editor-stats">{{ jsonStatsText }}</span>
            </div>
            <textarea
              class="json-textarea"
              [(ngModel)]="extractedJsonText"
              (ngModelChange)="onJsonChange()"
              (keydown)="onJsonEditorKeydown($event)"
              placeholder="Paste extracted JSON here or edit the existing data...&#10;&#10;Example:&#10;{&#10;  &quot;items&quot;: [&#10;    {&#10;      &quot;category&quot;: &quot;standup&quot;,&#10;      &quot;data&quot;: { &quot;employeeName&quot;: &quot;John Doe&quot;, &quot;todayPlan&quot;: &quot;...&quot; }&#10;    }&#10;  ]&#10;}"
              spellcheck="false"
              id="ai-extracted-json-textarea"
            ></textarea>
          </div>

          <!-- Quick Schema Reference -->
          <div class="json-schema-guide">
            <button class="guide-toggle-btn" (click)="showSchemaGuide = !showSchemaGuide">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>{{ showSchemaGuide ? 'Hide Supported Categories & Schema Reference' : 'Show Supported Categories & Schema Reference' }}</span>
              <span class="arrow">{{ showSchemaGuide ? '▲' : '▼' }}</span>
            </button>
            <div class="guide-content" *ngIf="showSchemaGuide">
              <div class="category-pills">
                <div class="cat-pill"><strong>weekly-status:</strong> taskId, week, resourceName, projectName, module, taskTitle, taskType, status, priority, size, hours, progress, startDate, dueDate</div>
                <div class="cat-pill"><strong>project-status:</strong> id, title, category, module, type, priority, status, prdStatus, environment, assignedTo, targetDate, progress, remarks</div>
                <div class="cat-pill"><strong>work-log:</strong> id, date, hour, taskDescription, status, projectName</div>
                <div class="cat-pill"><strong>standup:</strong> employeeName, date, previousWork, todayPlan, blockers, notes, projectName</div>
                <div class="cat-pill"><strong>employee:</strong> name, position, team, email</div>
                <div class="cat-pill"><strong>project:</strong> name, status, notes, lead</div>
                <div class="cat-pill"><strong>task:</strong> title, employeeName, projectName, description, endDate, priority</div>
                <div class="cat-pill"><strong>leave:</strong> employeeName, fromDate, toDate, reason, leaveType, duration</div>
                <div class="cat-pill"><strong>reminder:</strong> title, description, deadline, priority, assignedTo</div>
                <div class="cat-pill"><strong>meeting:</strong> title, description, date, time, attendees</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== SETTINGS MODAL ==================== -->
      <div class="modal-overlay" *ngIf="showSettings" (click)="closeSettings($event)">
        <div class="settings-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>AI Assistant Settings</h2>
            <button class="modal-close" (click)="showSettings = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="settings-section">
              <label class="settings-label">AI Provider</label>
              <select [(ngModel)]="localConfig.provider" (ngModelChange)="onProviderChange()" class="settings-input" id="ai-provider-select">
                <option value="foundry">Azure AI Foundry (Backend Service)</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>
            <div class="settings-section">
              <label class="settings-label">Model</label>
              <select [(ngModel)]="localConfig.model" class="settings-input" id="ai-settings-model-select">
                <ng-container *ngIf="localConfig.provider === 'foundry'">
                  <option value="gpt-5.6-luna">gpt-5.6-luna (Foundry)</option>
                </ng-container>
                <ng-container *ngIf="localConfig.provider === 'openai'">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </ng-container>
                <ng-container *ngIf="localConfig.provider === 'gemini'">
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </ng-container>
                <ng-container *ngIf="localConfig.provider === 'anthropic'">
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                </ng-container>
              </select>
            </div>
            <div class="settings-section">
              <label class="settings-label">API Key</label>
              <div class="api-key-input-wrapper">
                <input
                  [type]="showApiKey ? 'text' : 'password'"
                  [(ngModel)]="localConfig.apiKey"
                  [placeholder]="localConfig.provider === 'foundry' ? 'Optional (uses backend API key if blank)' : 'Enter your API key...'"
                  class="settings-input"
                  id="ai-api-key-input"
                />
                <button class="toggle-visibility" (click)="showApiKey = !showApiKey" type="button">
                  {{ showApiKey ? '👁️' : '🙈' }}
                </button>
              </div>
              <p class="settings-hint">
                {{ localConfig.provider === 'foundry'
                  ? 'For Azure AI Foundry, the backend python service uses its configured API key automatically when this is blank.'
                  : 'Your API key is stored locally on your device.' }}
              </p>
            </div>
            <div class="settings-section">
              <label class="settings-label">System Instructions</label>
              <textarea
                [(ngModel)]="localConfig.systemInstructions"
                rows="8"
                class="settings-input"
                id="ai-system-instructions"
                placeholder="Enter system instructions for the AI..."
              ></textarea>
              <button class="reset-instructions-btn" (click)="resetSystemInstructions()">
                Reset to Default
              </button>
            </div>

            <!-- Data Management Section -->
            <div class="settings-section data-mgmt-section">
              <label class="settings-label">Data Management</label>
              <div class="data-mgmt-btns">
                <button class="btn-data-action" (click)="confirmClearExtracted()" [disabled]="extractedItems.length === 0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Clear Current Extracted Data ({{ extractedItems.length }})
                </button>
                <button class="btn-data-action danger" (click)="confirmClearAllHistory()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Clear All History & Extracted Data
                </button>
              </div>
              <p class="settings-hint danger-hint">Clearing history permanently removes all chat sessions and extracted items.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="showSettings = false">Cancel</button>
            <button class="btn-save" (click)="saveSettings()" id="ai-save-settings-btn">Save Settings</button>
          </div>
        </div>
      </div>

      <!-- ==================== HOW IT WORKS MODAL ==================== -->
      <div class="modal-overlay" *ngIf="showHowItWorks" (click)="showHowItWorks = false">
        <div class="how-it-works-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>How AI Assistant Works</h2>
            <button class="modal-close" (click)="showHowItWorks = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="hiw-steps">
              <div class="hiw-step">
                <div class="step-num">1</div>
                <div class="step-content">
                  <h3>Paste or Type</h3>
                  <p>Paste your standup meeting summary, transcript, or any team update into the chat input.</p>
                </div>
              </div>
              <div class="hiw-step">
                <div class="step-num">2</div>
                <div class="step-content">
                  <h3>AI Analyzes</h3>
                  <p>The AI extracts structured information: who did what, new projects, tasks, leave requests, and reminders.</p>
                </div>
              </div>
              <div class="hiw-step">
                <div class="step-num">3</div>
                <div class="step-content">
                  <h3>Review & Edit</h3>
                  <p>Switch to the "Extracted Information" tab. Review each item, edit fields if needed, and mark duplicates.</p>
                </div>
              </div>
              <div class="hiw-step">
                <div class="step-num">4</div>
                <div class="step-content">
                  <h3>Apply to U2Tools</h3>
                  <p>Approve items and click Apply to automatically save them to the correct modules (Standup Notes, Employees, Projects, etc.).</p>
                </div>
              </div>
            </div>
            <div class="hiw-note">
              <strong>Privacy:</strong> Your API key is stored locally on your device. Meeting transcripts are sent directly to the AI provider you choose (OpenAI, Gemini, or Anthropic).
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-save" (click)="showHowItWorks = false; showSettings = true">Configure API Key</button>
            <button class="btn-cancel" (click)="showHowItWorks = false">Got it</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    /* ── Shell Layout ── */
    .ai-assistant-shell {
      display: flex;
      height: 100%;
      min-height: 600px;
      background: var(--bg-primary);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border-color);
      font-family: var(--font-family);
    }

    /* ── Chat Sidebar ── */
    .chat-sidebar {
      width: 0;
      min-width: 0;
      overflow: hidden;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: width 0.25s ease, min-width 0.25s ease;
    }
    .chat-sidebar.open {
      width: 240px;
      min-width: 240px;
    }

    .new-chat-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 12px 8px;
      padding: 10px 14px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
      white-space: nowrap;
    }
    .new-chat-btn:hover { opacity: 0.9; transform: translateY(-1px); }

    .sidebar-search {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 12px 8px;
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    .search-icon { color: var(--text-secondary); flex-shrink: 0; }
    .search-input {
      border: none;
      background: none;
      outline: none;
      color: var(--text-primary);
      font-size: 0.82rem;
      width: 100%;
    }
    .search-input::placeholder { color: var(--text-tertiary); }

    .session-list {
      flex: 1;
      overflow-y: auto;
      padding: 0 8px;
    }

    .session-group-label {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 6px 4px;
    }

    .session-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
      position: relative;
    }
    .session-item:hover { background: var(--bg-tertiary); }
    .session-item:hover .session-actions { opacity: 1; }
    .session-item.active { background: var(--accent-surface); }
    .session-item.active .session-icon { color: var(--accent-primary); }

    .session-icon { color: var(--text-tertiary); flex-shrink: 0; }
    .session-info { flex: 1; min-width: 0; }
    .session-title {
      display: block;
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .session-date {
      display: block;
      font-size: 0.72rem;
      color: var(--text-tertiary);
    }

    .session-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .session-action-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 3px;
      border-radius: 4px;
      font-size: 0.75rem;
      line-height: 1;
    }
    .session-action-btn:hover { background: var(--bg-tertiary); }
    .session-action-btn.danger:hover { background: rgba(239,68,68,0.12); }

    .rename-input {
      width: 100%;
      border: 1px solid var(--accent-primary);
      border-radius: 4px;
      padding: 2px 4px;
      font-size: 0.82rem;
      background: var(--bg-secondary);
      color: var(--text-primary);
      outline: none;
    }

    .empty-history {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-tertiary);
      font-size: 0.82rem;
    }

    .sidebar-collapse-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border: none;
      border-top: 1px solid var(--border-color);
      background: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.8rem;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .sidebar-collapse-btn:hover { background: var(--bg-tertiary); }

    /* ── Main Content ── */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    /* ── Page Header ── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      gap: 12px;
      flex-shrink: 0;
    }

    .header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }

    .hamburger-sidebar-btn {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 6px;
      cursor: pointer;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
    }
    .hamburger-sidebar-btn:hover { background: var(--bg-tertiary); }

    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .title-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .page-title h1 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .page-title p {
      margin: 2px 0 0;
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    .header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

    .btn-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn-header:hover { background: var(--bg-tertiary); color: var(--text-primary); }
    .btn-header.btn-settings:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
    .btn-header.btn-danger-header {
      color: var(--danger);
      border-color: rgba(239, 68, 68, 0.25);
    }
    .btn-header.btn-danger-header:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--danger);
    }

    /* ── Tab Bar ── */
    .tab-bar-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 20px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
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
      gap: 6px;
      padding: 7px 16px;
      border: none;
      background: none;
      border-radius: 8px;
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
    }
    .tab-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
    .tab-btn.active {
      color: var(--accent-primary);
      background: var(--accent-surface);
      font-weight: 600;
    }

    .tab-bar-tools { display: flex; align-items: center; gap: 8px; }

    .model-selector {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-secondary);
      font-size: 0.82rem;
    }

    .model-select {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 5px 10px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.82rem;
      cursor: pointer;
      outline: none;
    }
    .model-select:focus { border-color: var(--accent-primary); }

    .api-key-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 0.78rem;
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all 0.15s;
    }
    .api-key-indicator.configured { border-color: var(--success); color: var(--success); }
    .api-key-indicator:hover { background: var(--bg-tertiary); }

    /* ── Tab Content ── */
    .tab-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Chat Area ── */
    .chat-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    /* Empty state */
    .chat-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 300px;
      text-align: center;
      color: var(--text-secondary);
    }
    .chat-empty h3 { margin: 12px 0 8px; font-size: 1.1rem; color: var(--text-primary); }
    .chat-empty p { margin: 0 0 20px; font-size: 0.88rem; max-width: 420px; line-height: 1.6; }
    .empty-icon { margin-bottom: 8px; }

    .example-prompts { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .example-prompt {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .example-prompt:hover { border-color: var(--accent-primary); color: var(--accent-primary); background: var(--accent-surface); }

    /* Messages */
    .messages { display: flex; flex-direction: column; gap: 16px; }

    .message {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      animation: fadeInUp 0.25s ease;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .user-message { flex-direction: row-reverse; }

    .msg-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }
    .user-avatar { background: var(--bg-tertiary); color: var(--text-secondary); }

    .msg-bubble {
      max-width: 80%;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .user-message .msg-bubble {
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      border-color: transparent;
    }

    .msg-attachment {
      font-size: 0.78rem;
      color: var(--text-tertiary);
      margin-bottom: 6px;
      padding: 4px 8px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      display: inline-block;
    }
    .user-message .msg-attachment { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.15); }

    .msg-content {
      font-size: 0.88rem;
      line-height: 1.6;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .user-message .msg-content { color: white; }

    .msg-time {
      font-size: 0.7rem;
      color: var(--text-tertiary);
      margin-top: 6px;
      text-align: right;
    }
    .user-message .msg-time { color: rgba(255,255,255,0.6); }

    /* Extraction Summary Card */
    .extraction-summary-card {
      margin-top: 12px;
      padding: 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
    }

    .summary-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 10px;
    }

    .summary-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      min-width: 70px;
    }
    .summary-item.standup { background: rgba(99,102,241,0.1); }
    .summary-item.employee { background: rgba(16,185,129,0.1); }
    .summary-item.project { background: rgba(239,68,68,0.1); }
    .summary-item.task { background: rgba(16,185,129,0.1); }
    .summary-item.leave { background: rgba(245,158,11,0.1); }
    .summary-item.reminder { background: rgba(245,158,11,0.1); }

    .summary-count {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--accent-primary);
    }
    .summary-label { font-size: 0.7rem; color: var(--text-secondary); }

    .view-extracted-btn {
      width: 100%;
      padding: 8px;
      border: 1px dashed var(--accent-primary);
      border-radius: 8px;
      background: var(--accent-surface);
      color: var(--accent-primary);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .view-extracted-btn:hover { background: var(--accent-primary); color: white; }

    /* Typing Indicator */
    .typing-indicator {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 4px 0;
    }
    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-primary);
      animation: typingBounce 1.2s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    /* Error Banner */
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: rgba(239,68,68,0.08);
      border-top: 1px solid rgba(239,68,68,0.2);
      color: var(--danger);
      font-size: 0.82rem;
      flex-shrink: 0;
    }
    .error-banner button {
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--danger);
      font-size: 1rem;
    }

    /* Input Area */
    .input-area {
      padding: 12px 20px 16px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-secondary);
      flex-shrink: 0;
    }

    .input-wrapper {
      border: 1.5px solid var(--border-color);
      border-radius: 12px;
      background: var(--bg-primary);
      transition: border-color 0.2s;
      overflow: hidden;
    }
    .input-wrapper:focus-within { border-color: var(--accent-primary); }

    .message-input {
      width: 100%;
      border: none;
      background: none;
      outline: none;
      padding: 12px 14px 8px;
      font-size: 0.88rem;
      color: var(--text-primary);
      resize: none;
      font-family: var(--font-family);
      line-height: 1.5;
    }
    .message-input::placeholder { color: var(--text-tertiary); }

    .input-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px 8px;
    }

    .attach-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }
    .attach-btn:hover { background: var(--bg-tertiary); color: var(--accent-primary); }

    .send-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .send-btn:hover:not(:disabled) { transform: scale(1.05); opacity: 0.9; }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Extracted Tab ── */
    .extracted-tab {
      overflow-y: auto;
      padding: 16px 20px;
    }

    .extracted-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .extracted-header-left { display: flex; align-items: center; gap: 12px; }
    .items-count { font-size: 0.82rem; color: var(--text-secondary); }

    .category-filter {
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.82rem;
      cursor: pointer;
      outline: none;
    }

    .apply-all-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .apply-all-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.9; }
    .apply-all-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .extracted-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      text-align: center;
      color: var(--text-secondary);
    }
    .extracted-empty h3 { margin: 12px 0 8px; color: var(--text-primary); }
    .extracted-empty p { margin: 0 0 20px; font-size: 0.88rem; max-width: 400px; }
    .go-chat-btn {
      padding: 8px 20px;
      background: var(--accent-surface);
      color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }

    .apply-success {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 8px;
      color: var(--success);
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 16px;
      animation: fadeInUp 0.3s ease;
    }

    .category-cards { display: flex; flex-direction: column; gap: 16px; }

    /* Category Cards */
    .category-card {
      border-radius: 12px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      overflow: hidden;
    }

    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .category-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-primary);
    }
    .category-icon { font-size: 1.1rem; }

    .review-all-btn {
      padding: 4px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: none;
      color: var(--accent-primary);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .review-all-btn:hover { background: var(--accent-surface); }

    /* Color-coded borders */
    .weekly-card { border-color: rgba(59,130,246,0.35); }
    .weekly-card .category-header { background: rgba(59,130,246,0.06); }
    .project-status-card { border-color: rgba(168,85,247,0.35); }
    .project-status-card .category-header { background: rgba(168,85,247,0.06); }
    .work-log-card { border-color: rgba(20,184,166,0.35); }
    .work-log-card .category-header { background: rgba(20,184,166,0.06); }
    .standup-card { border-color: rgba(99,102,241,0.3); }
    .standup-card .category-header { background: rgba(99,102,241,0.05); }
    .employee-card { border-color: rgba(16,185,129,0.3); }
    .employee-card .category-header { background: rgba(16,185,129,0.05); }
    .project-card { border-color: rgba(239,68,68,0.3); }
    .project-card .category-header { background: rgba(239,68,68,0.05); }
    .task-card { border-color: rgba(16,185,129,0.3); }
    .task-card .category-header { background: rgba(16,185,129,0.05); }
    .leave-card { border-color: rgba(245,158,11,0.3); }
    .leave-card .category-header { background: rgba(245,158,11,0.05); }
    .reminder-card { border-color: rgba(245,158,11,0.3); }
    .reminder-card .category-header { background: rgba(245,158,11,0.05); }
    .meeting-card { border-color: rgba(99,102,241,0.3); }
    .meeting-card .category-header { background: rgba(99,102,241,0.05); }

    /* Extracted Items */
    .extracted-items { padding: 8px; display: flex; flex-direction: column; gap: 4px; }

    .extracted-item {
      border-radius: 8px;
      border: 1px solid transparent;
      transition: all 0.15s;
      overflow: hidden;
    }
    .extracted-item:hover { border-color: var(--border-color); background: var(--bg-tertiary); }
    .extracted-item.approved { border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.04); }
    .extracted-item.rejected { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.04); opacity: 0.7; }
    .extracted-item.applied { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.04); }

    .item-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
    }

    .item-check {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--accent-primary);
      flex-shrink: 0;
    }

    .item-content { flex: 1; min-width: 0; }
    .item-main {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-sub { font-size: 0.76rem; color: var(--text-secondary); margin-top: 2px; }

    .item-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .item-date { font-size: 0.75rem; color: var(--text-tertiary); }

    .new-badge {
      padding: 2px 8px;
      background: rgba(99,102,241,0.12);
      color: var(--accent-primary);
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .duplicate-badge {
      padding: 2px 8px;
      background: rgba(245,158,11,0.12);
      color: var(--warning);
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .item-status-badge {
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .badge-pending { background: rgba(100,100,140,0.12); color: var(--text-secondary); }
    .badge-approved { background: rgba(16,185,129,0.12); color: var(--success); }
    .badge-rejected { background: rgba(239,68,68,0.12); color: var(--danger); }
    .badge-applied { background: rgba(99,102,241,0.12); color: var(--accent-primary); }

    .item-expand-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-tertiary);
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      transition: all 0.15s;
    }
    .item-expand-btn:hover { background: var(--bg-tertiary); color: var(--accent-primary); }

    /* Expanded Item */
    .item-expanded {
      padding: 0 12px 12px;
      animation: fadeInDown 0.2s ease;
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .duplicate-warning {
      padding: 8px 10px;
      background: rgba(245,158,11,0.1);
      border: 1px solid rgba(245,158,11,0.3);
      border-radius: 6px;
      font-size: 0.78rem;
      color: var(--warning);
      margin-bottom: 10px;
    }

    .editable-fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }
    .edit-field { display: flex; flex-direction: column; gap: 3px; }
    .edit-field.full-width { grid-column: 1 / -1; }
    .edit-field label { font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.4px; }
    .edit-input {
      padding: 6px 8px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 0.82rem;
      outline: none;
      font-family: var(--font-family);
      resize: vertical;
    }
    .edit-input:focus { border-color: var(--accent-primary); }

    .expanded-field { margin-bottom: 6px; font-size: 0.82rem; color: var(--text-secondary); display: flex; gap: 6px; }
    .expanded-field label { font-weight: 600; color: var(--text-primary); flex-shrink: 0; }

    .source-context {
      padding: 6px 10px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      font-size: 0.76rem;
      color: var(--text-secondary);
      font-style: italic;
      margin-bottom: 10px;
    }

    .confidence-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 0.76rem;
      color: var(--text-secondary);
    }
    .confidence-bar .bar {
      flex: 1;
      height: 4px;
      background: var(--border-color);
      border-radius: 2px;
      overflow: hidden;
    }
    .confidence-bar .fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
      border-radius: 2px;
      transition: width 0.5s ease;
    }

    .item-actions { display: flex; gap: 8px; align-items: center; }
    .action-approve, .action-reject, .action-apply {
      padding: 5px 14px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid;
      transition: all 0.15s;
    }
    .action-approve { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: var(--success); }
    .action-approve:hover { background: var(--success); color: white; }
    .action-reject { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: var(--danger); }
    .action-reject:hover { background: var(--danger); color: white; }
    .action-apply {
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      border-color: transparent;
      color: white;
      margin-left: auto;
    }
    .action-apply:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    .action-apply:disabled { opacity: 0.4; cursor: not-allowed; }

    .applied-badge { margin-left: auto; font-size: 0.82rem; color: var(--success); font-weight: 600; }

    /* ── Settings Modal ── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .settings-modal, .how-it-works-modal {
      background: var(--bg-secondary);
      border-radius: 16px;
      border: 1px solid var(--border-color);
      width: 100%;
      max-width: 560px;
      box-shadow: var(--shadow-lg);
      animation: slideUp 0.25s ease;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .modal-header h2 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); }
    .modal-close {
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      color: var(--text-tertiary);
      padding: 4px;
      border-radius: 6px;
    }
    .modal-close:hover { background: var(--bg-tertiary); }

    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .settings-section { margin-bottom: 18px; }
    .settings-label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .settings-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 0.85rem;
      outline: none;
      font-family: var(--font-family);
      box-sizing: border-box;
    }
    .settings-input:focus { border-color: var(--accent-primary); }
    .settings-hint { font-size: 0.75rem; color: var(--text-tertiary); margin: 6px 0 0; }

    .api-key-input-wrapper { position: relative; }
    .api-key-input-wrapper .settings-input { padding-right: 40px; }
    .toggle-visibility {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }

    .reset-instructions-btn {
      margin-top: 6px;
      padding: 5px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: none;
      color: var(--text-secondary);
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .reset-instructions-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }

    .btn-cancel {
      padding: 8px 18px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: none;
      color: var(--text-secondary);
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-cancel:hover { background: var(--bg-tertiary); }

    .btn-save {
      padding: 8px 18px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-save:hover { opacity: 0.9; transform: translateY(-1px); }

    /* How It Works */
    .hiw-steps { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
    .hiw-step { display: flex; gap: 14px; align-items: flex-start; }
    .step-num {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    .step-content h3 { margin: 0 0 4px; font-size: 0.9rem; color: var(--text-primary); }
    .step-content p { margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; }

    .hiw-note {
      padding: 12px 14px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .chat-sidebar.open { width: 200px; min-width: 200px; }
      .page-header { padding: 12px 14px 10px; }
      .page-title p { display: none; }
      .tab-bar-tools { flex-wrap: wrap; }
      .chat-area { padding: 14px; }
      .msg-bubble { max-width: 90%; }
      .extracted-tab { padding: 12px 14px; }
      .editable-fields { grid-template-columns: 1fr; }
      .extracted-json-tab { padding: 12px 14px; }
      .json-header { flex-direction: column; align-items: stretch; }
      .json-actions { justify-content: flex-start; }
    }

    /* ── Tab Badge ── */
    .tab-badge {
      font-size: 0.72rem;
      padding: 1px 6px;
      border-radius: 10px;
      background: var(--accent-surface);
      color: var(--accent-primary);
      font-weight: 600;
    }

    /* ── Extracted JSON Tab Styles ── */
    .extracted-json-tab {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      padding: 20px 24px;
      overflow-y: auto;
      box-sizing: border-box;
      gap: 12px;
    }

    .json-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .json-header-left {
      flex: 1;
      min-width: 250px;
    }

    .json-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }

    .json-title-row h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .json-subtitle {
      margin: 0;
      font-size: 0.82rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .json-badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }

    .json-badge.valid {
      background: rgba(16, 185, 129, 0.12);
      color: var(--success);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .json-badge.invalid {
      background: rgba(239, 68, 68, 0.12);
      color: var(--danger);
      border-color: rgba(239, 68, 68, 0.3);
    }

    .json-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-json-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-json-action:hover:not(:disabled) {
      background: var(--bg-tertiary);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .btn-json-action.danger:hover:not(:disabled) {
      border-color: var(--danger);
      color: var(--danger);
    }

    .btn-json-action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn-json-update {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
      transition: all 0.2s ease;
    }

    .btn-json-update:hover:not(:disabled) {
      opacity: 0.92;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
    }

    .btn-json-update:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .json-alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      animation: fadeIn 0.2s ease;
    }

    .json-alert.error {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--danger);
    }

    .json-alert.success {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
    }

    .json-editor-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 280px;
      background: #181926;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.2);
    }

    .editor-statusbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 14px;
      background: #1e2030;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.75rem;
      color: #a5adcb;
    }

    .file-tag {
      font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
      font-weight: 600;
      color: #8aadf4;
    }

    .editor-stats {
      font-size: 0.72rem;
      opacity: 0.85;
      font-family: monospace;
    }

    .json-textarea {
      flex: 1;
      width: 100%;
      min-height: 240px;
      box-sizing: border-box;
      padding: 14px 16px;
      border: none;
      outline: none;
      resize: vertical;
      background: transparent;
      color: #cad3f5;
      font-family: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace;
      font-size: 0.85rem;
      line-height: 1.6;
      tab-size: 2;
      white-space: pre;
      overflow-wrap: normal;
      overflow-x: auto;
    }

    .json-textarea:focus {
      background: rgba(255, 255, 255, 0.015);
    }

    .json-textarea::placeholder {
      color: #5b6078;
    }

    .json-schema-guide {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .guide-toggle-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 14px;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
    }

    .guide-toggle-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .guide-toggle-btn .arrow {
      margin-left: auto;
      font-size: 0.7rem;
    }

    .guide-content {
      padding: 10px 14px 12px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-tertiary);
    }

    .category-pills {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cat-pill {
      font-size: 0.76rem;
      color: var(--text-secondary);
      line-height: 1.4;
      font-family: monospace;
    }

    .cat-pill strong {
      color: var(--accent-primary);
      font-weight: 700;
    }

    /* ── Sidebar Clear All History Button ── */
    .sidebar-footer {
      padding: 8px 10px;
      border-top: 1px solid var(--border-color);
    }
    .clear-all-history-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 7px 10px;
      border-radius: 8px;
      background: none;
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: var(--danger);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      overflow: hidden;
    }
    .clear-all-history-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--danger);
    }

    /* ── Extracted Header Actions ── */
    .extracted-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .clear-extracted-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      background: none;
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: var(--danger);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .clear-extracted-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--danger);
    }

    /* ── Settings Data Management ── */
    .data-mgmt-section {
      border-top: 1px solid var(--border-color);
      padding-top: 16px;
      margin-top: 20px;
    }
    .data-mgmt-btns {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }
    .btn-data-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }
    .btn-data-action:hover:not(:disabled) {
      background: var(--bg-tertiary);
      border-color: var(--accent-primary);
    }
    .btn-data-action.danger {
      color: var(--danger);
      border-color: rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.05);
    }
    .btn-data-action.danger:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.12);
      border-color: var(--danger);
    }
    .btn-data-action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .danger-hint {
      color: var(--danger) !important;
      opacity: 0.85;
    }
  `],
})
export class AiAssistantComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatArea') chatAreaRef!: ElementRef;
  @ViewChild('msgInput') msgInputRef!: ElementRef;

  aiSvc = inject(AiAssistantService);
  standupSvc = inject(StandupNoteService);
  workTrackerSvc = inject(WorkTrackerService);

  activeTab: MainTab = 'chat';
  chatSidebarOpen = true;
  messageText = '';
  searchQuery = '';
  categoryFilter = '';
  isApplying = false;
  applySuccessMsg = '';
  showSettings = false;
  showHowItWorks = false;
  showApiKey = false;

  extractedJsonText = '';
  jsonError = '';
  jsonSuccessMsg = '';
  isUpdatingJson = false;
  showSchemaGuide = false;
  copyButtonText = 'Copy';

  sessions: ChatSession[] = [];
  pinnedSessions: ChatSession[] = [];
  historyGroups: HistoryGroup[] = [];
  expandedItems = new Set<string>();

  selectedModel: AiModel = 'gpt-4o';
  private renamingId: string | null = null;
  private subscription = new Subscription();
  private shouldScrollToBottom = false;
  private successTimeout: any = null;

  localConfig = { ...this.aiSvc.config() };

  ngOnInit() {
    this.subscription.add(
      this.aiSvc.sessions$.subscribe((sessions) => {
        this.sessions = sessions;
        this.rebuildHistoryGroups(sessions);
        this.pinnedSessions = sessions.filter((s) => s.pinned)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        this.shouldScrollToBottom = true;
        // Keep JSON in sync if empty on JSON tab
        if (this.activeTab === 'extracted-json' && !this.extractedJsonText.trim()) {
          this.syncJsonFromSession();
        }
      })
    );

    // Select first session if exists
    if (this.sessions.length > 0 && !this.aiSvc.activeSessionId()) {
      this.aiSvc.setActiveSession(this.sessions[0].id);
    }

    // Load model from config
    const cfg = this.aiSvc.config();
    this.selectedModel = cfg.model;
    this.localConfig = { ...cfg };
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
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  get currentSession(): ChatSession | null {
    return this.aiSvc.activeSession;
  }

  get hasApiKey(): boolean {
    return this.aiSvc.config().provider === 'foundry' || !!this.aiSvc.config().apiKey;
  }

  get extractedItems(): ExtractedItem[] {
    return this.currentSession?.extractedData?.items ?? [];
  }

  get pendingCount(): number {
    return this.extractedItems.filter((i) => i.status === 'pending' || i.status === 'approved').length;
  }

  getItemsByCategory(cat: string): ExtractedItem[] {
    return this.extractedItems.filter((i) => i.category === cat);
  }

  // ── Session Management ────────────────────────────────────────────────────

  newChat() {
    this.aiSvc.createNewSession();
    this.activeTab = 'chat';
    this.extractedJsonText = '';
    this.jsonError = '';
    this.jsonSuccessMsg = '';
  }

  selectSession(id: string) {
    this.aiSvc.setActiveSession(id);
    this.activeTab = 'chat';
    this.shouldScrollToBottom = true;
    this.syncJsonFromSession();
  }

  confirmDelete(id: string) {
    if (confirm('Delete this chat? This action cannot be undone.')) {
      this.aiSvc.deleteSession(id);
    }
  }

  confirmClearAllHistory() {
    if (
      confirm(
        'Are you sure you want to delete ALL chat history and extracted information?\n\nThis will permanently remove all conversations and extracted items. This action cannot be undone.'
      )
    ) {
      this.aiSvc.clearAllSessions();
      this.extractedJsonText = '';
      this.jsonError = '';
      this.jsonSuccessMsg = '';
      this.categoryFilter = '';
      this.activeTab = 'chat';
      if (this.showSettings) {
        this.showSettings = false;
      }
      this.showSuccess('All chat history and extracted information have been cleared.');
    }
  }

  confirmClearExtracted() {
    if (!this.currentSession || this.extractedItems.length === 0) return;
    if (
      confirm(
        `Are you sure you want to clear all ${this.extractedItems.length} extracted items from the current conversation?`
      )
    ) {
      this.aiSvc.clearSessionExtractedData(this.currentSession.id);
      this.extractedJsonText = '';
      this.jsonError = '';
      this.jsonSuccessMsg = '';
      this.categoryFilter = '';
      if (this.showSettings) {
        this.showSettings = false;
      }
      this.showSuccess('Extracted information has been cleared.');
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

  private rebuildHistoryGroups(sessions: ChatSession[]) {
    const unpinned = sessions.filter((s) => !s.pinned);
    const now = new Date();
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const thisWeek: ChatSession[] = [];
    const older: ChatSession[] = [];

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

  // ── Chat ──────────────────────────────────────────────────────────────────

  async sendMessage() {
    const text = this.messageText.trim();
    if (!text || this.aiSvc.isProcessing()) return;
    this.messageText = '';
    this.shouldScrollToBottom = true;
    await this.aiSvc.sendMessage(text, this.attachedFileName || undefined);
    this.attachedFileName = '';
  }

  private attachedFileName = '';

  onFileAttach(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.attachedFileName = file.name;
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetContents: string[] = [];

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const tsv = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
            if (tsv && tsv.trim()) {
              sheetContents.push(`=== Sheet: ${sheetName} ===\n${tsv.trim()}`);
            }
          });

          const fullContent = sheetContents.join('\n\n');
          this.messageText = `[File: ${file.name}]\n\n${fullContent}`;
        } catch (err: any) {
          alert(`Error reading Excel file: ${err.message || 'Unknown error'}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          this.messageText = `[File: ${file.name}]\n\n${content}`;
        }
      };
      reader.readAsText(file);
    }

    input.value = '';
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  useExamplePrompt(type: 'daily' | 'transcript' | 'update' | 'excel') {
    const today = new Date().toISOString().split('T')[0];
    const prompts: Record<string, string> = {
      excel: `=== Sheet: Weekly Tasks ===
TaskId\tWeek\tResource\tProject\tModule\tTask Title\tStatus\tPriority\tSize\tHours\tProgress\tDue Date
T-101\tW1\tAlex Morgan\tU2App\tDashboard\tImplement AI Excel Analysis Engine\tIn Progress\tCritical\tL\t8\t75\t${today}
T-102\tW1\tTaylor Reed\tPortal\tAuth\tOAuth2 Refresh Token Fix\tCompleted\tHigh\tM\t6\t100\t${today}

=== Sheet: Hourly Updates ===
Date\tHour\tProject\tStatus\tTask Description
${today}\t09:00 AM - 10:00 AM\tWork Tracker\tCompleted\tSprint standup review and Excel parsing architecture
${today}\t10:00 AM - 11:00 AM\tWork Tracker\tIn Progress\tAI assistant component integration and duplicate checking`,

      daily: `Daily Standup - ${new Date().toLocaleDateString()}

Alice: Yesterday I completed the login API integration for Customer Portal v2. Today I'll work on dashboard filters. No blockers.

Bob: Yesterday I completed the deployment to staging. Today I'll monitor stability. No blockers.

Priya: She'll be on leave tomorrow for personal work.

We also discussed adding a new employee Rahul who will join next week as a Frontend Developer.

Arjan mentioned a new project "Mobile App for Field Agents". He will handle initial setup and needs a designer.

Follow up: API contract delay from backend team needs to be resolved.`,

      transcript: `Team Sync Recording - May 31, 2026

[10:24 AM] Nisha: Good morning everyone! So yesterday I finished the login API integration in Customer Portal v2. It was a bit tricky but got it done. Today I'm working on the dashboard filters. One blocker - the backend team hasn't finalized the API contract yet, so I might be blocked by EOD.

[10:26 AM] Arjun: Hi team! I completed the deployment to staging yesterday. Everything looks stable so today I'm monitoring it. Also, I wanted to bring up a new project idea - Mobile App for Field Agents. I can handle the initial setup but we need a designer.

[10:28 AM] Bob: Hey! Yesterday I completed the deployment monitoring setup. Today I'll continue with stability checks.

[10:30 AM] Manager: Also, Priya informed me she'll be on leave tomorrow June 1st for personal reasons. And we have a new team member joining - Rahul, he'll be our Frontend Developer starting next week.`,

      update: `Team Update Email

Subject: Weekly Team Summary

Hi all,

Quick update from this week:
- Alice has completed the login module for Customer Portal v2 and is working on dashboard features
- Bob deployed to staging successfully - monitoring in progress
- Arjun is kicking off the new Mobile App for Field Agents project
- Priya will be out on personal leave June 1-2
- New hire: Rahul joins as Frontend Developer on June 7
- Reminder: Follow up on the API contract issue with backend team by end of week`,
    };

    this.messageText = prompts[type];
    if (this.msgInputRef) {
      this.msgInputRef.nativeElement.focus();
    }
  }

  goToExtracted() {
    this.activeTab = 'extracted';
    this.runDuplicateCheck();
  }

  formatMessage(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatSessionDate(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return this.formatTime(iso);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  formatDateLabel(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private scrollToBottom() {
    try {
      if (this.chatAreaRef) {
        const el = this.chatAreaRef.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    } catch (e) {}
  }

  // ── Extracted Items ───────────────────────────────────────────────────────

  runDuplicateCheck() {
    if (!this.currentSession) return;
    const state = this.standupSvc.state;
    const wtData = this.workTrackerSvc.currentData;
    this.aiSvc.markDuplicates(this.currentSession.id, {
      employees: state.employees,
      projects: state.projects,
      reminders: state.reminders,
      developerTasks: wtData?.developerTasks || [],
      releaseTracks: wtData?.releaseTracks || [],
      hourlyUpdates: wtData?.hourlyUpdates || [],
      tasks: state.tasks || [],
      leaveRecords: state.leaveRecords || [],
    });
  }

  toggleItem(item: ExtractedItem) {
    if (!this.currentSession) return;
    const newStatus: ExtractedItem['status'] =
      item.status === 'pending' || item.status === 'rejected' ? 'approved' : 'pending';
    this.aiSvc.updateItemStatus(this.currentSession.id, item.id, newStatus);
  }

  toggleExpandItem(id: string) {
    if (this.expandedItems.has(id)) {
      this.expandedItems.delete(id);
    } else {
      this.expandedItems.add(id);
    }
  }

  approveCategory(category: string) {
    if (!this.currentSession) return;
    this.getItemsByCategory(category).forEach((item) => {
      if (item.status === 'pending') {
        this.aiSvc.updateItemStatus(this.currentSession!.id, item.id, 'approved');
      }
    });
  }

  markEdited(item: ExtractedItem) {
    item.edited = true;
  }

  async applyItem(item: ExtractedItem) {
    if (!this.currentSession || this.isApplying) return;
    this.isApplying = true;
    try {
      await this.applyExtractedItem(item);
      this.aiSvc.updateItemStatus(this.currentSession.id, item.id, 'applied');
      this.showSuccess(`Applied: ${this.getItemLabel(item)}`);
    } catch (e: any) {
      alert(`Failed to apply item: ${e.message}`);
    } finally {
      this.isApplying = false;
    }
  }

  async applyAllItems() {
    if (!this.currentSession || this.isApplying) return;
    const toApply = this.extractedItems.filter(
      (i) => (['pending', 'approved'] as string[]).includes(i.status)
    );
    if (toApply.length === 0) return;

    this.isApplying = true;
    let applied = 0;
    const errors: string[] = [];

    for (const item of toApply) {
      try {
        await this.applyExtractedItem(item);
        this.aiSvc.updateItemStatus(this.currentSession.id, item.id, 'applied');
        applied++;
      } catch (e: any) {
        errors.push(`${this.getItemLabel(item)}: ${e.message}`);
      }
    }

    this.isApplying = false;

    if (errors.length > 0) {
      alert(`Applied ${applied} items.\n\nFailed:\n${errors.join('\n')}`);
    } else {
      this.showSuccess(`Successfully applied ${applied} items to Work Tracker & Standup!`);
    }
  }

  private async applyExtractedItem(item: ExtractedItem): Promise<void> {
    const svc = this.standupSvc;
    const state = svc.state;
    const d = item.data;

    switch (item.category) {
      case 'weekly-status': {
        const wtData = this.workTrackerSvc.currentData;
        const tasks = wtData?.developerTasks || [];
        const taskId = d['taskId'] ? String(d['taskId']).trim() : '';

        const existing = tasks.find((t) => {
          if (taskId && t.taskId?.toLowerCase() === taskId.toLowerCase()) return true;
          const sameRes = t.resourceName?.toLowerCase() === d['resourceName']?.toLowerCase();
          const sameTitle = t.taskTitle?.toLowerCase() === (d['taskTitle'] || d['title'])?.toLowerCase();
          const sameWeek = !d['week'] || t.week?.toLowerCase() === d['week']?.toLowerCase();
          return sameRes && sameTitle && sameWeek;
        });

        const rawHours = typeof d['hours'] === 'number' ? d['hours'] : parseFloat(d['hours']);
        const rawProgress = typeof d['progress'] === 'number' ? d['progress'] : parseFloat(d['progress']);

        const taskPayload: Omit<DeveloperTask, 'taskId'> & { taskId?: string } = {
          taskId: existing ? existing.taskId : (taskId || `T-${Date.now().toString().slice(-4)}`),
          week: d['week'] || 'W1',
          resourceName: d['resourceName'] || 'Team Member',
          projectName: d['projectName'] || 'Work Tracker',
          module: d['module'] || 'General',
          taskTitle: d['taskTitle'] || d['title'] || 'Weekly Task',
          taskDescription: d['taskDescription'] || d['description'] || d['taskTitle'] || '',
          taskType: d['taskType'] || 'Feature',
          status: d['status'] || 'In Progress',
          priority: d['priority'] || 'Medium',
          size: d['size'] || 'M',
          hours: isNaN(rawHours) ? 8 : rawHours,
          progress: isNaN(rawProgress) ? 0 : Math.min(100, Math.max(0, rawProgress)),
          startDate: d['startDate'] || new Date().toISOString().split('T')[0],
          dueDate: d['dueDate'] || d['targetDate'] || new Date().toISOString().split('T')[0],
          completedDate: d['completedDate'] || (d['status'] === 'Completed' ? new Date().toISOString().split('T')[0] : ''),
          tags: d['tags'] || '',
          comments: d['comments'] || d['remarks'] || '',
          isVisible: true,
        };

        if (existing) {
          this.workTrackerSvc.updateDeveloperTask(existing.taskId, taskPayload);
        } else {
          this.workTrackerSvc.addDeveloperTask(taskPayload);
        }
        break;
      }

      case 'project-status': {
        const wtData = this.workTrackerSvc.currentData;
        const tracks = wtData?.releaseTracks || [];
        const trackId = d['id'] ? String(d['id']).trim() : '';

        const existing = tracks.find((r) => {
          if (trackId && r.id?.toLowerCase() === trackId.toLowerCase()) return true;
          const sameTitle = r.title?.toLowerCase() === d['title']?.toLowerCase();
          const sameModule = !d['module'] || r.module?.toLowerCase() === d['module']?.toLowerCase();
          return sameTitle && sameModule;
        });

        const rawProgress = typeof d['progress'] === 'number' ? d['progress'] : parseFloat(d['progress']);

        const trackPayload: Omit<ReleaseTrack, 'id'> & { id?: string } = {
          id: existing ? existing.id : (trackId || `R-${Date.now().toString().slice(-4)}`),
          title: d['title'] || 'Release Track',
          category: d['category'] || 'Platform',
          module: d['module'] || 'Core',
          type: d['type'] || 'Feature',
          priority: d['priority'] || 'High',
          status: d['status'] || 'Development',
          prdStatus: d['prdStatus'] || 'Approved',
          environment: d['environment'] || 'Staging',
          assignedTo: d['assignedTo'] || d['lead'] || 'Lead',
          createdDate: d['createdDate'] || new Date().toISOString().split('T')[0],
          targetDate: d['targetDate'] || d['dueDate'] || new Date().toISOString().split('T')[0],
          completedDate: d['completedDate'] || (d['status'] === 'Released' ? new Date().toISOString().split('T')[0] : ''),
          progress: isNaN(rawProgress) ? 0 : Math.min(100, Math.max(0, rawProgress)),
          remarks: d['remarks'] || d['notes'] || '',
          sourceSheet: d['sourceSheet'] || 'AI Import',
          dependency: d['dependency'] || '',
          tags: d['tags'] || '',
          isVisible: true,
        };

        if (existing) {
          this.workTrackerSvc.updateReleaseTrack(existing.id, trackPayload);
        } else {
          this.workTrackerSvc.addReleaseTrack(trackPayload);
        }
        break;
      }

      case 'work-log': {
        const wtData = this.workTrackerSvc.currentData;
        const updates = wtData?.hourlyUpdates || [];
        const updateId = d['id'] ? String(d['id']).trim() : '';

        const existing = updates.find((h) => {
          if (updateId && h.id?.toLowerCase() === updateId.toLowerCase()) return true;
          return (
            h.date === d['date'] &&
            h.hour === d['hour'] &&
            h.taskDescription?.toLowerCase() === (d['taskDescription'] || d['description'])?.toLowerCase()
          );
        });

        const updatePayload: Omit<HourlyWorkUpdate, 'id'> & { id?: string } = {
          id: existing ? existing.id : (updateId || `HU-${Date.now().toString().slice(-4)}-${updates.length + 1}`),
          date: d['date'] || new Date().toISOString().split('T')[0],
          hour: d['hour'] || '09:00 AM - 10:00 AM',
          taskDescription: d['taskDescription'] || d['description'] || 'Work activity',
          status: (d['status'] as HourlyUpdateStatus) || 'Completed',
          isVisible: true,
        };

        if (existing) {
          this.workTrackerSvc.updateHourlyUpdate(existing.id, updatePayload);
        } else {
          this.workTrackerSvc.addHourlyUpdate(updatePayload);
        }
        break;
      }

      case 'standup': {
        // Find employee by name
        const emp = state.employees.find(
          (e) => e.name.toLowerCase() === d['employeeName']?.toLowerCase()
        );
        if (!emp) throw new Error(`Employee "${d['employeeName']}" not found. Add them first.`);

        const proj = state.projects.find(
          (p) => p.name.toLowerCase() === d['projectName']?.toLowerCase()
        );

        const note: StandupNote = {
          id: svc.generateId('SN', state.standupNotes),
          employeeId: emp.id,
          date: d['date'] || new Date().toISOString().split('T')[0],
          previousWork: d['previousWork'] || '',
          todayPlan: d['todayPlan'] || '',
          blockers: d['blockers'] || 'None',
          notes: d['notes'] || '',
          projectId: proj?.id,
        };
        svc.addNote(note);
        break;
      }

      case 'employee': {
        if (item.isExisting && item.existingId) {
          const existing = state.employees.find((e) => e.id === item.existingId);
          if (existing) {
            svc.updateEmployee({ ...existing, ...d, id: existing.id });
          }
        } else {
          const emp: Employee = {
            id: svc.generateId('EMP', state.employees),
            name: d['name'] || '',
            position: d['position'] || '',
            team: d['team'] || '',
            email: d['email'] || '',
          };
          svc.addEmployee(emp);
        }
        break;
      }

      case 'project': {
        if (item.isExisting && item.existingId) {
          const existing = state.projects.find((p) => p.id === item.existingId);
          if (existing) {
            svc.updateProject({
              ...existing,
              name: d['name'] || existing.name,
              status: d['status'] || existing.status,
              notes: d['notes'] || existing.notes,
              lead: d['lead'] || existing.lead,
            });
          }
        } else {
          const proj: Project = {
            id: svc.generateId('PRJ', state.projects),
            name: d['name'] || '',
            status: (d['status'] as any) || 'Active',
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            notes: d['notes'] || '',
            lead: d['lead'] || '',
          };
          svc.addProject(proj);
        }
        break;
      }

      case 'task': {
        const existingTask = (state.tasks || []).find(
          (t) => t.title?.toLowerCase() === d['title']?.toLowerCase() &&
                 (!d['employeeName'] || t.employeeName?.toLowerCase() === d['employeeName']?.toLowerCase())
        );
        if (existingTask) {
          svc.updateTask({
            ...existingTask,
            title: d['title'] || existingTask.title,
            description: d['description'] || existingTask.description,
            endDate: d['endDate'] || existingTask.endDate,
            priority: (d['priority'] as any) || existingTask.priority,
            employeeName: d['employeeName'] || existingTask.employeeName,
            projectName: d['projectName'] || existingTask.projectName,
          });
        } else {
          const task: Task = {
            id: svc.generateId('TSK', state.tasks || []),
            title: d['title'] || '',
            tag: 'AI',
            description: d['description'] || '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: d['endDate'] || '',
            progress: 'Not Started',
            priority: (d['priority'] as any) || 'important-not-urgent',
            column: 'not-taken',
            employeeName: d['employeeName'] || '',
            projectName: d['projectName'] || '',
          };
          svc.addTask(task);
        }
        break;
      }

      case 'leave': {
        const emp = state.employees.find(
          (e) => e.name.toLowerCase() === d['employeeName']?.toLowerCase()
        );
        if (!emp) throw new Error(`Employee "${d['employeeName']}" not found. Add them first.`);

        const existingLeave = (state.leaveRecords || []).find(
          (l) => l.employeeId === emp.id && l.fromDate === d['fromDate']
        );
        if (existingLeave) {
          svc.updateLeave({
            ...existingLeave,
            toDate: d['toDate'] || existingLeave.toDate,
            leaveType: (d['leaveType'] as any) || existingLeave.leaveType,
            duration: (d['duration'] as any) || existingLeave.duration,
            reason: d['reason'] || existingLeave.reason,
            notes: d['notes'] || existingLeave.notes,
          });
        } else {
          const leave: LeaveRecord = {
            id: svc.generateId('LV', state.leaveRecords || []),
            employeeId: emp.id,
            fromDate: d['fromDate'] || new Date().toISOString().split('T')[0],
            toDate: d['toDate'] || d['fromDate'] || new Date().toISOString().split('T')[0],
            duration: (d['duration'] as any) || 'full-day',
            leaveType: (d['leaveType'] as any) || 'planned',
            reason: d['reason'] || '',
            notes: d['notes'] || '',
            status: 'Pending',
          };
          svc.addLeave(leave);
        }
        break;
      }

      case 'reminder': {
        if (item.isExisting) {
          // skip duplicate reminders
          return;
        }
        const reminder: Reminder = {
          id: svc.generateId('REM', state.reminders),
          title: d['title'] || '',
          description: d['description'] || '',
          deadline: d['deadline'] || '',
          priority: (d['priority'] as any) || 'Medium',
          assignedTo: d['assignedTo'] || '',
          done: false,
        };
        svc.addReminder(reminder);
        break;
      }

      case 'meeting': {
        // Save as calendar event
        const cats = state.calendarCategories || [];
        const meetingCat = cats.find((c) => c.name.toLowerCase() === 'meeting');
        const catId = meetingCat?.id || cats[0]?.id || 'CAT-001';

        svc.addCalendarEvent({
          id: svc.generateId('EVT', state.calendarEvents || []),
          title: d['title'] || '',
          description: d['description'] || '',
          date: d['date'] || new Date().toISOString().split('T')[0],
          time: d['time'],
          categoryId: catId,
        });
        break;
      }
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'applied': return 'Applied';
      default: return status;
    }
  }

  private getItemLabel(item: ExtractedItem): string {
    const d = item.data;
    switch (item.category) {
      case 'weekly-status': return `Weekly Task: ${d['taskTitle'] || d['taskId'] || 'Task'}`;
      case 'project-status': return `Project Status: ${d['title'] || d['id'] || 'Track'}`;
      case 'work-log': return `Work Log: ${d['hour'] || d['date']} - ${d['taskDescription'] || 'Activity'}`;
      case 'standup': return `Standup: ${d['employeeName']}`;
      case 'employee': return `Employee: ${d['name']}`;
      case 'project': return `Project: ${d['name']}`;
      case 'task': return `Task: ${d['title']}`;
      case 'leave': return `Leave: ${d['employeeName']}`;
      case 'reminder': return `Reminder: ${d['title']}`;
      case 'meeting': return `Meeting: ${d['title']}`;
      default: return item.category;
    }
  }

  private showSuccess(msg: string) {
    this.applySuccessMsg = msg;
    if (this.successTimeout) clearTimeout(this.successTimeout);
    this.successTimeout = setTimeout(() => (this.applySuccessMsg = ''), 4000);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  onProviderChange() {
    const defaults: Record<string, AiModel> = {
      foundry: 'gpt-5.6-luna',
      openai: 'gpt-4o',
      gemini: 'gemini-2.0-flash',
      anthropic: 'claude-3-5-sonnet-20241022',
    };
    this.localConfig.model = defaults[this.localConfig.provider] || 'gpt-5.6-luna';
  }

  saveModelSelection() {
    this.aiSvc.updateConfig({ model: this.selectedModel });
  }

  saveSettings() {
    this.aiSvc.updateConfig({ ...this.localConfig });
    this.selectedModel = this.localConfig.model;
    this.showSettings = false;
  }

  closeSettings(event: MouseEvent) {
    this.showSettings = false;
  }

  resetSystemInstructions() {
    this.localConfig.systemInstructions = this.aiSvc.getDefaultSystemInstructions();
  }

  // ── Extracted JSON Tab Support ─────────────────────────────────────────────

  get isJsonValid(): boolean {
    if (!this.extractedJsonText.trim()) return false;
    try {
      JSON.parse(this.extractedJsonText);
      return true;
    } catch {
      return false;
    }
  }

  get jsonBadgeText(): string {
    if (!this.extractedJsonText.trim()) return 'Empty';
    try {
      const parsed = JSON.parse(this.extractedJsonText);
      let count = 0;
      if (Array.isArray(parsed)) count = parsed.length;
      else if (parsed && Array.isArray(parsed.items)) count = parsed.items.length;
      else if (parsed && typeof parsed === 'object') count = 1;
      return `✓ Valid JSON (${count} item${count === 1 ? '' : 's'})`;
    } catch {
      return '⚠️ Syntax Error';
    }
  }

  get jsonStatsText(): string {
    const text = this.extractedJsonText;
    const lines = text ? text.split('\n').length : 0;
    const chars = text.length;
    return `${lines} lines, ${chars} chars`;
  }

  openExtractedJsonTab() {
    this.activeTab = 'extracted-json';
    if (!this.extractedJsonText.trim()) {
      this.syncJsonFromSession();
    } else {
      this.validateJsonInput();
    }
  }

  syncJsonFromSession() {
    const current = this.currentSession;
    if (!current?.extractedData) {
      this.extractedJsonText = '';
      this.validateJsonInput();
      return;
    }

    if (current.extractedData.rawJson) {
      this.extractedJsonText = current.extractedData.rawJson;
    } else if (current.extractedData.items?.length) {
      const formatted = {
        summary: 'Extracted standup data',
        items: current.extractedData.items.map((item) => ({
          category: item.category,
          data: item.data,
          sourceContext: item.sourceContext,
          confidence: item.confidence,
          status: item.status,
        })),
      };
      this.extractedJsonText = JSON.stringify(formatted, null, 2);
    } else {
      this.extractedJsonText = '';
    }
    this.jsonError = '';
    this.jsonSuccessMsg = '';
    this.validateJsonInput();
  }

  onJsonChange() {
    this.validateJsonInput();
  }

  validateJsonInput() {
    if (!this.extractedJsonText.trim()) {
      this.jsonError = '';
      return;
    }
    try {
      JSON.parse(this.extractedJsonText);
      this.jsonError = '';
    } catch (e: any) {
      this.jsonError = `JSON syntax error: ${e.message}`;
    }
  }

  onJsonEditorKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      textarea.value = val.substring(0, start) + '  ' + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      this.extractedJsonText = textarea.value;
      this.onJsonChange();
    }
  }

  formatJson() {
    if (!this.extractedJsonText.trim()) return;
    try {
      const parsed = JSON.parse(this.extractedJsonText);
      this.extractedJsonText = JSON.stringify(parsed, null, 2);
      this.jsonError = '';
      this.validateJsonInput();
    } catch (e: any) {
      this.jsonError = `Cannot format: ${e.message}`;
    }
  }

  copyJson() {
    if (!this.extractedJsonText.trim()) return;
    navigator.clipboard.writeText(this.extractedJsonText).then(
      () => {
        this.copyButtonText = 'Copied!';
        setTimeout(() => (this.copyButtonText = 'Copy'), 2000);
      },
      () => {
        this.copyButtonText = 'Copied!';
        setTimeout(() => (this.copyButtonText = 'Copy'), 2000);
      }
    );
  }

  clearJson() {
    if (confirm('Are you sure you want to clear the JSON editor?')) {
      this.extractedJsonText = '';
      this.jsonError = '';
      this.jsonSuccessMsg = '';
      this.validateJsonInput();
    }
  }

  loadSampleJson() {
    const today = new Date().toISOString().split('T')[0];
    const sample = {
      summary: 'Work Tracker & Standup notes extracted records',
      items: [
        {
          category: 'weekly-status',
          data: {
            taskId: 'T-101',
            week: 'W1',
            resourceName: 'Alice Smith',
            projectName: 'Customer Portal',
            module: 'Dashboard',
            taskTitle: 'Implement AI Excel Analysis Engine',
            taskDescription: 'Parse and extract structured records from uploaded Excel files',
            taskType: 'Feature',
            status: 'In Progress',
            priority: 'Critical',
            size: 'L',
            hours: 8,
            progress: 75,
            startDate: today,
            dueDate: today,
            tags: 'ai,excel,analytics',
            comments: 'Analysis and review in progress',
          },
          sourceContext: 'Weekly sprint planning - Alice on AI Excel Analysis',
          confidence: 96,
        },
        {
          category: 'project-status',
          data: {
            id: 'R-101',
            title: 'AI Analysis & Excel Import Engine',
            category: 'Platform',
            module: 'Work Tracker',
            type: 'Feature',
            priority: 'High',
            status: 'Development',
            prdStatus: 'Approved',
            environment: 'Staging',
            assignedTo: 'Alice Smith',
            targetDate: today,
            progress: 80,
            remarks: 'Integration with work-tracker and standup-note services',
          },
          sourceContext: 'Release tracking for Work Tracker AI engine',
          confidence: 95,
        },
        {
          category: 'work-log',
          data: {
            id: 'HU-101',
            date: today,
            hour: '09:00 AM - 10:00 AM',
            taskDescription: 'Daily standup analysis and Excel sheet parser verification',
            status: 'Completed',
            projectName: 'Work Tracker',
          },
          sourceContext: 'Hourly update: 09:00 AM - 10:00 AM work activity',
          confidence: 98,
        },
        {
          category: 'standup',
          data: {
            employeeName: 'Alice Smith',
            date: today,
            previousWork: 'Completed login API integration for portal',
            todayPlan: 'Implement dashboard filter components',
            blockers: 'None',
            notes: 'Working with backend team on API response',
            projectName: 'Customer Portal',
          },
          sourceContext: 'Alice: Completed login API, today working on filters',
          confidence: 95,
        },
        {
          category: 'employee',
          data: {
            name: 'Rahul Verma',
            position: 'Frontend Developer',
            team: 'Web Engineering',
            email: 'rahul@example.com',
          },
          sourceContext: 'Rahul joins as Frontend Developer next week',
          confidence: 90,
        },
        {
          category: 'project',
          data: {
            name: 'Mobile App for Field Agents',
            status: 'Active',
            lead: 'Alice Smith',
            notes: 'Cross-platform mobile application',
          },
          sourceContext: 'Arjun brought up new project Mobile App for Field Agents',
          confidence: 90,
        },
        {
          category: 'task',
          data: {
            title: 'Deploy dashboard to staging',
            employeeName: 'Alice Smith',
            projectName: 'Customer Portal',
            description: 'Configure CI/CD and deploy latest build to staging',
            endDate: today,
            priority: 'important-urgent',
          },
          sourceContext: 'Alice will deploy to staging by EOD',
          confidence: 85,
        },
        {
          category: 'leave',
          data: {
            employeeName: 'Alice Smith',
            fromDate: today,
            toDate: today,
            leaveType: 'planned',
            duration: 'full-day',
            reason: 'Personal appointment',
          },
          sourceContext: 'Alice on leave today for personal appointment',
          confidence: 95,
        },
        {
          category: 'reminder',
          data: {
            title: 'Resolve API contract delay',
            description: 'Follow up with backend team regarding contract finalization',
            deadline: today,
            priority: 'High',
            assignedTo: 'Alice Smith',
          },
          sourceContext: 'Reminder to follow up on backend API contract delay',
          confidence: 90,
        },
        {
          category: 'meeting',
          data: {
            title: 'Sprint Retrospective',
            description: 'Bi-weekly sprint retrospective',
            date: today,
            time: '16:00',
            attendees: 'Alice, Bob, Team',
          },
          sourceContext: 'Sprint retrospective scheduled for 4 PM today',
          confidence: 90,
        },
      ],
    };
    this.extractedJsonText = JSON.stringify(sample, null, 2);
    this.jsonError = '';
    this.jsonSuccessMsg = 'Sample JSON loaded. Review or edit, then click "Update Extracted Info".';
    this.validateJsonInput();
  }

  updateExtractedFromJson() {
    if (!this.extractedJsonText.trim()) {
      this.jsonError = 'Please enter or paste JSON data first.';
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(this.extractedJsonText);
      this.jsonError = '';
    } catch (e: any) {
      this.jsonError = `Invalid JSON syntax: ${e.message}`;
      return;
    }

    let itemsList: any[] = [];
    if (Array.isArray(parsed)) {
      itemsList = parsed;
    } else if (parsed && Array.isArray(parsed.items)) {
      itemsList = parsed.items;
    } else if (parsed && (parsed.category || parsed.data)) {
      itemsList = [parsed];
    } else if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          const cat = this.normalizeCategory(key);
          parsed[key].forEach((subItem: any) => {
            itemsList.push({
              category: cat,
              data: subItem.data || subItem,
            });
          });
        }
      }
      if (itemsList.length === 0) {
        itemsList = [parsed];
      }
    }

    if (itemsList.length === 0) {
      this.jsonError =
        'No extractable items found in the JSON. Expected { "items": [ ... ] } or an array of items.';
      return;
    }

    let session = this.currentSession;
    if (!session) {
      session = this.aiSvc.createNewSession();
    }

    const items: ExtractedItem[] = itemsList.map((item: any, idx: number) => {
      let category = this.normalizeCategory(item.category);
      let data = item.data;

      if (!category && !data) {
        data = { ...item };
        category = this.inferCategory(data);
      } else if (!data && typeof item === 'object') {
        data = { ...item };
        delete data.category;
        delete data.sourceContext;
        delete data.confidence;
        delete data.status;
        delete data.id;
        delete data.isExisting;
        delete data.existingId;
        delete data.edited;
      }

      if (!category) {
        category = this.inferCategory(data || {});
      }

      return {
        id: item.id || `ei-${Date.now()}-${idx}`,
        category: category as any,
        data: data || {},
        sourceContext: item.sourceContext || 'Manually entered / edited JSON',
        confidence: typeof item.confidence === 'number' ? item.confidence : 100,
        status: ['pending', 'approved', 'rejected', 'applied'].includes(item.status)
          ? item.status
          : 'pending',
        isExisting: false,
        edited: false,
      };
    });

    const extractedData: ExtractedData = {
      items,
      extractedAt: new Date().toISOString(),
      sourceText: session.extractedData?.sourceText || 'Manually entered JSON',
      rawJson: this.extractedJsonText,
    };

    this.aiSvc.setSessionExtractedData(session.id, extractedData);
    this.runDuplicateCheck();

    this.showSuccess(`Updated ${items.length} extracted items from JSON!`);
    // Immediately display the Extracted Information tab
    this.activeTab = 'extracted';
  }

  private normalizeCategory(cat: string | undefined): ExtractedCategory {
    if (!cat) return 'weekly-status';
    const c = cat.toLowerCase().replace(/[\s_\-]+/g, '');
    if (c.includes('weekly') || c.includes('developertask') || c.includes('sprinttask')) return 'weekly-status';
    if (c.includes('projectstatus') || c.includes('releasetrack') || c.includes('release')) return 'project-status';
    if (c.includes('worklog') || c.includes('hourly') || c.includes('workupdate')) return 'work-log';
    if (c.includes('standup') || c.includes('note')) return 'standup';
    if (c.includes('emp') || c.includes('staff') || c.includes('member')) return 'employee';
    if (c.includes('proj')) return 'project';
    if (c.includes('task') || c.includes('todo')) return 'task';
    if (c.includes('leave') || c.includes('vacation') || c.includes('absence')) return 'leave';
    if (c.includes('remind')) return 'reminder';
    if (c.includes('meet') || c.includes('event') || c.includes('calendar')) return 'meeting';
    return 'weekly-status';
  }

  private inferCategory(data: Record<string, any>): ExtractedCategory {
    if (data['week'] || data['taskTitle'] || (data['taskId'] && !data['date'])) {
      return 'weekly-status';
    }
    if (data['prdStatus'] || data['releaseTrack'] || data['environment'] || (data['targetDate'] && data['module'])) {
      return 'project-status';
    }
    if (data['hour'] || data['timeslot'] || (data['taskDescription'] && data['date'] && !data['week'])) {
      return 'work-log';
    }
    if (
      data['employeeName'] &&
      (data['previousWork'] !== undefined ||
        data['todayPlan'] !== undefined ||
        data['blockers'] !== undefined)
    ) {
      return 'standup';
    }
    if (data['fromDate'] || data['toDate'] || data['leaveType']) {
      return 'leave';
    }
    if (data['position'] || data['team'] || (data['email'] && !data['employeeName'])) {
      return 'employee';
    }
    if (
      data['column'] ||
      (data['title'] && data['employeeName'] && data['projectName'])
    ) {
      return 'task';
    }
    if (data['lead'] || (data['name'] && data['status'])) {
      return 'project';
    }
    if (data['time'] && data['date']) {
      return 'meeting';
    }
    if (data['deadline'] || data['assignedTo']) {
      return 'reminder';
    }
    if (data['title']) {
      return 'task';
    }
    return 'weekly-status';
  }
}
