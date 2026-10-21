import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AiCharacterAssistantService,
  ChatMessage,
  AvatarPose
} from './ai-character-assistant.service';
import { AiAvatarAnimatorComponent } from './ai-avatar-animator.component';
import { Theme } from '../../../core/services/theme.service';

@Component({
  selector: 'app-ai-character-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, AiAvatarAnimatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- RIGHT SIDE FLOATING ASSISTANT CONTAINER                           -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div
      class="ai-assistant-wrapper"
      [class.chat-open]="assistantService.isOpen()"
      [class.chat-minimized]="assistantService.isMinimized()"
    >
      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 1. TRANSPARENT GLASSMORPHISM CHAT WINDOW                        -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <section
        class="glass-chat-window"
        *ngIf="assistantService.isOpen() && !assistantService.isMinimized()"
        aria-label="U2 AI Assistant Chat Window"
      >
        <!-- Chat Header -->
        <header class="chat-header">
          <div class="header-info">
            <span class="online-indicator" title="Online & Ready"></span>
            <div class="title-meta">
              <h3 class="assistant-name">U2 Assistant</h3>
              <p class="assistant-subtitle">How can I help you today?</p>
            </div>
          </div>

          <div class="header-actions">
            <!-- Voice Audio Toggle -->
            <button
              type="button"
              class="hdr-btn"
              (click)="assistantService.toggleMute()"
              [title]="assistantService.isMuted() ? 'Unmute voice' : 'Mute voice'"
              [attr.aria-label]="assistantService.isMuted() ? 'Unmute voice' : 'Mute voice'"
            >
              <i [class]="assistantService.isMuted() ? 'pi pi-volume-off' : 'pi pi-volume-up'"></i>
            </button>

            <!-- Minimize Button -->
            <button
              type="button"
              class="hdr-btn"
              (click)="assistantService.minimizeChat()"
              title="Minimize chat"
              aria-label="Minimize chat"
            >
              <i class="pi pi-minus"></i>
            </button>

            <!-- Close Button -->
            <button
              type="button"
              class="hdr-btn close-btn"
              (click)="assistantService.closeChat()"
              title="Close chat"
              aria-label="Close chat"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
        </header>

        <!-- Chat Conversation Area -->
        <div class="chat-body" #chatScrollContainer>
          @for (msg of assistantService.messages(); track msg.id) {
            <!-- Assistant Message -->
            @if (msg.sender === 'assistant') {
              <div class="message-row assistant-row">
                <img
                  src="assets/images/assistant/assistant-thumb.png"
                  alt="Avatar"
                  class="msg-avatar-thumb"
                  draggable="false"
                />
                <div class="msg-bubble assistant-bubble">
                  <div class="msg-text">{{ msg.text }}</div>

                  <!-- Interactive Theme Picker -->
                  @if (msg.themePicker) {
                    <div class="theme-options-grid">
                      <button
                        type="button"
                        class="theme-card light-opt"
                        [class.active]="assistantService.themeService.theme() === 'light'"
                        (click)="selectTheme('light')"
                      >
                        <span class="theme-icon-box light-icon">☀️</span>
                        <span class="theme-name">Light</span>
                      </button>

                      <button
                        type="button"
                        class="theme-card dark-opt"
                        [class.active]="assistantService.themeService.theme() === 'dark'"
                        (click)="selectTheme('dark')"
                      >
                        <span class="theme-icon-box dark-icon">🌙</span>
                        <span class="theme-name">Dark</span>
                      </button>

                      <button
                        type="button"
                        class="theme-card blue-opt"
                        [class.active]="assistantService.themeService.theme() === 'blue'"
                        (click)="selectTheme('blue')"
                      >
                        <span class="theme-color-circle blue-circ"></span>
                        <span class="theme-name">Blue</span>
                      </button>

                      <button
                        type="button"
                        class="theme-card green-opt"
                        [class.active]="assistantService.themeService.theme() === 'green'"
                        (click)="selectTheme('green')"
                      >
                        <span class="theme-color-circle green-circ"></span>
                        <span class="theme-name">Green</span>
                      </button>

                      <button
                        type="button"
                        class="theme-card pink-opt"
                        [class.active]="assistantService.themeService.theme() === 'pink'"
                        (click)="selectTheme('pink')"
                      >
                        <span class="theme-color-circle pink-circ"></span>
                        <span class="theme-name">Pink</span>
                      </button>
                    </div>
                  }

                  <!-- Tool Suggestion Card -->
                  @if (msg.toolSuggestion) {
                    <div class="tool-suggestion-card">
                      <div class="tool-sugg-header">
                        <span class="tool-sugg-title">{{ msg.toolSuggestion.name }}</span>
                      </div>
                      <p class="tool-sugg-desc">{{ msg.toolSuggestion.description }}</p>
                      <button
                        type="button"
                        class="open-tool-btn"
                        (click)="assistantService.navigateTo(msg.toolSuggestion.route, msg.toolSuggestion.name)"
                      >
                        Open Tool →
                      </button>
                    </div>
                  }

                  <span class="msg-timestamp">{{ msg.timestamp | date:'shortTime' }}</span>
                </div>
              </div>
            }

            <!-- User Message -->
            @if (msg.sender === 'user') {
              <div class="message-row user-row">
                <div class="msg-bubble user-bubble">
                  <div class="msg-text">{{ msg.text }}</div>
                  <span class="msg-timestamp">{{ msg.timestamp | date:'shortTime' }}</span>
                </div>
                <div class="user-avatar-icon">
                  <i class="pi pi-user"></i>
                </div>
              </div>
            }
          }

          <!-- Thinking / Typing Indicator -->
          @if (assistantService.isThinking()) {
            <div class="message-row assistant-row typing-row">
              <img
                src="assets/images/assistant/assistant-thumb.png"
                alt="Avatar"
                class="msg-avatar-thumb"
              />
              <div class="msg-bubble assistant-bubble typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          }
        </div>

        <!-- Quick Action Prompt Chips -->
        <div class="quick-chips-bar">
          <button
            type="button"
            class="chip-btn"
            (click)="assistantService.sendMessage('Can you change the theme?')"
          >
            🎨 Change theme
          </button>
          <button
            type="button"
            class="chip-btn"
            (click)="assistantService.sendMessage('Open Standup Note')"
          >
            📋 Standup Note
          </button>
          <button
            type="button"
            class="chip-btn"
            (click)="assistantService.sendMessage('Tell me about Lodge Booking')"
          >
            🏨 Lodge Booking
          </button>
          <button
            type="button"
            class="chip-btn"
            (click)="assistantService.sendMessage('What can you do?')"
          >
            💡 Help
          </button>
        </div>

        <!-- Chat Input Footer -->
        <footer class="chat-footer">
          <div class="input-wrapper">
            <input
              #inputField
              type="text"
              class="chat-input"
              placeholder="Ask me anything..."
              [(ngModel)]="userInput"
              (keydown.enter)="handleSend()"
            />

            <!-- Mic / Speech-to-Text Button -->
            <button
              type="button"
              class="input-icon-btn mic-btn"
              [class.is-recording]="isVoiceRecording()"
              (click)="toggleVoiceInput()"
              [title]="isVoiceRecording() ? 'Listening... click to stop' : 'Voice input'"
            >
              <i class="pi pi-microphone"></i>
            </button>

            <!-- Send Button -->
            <button
              type="button"
              class="send-btn"
              [disabled]="!userInput.trim()"
              (click)="handleSend()"
              title="Send message"
            >
              <i class="pi pi-send"></i>
            </button>
          </div>
        </footer>
      </section>

      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 2. ANIMATED FEMALE CHARACTER (RIGHT SIDE)                       -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="character-dock-container"
        *ngIf="assistantService.isOpen() && !assistantService.isMinimized()"
      >
        <app-ai-avatar-animator
          [pose]="assistantService.currentPose()"
          [isSpeaking]="assistantService.isSpeaking()"
          [isListening]="assistantService.isListening()"
          [isThinking]="assistantService.isThinking()"
          (avatarClicked)="assistantService.setPose('happy')"
        />
      </div>

      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 3. FLOATING BADGE & BUBBLE (WHEN MINIMIZED OR CLOSED)          -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="floating-launcher"
        *ngIf="!assistantService.isOpen() || assistantService.isMinimized()"
        (click)="assistantService.openChat()"
        title="Open U2 Assistant"
      >
        <!-- Speech Bubble Callout -->
        <div class="launcher-bubble">
          <span>Hi! Ask me anything about U2 Tools</span>
          <div class="bubble-arrow"></div>
        </div>

        <!-- Glowing Circular Avatar Badge -->
        <div class="launcher-avatar-btn">
          <img
            src="assets/images/assistant/assistant-avatar-head.png"
            alt="U2 Assistant"
            class="launcher-img"
            draggable="false"
          />
          <!-- Glowing Pulse Ring -->
          <div class="ring-pulse"></div>
          <!-- Red Notification Dot -->
          <span class="notification-dot" *ngIf="assistantService.unreadCount() > 0"></span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      pointer-events: none;
      font-family: var(--font-family, 'Inter', -apple-system, sans-serif);
    }

    .ai-assistant-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      pointer-events: auto;
      max-height: 90vh;
    }

    /* ══════════════════════════════════════════════════════════════════ */
    /* TRANSPARENT GLASSMORPHISM CHAT WINDOW                              */
    /* ══════════════════════════════════════════════════════════════════ */
    .glass-chat-window {
      width: 380px;
      height: 560px;
      max-height: calc(88vh - 40px);
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      /* Glassmorphism translucent backdrop */
      background: var(--bg-card, rgba(255, 255, 255, 0.72));
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--border-color-strong, rgba(255, 255, 255, 0.35));
      box-shadow:
        0 20px 50px rgba(0, 0, 0, 0.28),
        0 0 0 1px rgba(255, 255, 255, 0.12),
        inset 0 1px 1px rgba(255, 255, 255, 0.4);

      animation: slideInChat 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      transition: width 0.3s ease, height 0.3s ease;
    }

    @keyframes slideInChat {
      0% {
        opacity: 0;
        transform: translateY(24px) scale(0.96);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* ── Header ── */
    .chat-header {
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
      background: rgba(255, 255, 255, 0.05);
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .online-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      flex-shrink: 0;
    }

    .title-meta {
      display: flex;
      flex-direction: column;
    }

    .assistant-name {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--text-primary, #ffffff);
      letter-spacing: -0.2px;
    }

    .assistant-subtitle {
      margin: 0;
      font-size: 0.75rem;
      color: var(--text-secondary, #9494b8);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hdr-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.12);
      color: var(--text-primary, #ffffff);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s ease;
    }

    .hdr-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.08);
    }

    .close-btn:hover {
      background: rgba(239, 68, 68, 0.35);
      color: #ef4444;
    }

    /* ── Chat Body ── */
    .chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }

    .chat-body::-webkit-scrollbar {
      width: 5px;
    }

    .chat-body::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }

    .message-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      animation: fadeInRow 0.25s ease-out;
    }

    @keyframes fadeInRow {
      0% { opacity: 0; transform: translateY(6px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .assistant-row {
      justify-content: flex-start;
    }

    .user-row {
      justify-content: flex-end;
    }

    .msg-avatar-thumb {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      border: 1.5px solid var(--accent-primary, #818cf8);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      flex-shrink: 0;
    }

    .user-avatar-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--accent-surface, rgba(129, 140, 248, 0.2));
      color: var(--accent-primary, #818cf8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .msg-bubble {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 18px;
      position: relative;
      font-size: 0.875rem;
      line-height: 1.45;
      word-break: break-word;
    }

    .assistant-bubble {
      background: var(--bg-secondary, rgba(255, 255, 255, 0.85));
      color: var(--text-primary, #1e1e2f);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    }

    .user-bubble {
      background: var(--accent-gradient, linear-gradient(135deg, #6366f1, #8b5cf6));
      color: #ffffff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
    }

    .msg-text {
      white-space: pre-line;
    }

    .msg-timestamp {
      display: block;
      font-size: 0.68rem;
      opacity: 0.6;
      margin-top: 4px;
      text-align: right;
    }

    /* ── Theme Options Grid (Exact Match to Mockup) ── */
    .theme-options-grid {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      justify-content: space-between;
      overflow-x: auto;
    }

    .theme-card {
      padding: 6px 4px;
      border-radius: 12px;
      border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
      background: var(--bg-tertiary, rgba(255, 255, 255, 0.65));
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      flex: 1;
      min-width: 48px;
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .theme-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
      border-color: var(--accent-primary, #6366f1);
    }

    .theme-card.active {
      border: 2px solid var(--accent-primary, #6366f1);
      background: var(--accent-surface, rgba(99, 102, 241, 0.15));
    }

    .theme-icon-box {
      font-size: 1.15rem;
      line-height: 1;
    }

    .theme-color-circle {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-block;
    }

    .blue-circ { background: #3b82f6; box-shadow: 0 0 6px rgba(59, 130, 246, 0.5); }
    .green-circ { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
    .pink-circ { background: #ec4899; box-shadow: 0 0 6px rgba(236, 72, 153, 0.5); }

    .theme-name {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-primary, #333344);
    }

    /* ── Tool Suggestion Card ── */
    .tool-suggestion-card {
      margin-top: 10px;
      padding: 10px;
      border-radius: 12px;
      background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.08);
      border: 1px solid var(--accent-primary, #6366f1);
    }

    .tool-sugg-title {
      font-weight: 700;
      color: var(--accent-primary, #6366f1);
      font-size: 0.88rem;
    }

    .tool-sugg-desc {
      font-size: 0.78rem;
      margin: 4px 0 8px 0;
      color: var(--text-secondary, #666);
    }

    .open-tool-btn {
      padding: 4px 12px;
      border-radius: 14px;
      background: var(--accent-gradient, #6366f1);
      color: #ffffff;
      border: none;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .open-tool-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    /* ── Typing Indicator ── */
    .typing-bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-primary, #818cf8);
      animation: typingBounce 1.2s infinite ease-in-out;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-6px); opacity: 1; }
    }

    /* ── Quick Chips Bar ── */
    .quick-chips-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      overflow-x: auto;
      white-space: nowrap;
      border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
    }

    .quick-chips-bar::-webkit-scrollbar {
      display: none;
    }

    .chip-btn {
      padding: 4px 10px;
      border-radius: 14px;
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-secondary, #9494b8);
      font-size: 0.74rem;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .chip-btn:hover {
      background: var(--accent-surface, rgba(99, 102, 241, 0.15));
      color: var(--accent-primary, #818cf8);
      border-color: var(--accent-primary, #818cf8);
    }

    /* ── Footer Input Bar (Exact Match to Mockup) ── */
    .chat-footer {
      padding: 12px 14px;
      border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      background: rgba(255, 255, 255, 0.04);
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-input, rgba(255, 255, 255, 0.7));
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.25));
      border-radius: 24px;
      padding: 4px 6px 4px 14px;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .input-wrapper:focus-within {
      border-color: var(--accent-primary, #818cf8);
      box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb, 99, 102, 241), 0.15);
    }

    .chat-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 0.88rem;
      color: var(--text-primary, #ffffff);
    }

    .chat-input::placeholder {
      color: var(--text-tertiary, #9494b8);
    }

    .input-icon-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--text-secondary, #9494b8);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }

    .input-icon-btn:hover {
      color: var(--accent-primary, #818cf8);
    }

    .mic-btn.is-recording {
      color: #ef4444;
      animation: pulseMic 1s infinite alternate;
    }

    @keyframes pulseMic {
      0% { transform: scale(1); }
      100% { transform: scale(1.2); }
    }

    .send-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: var(--accent-gradient, linear-gradient(135deg, #818cf8, #a78bfa));
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      box-shadow: 0 4px 12px rgba(129, 140, 248, 0.35);
    }

    .send-btn:hover:not(:disabled) {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(129, 140, 248, 0.5);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ══════════════════════════════════════════════════════════════════ */
    /* CHARACTER DOCK (RIGHT SIDE)                                       */
    /* ══════════════════════════════════════════════════════════════════ */
    .character-dock-container {
      display: flex;
      align-items: flex-end;
      animation: fadeInCharacter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeInCharacter {
      0% { opacity: 0; transform: translateX(30px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    /* ══════════════════════════════════════════════════════════════════ */
    /* FLOATING LAUNCHER BADGE (WHEN MINIMIZED / CLOSED)                 */
    /* ══════════════════════════════════════════════════════════════════ */
    .floating-launcher {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      animation: popLauncher 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popLauncher {
      0% { opacity: 0; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1); }
    }

    .launcher-bubble {
      background: var(--bg-card, rgba(255, 255, 255, 0.9));
      color: var(--text-primary, #1e1e2f);
      padding: 8px 14px;
      border-radius: 16px;
      font-size: 0.82rem;
      font-weight: 600;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
      position: relative;
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.4));
      backdrop-filter: blur(12px);
      white-space: nowrap;
      animation: floatTooltip 3s ease-in-out infinite alternate;
    }

    @keyframes floatTooltip {
      0% { transform: translateY(0); }
      100% { transform: translateY(-4px); }
    }

    .bubble-arrow {
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
      width: 0;
      height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-left: 6px solid var(--bg-card, rgba(255, 255, 255, 0.9));
    }

    .launcher-avatar-btn {
      position: relative;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .launcher-avatar-btn:hover {
      transform: scale(1.1);
    }

    .launcher-img {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      object-fit: cover;
      border: 2.5px solid #ffffff;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      z-index: 2;
    }

    .ring-pulse {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(129, 140, 248, 0.4) 0%, transparent 70%);
      animation: ringGlow 2.5s infinite;
      z-index: 1;
    }

    @keyframes ringGlow {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.25); opacity: 0.2; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }

    .notification-dot {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #ef4444;
      border: 2px solid #ffffff;
      box-shadow: 0 0 8px #ef4444;
      z-index: 3;
    }

    /* ── Responsive Behavior ── */
    @media (max-width: 900px) {
      .ai-assistant-wrapper {
        flex-direction: column-reverse;
        align-items: flex-end;
      }
      .glass-chat-window {
        width: min(92vw, 360px);
        height: 480px;
      }
      .character-dock-container {
        display: none; /* In very compact viewports, prioritize the chat window */
      }
    }
  `]
})
export class AiCharacterAssistantComponent implements OnInit, OnDestroy {
  assistantService = inject(AiCharacterAssistantService);

  @ViewChild('chatScrollContainer') private chatScrollContainer?: ElementRef;
  @ViewChild('inputField') private inputField?: ElementRef;

  userInput = '';
  readonly isVoiceRecording = signal<boolean>(false);
  private speechRecognition?: any;

  ngOnInit(): void {
    this.initSpeechRecognition();
  }

  ngOnDestroy(): void {
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch {}
    }
  }

  handleSend(): void {
    const text = this.userInput.trim();
    if (!text) return;
    this.userInput = '';
    this.assistantService.sendMessage(text);
    this.scrollToBottom();
  }

  selectTheme(theme: Theme): void {
    this.assistantService.applyTheme(theme);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScrollContainer) {
        this.chatScrollContainer.nativeElement.scrollTop =
          this.chatScrollContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  // ── Voice Input (Speech-to-Text) ──
  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onstart = () => {
        this.isVoiceRecording.set(true);
        this.assistantService.isListening.set(true);
        this.assistantService.setPose('listening');
      };

      this.speechRecognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          this.userInput = transcript;
          this.handleSend();
        }
      };

      this.speechRecognition.onerror = () => {
        this.isVoiceRecording.set(false);
        this.assistantService.isListening.set(false);
        this.assistantService.setPose('idle');
      };

      this.speechRecognition.onend = () => {
        this.isVoiceRecording.set(false);
        this.assistantService.isListening.set(false);
        if (this.assistantService.currentPose() === 'listening') {
          this.assistantService.setPose('idle');
        }
      };
    }
  }

  toggleVoiceInput(): void {
    if (!this.speechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use keyboard input.');
      return;
    }

    if (this.isVoiceRecording()) {
      this.speechRecognition.stop();
    } else {
      this.speechRecognition.start();
    }
  }
}
