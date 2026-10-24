import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  signal,
  computed,
  ChangeDetectionStrategy,
  HostListener
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
      <!-- 2. ANIMATED FEMALE CHARACTER (RIGHT SIDE - DRAGGABLE & MOVABLE) -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="character-dock-container"
        *ngIf="assistantService.isOpen() && !assistantService.isMinimized()"
        [style.left.px]="charX()"
        [style.top.px]="charY()"
        [style.width.px]="charWidth()"
        [style.height.px]="charHeight()"
        [class.is-dragging]="isCharDragging()"
        [class.is-moving]="charMovementMode() !== 'none'"
        (mousedown)="onCharMouseDown($event)"
        (touchstart)="onCharTouchStart($event)"
        (contextmenu)="onCharContextMenu($event)"
        title="U2 Assistant Character (Drag to move, right-click for continuous movement & settings)"
      >
        <div
          class="character-scaler"
          [style.transform]="'scale(' + charScale() + ')'"
          [style.transformOrigin]="'top left'"
        >
          <app-ai-avatar-animator
            [customImage]="charCustomImage()"
            [pose]="assistantService.currentPose()"
            [isSpeaking]="assistantService.isSpeaking()"
            [isListening]="assistantService.isListening()"
            [isThinking]="assistantService.isThinking()"
            (avatarClicked)="onCharacterClick()"
          />
        </div>

        <!-- Mini Movement Indicator Badge -->
        <span
          class="char-moving-indicator"
          *ngIf="charMovementMode() !== 'none'"
          (click)="stopCharMovement()"
          [title]="'Movement active: ' + charMovementMode() + ' (click to stop)'"
        >
          {{ charMovementMode() === 'horizontal' ? '↔ Moving' : charMovementMode() === 'vertical' ? '↕ Moving' : '↗ Moving' }} ✕
        </span>
      </div>

      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 3. FLOATING BADGE & BUBBLE (WHEN MINIMIZED OR CLOSED)          -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="floating-launcher"
        *ngIf="!assistantService.isOpen() || assistantService.isMinimized()"
        [style.left.px]="agentX()"
        [style.top.px]="agentY()"
        [class.is-dragging]="isDragging()"
        [class.is-moving]="movementMode() !== 'none'"
        (mousedown)="onLauncherMouseDown($event)"
        (touchstart)="onLauncherTouchStart($event)"
        (contextmenu)="onLauncherContextMenu($event)"
        (click)="onLauncherClick($event)"
        title="U2 Assistant (Drag to move, right-click for options)"
      >
        <!-- Speech Bubble Callout -->
        <div
          class="launcher-bubble"
          *ngIf="!isDragging() && movementMode() === 'none'"
          [class.flip-right]="agentX() < 240"
          (click)="onLauncherClick($event)"
        >
          <span>Hi! Ask me anything about U2 Tools</span>
          <div class="bubble-arrow"></div>
        </div>

        <!-- Glowing Circular Avatar Badge -->
        <div
          class="launcher-avatar-btn"
          [style.width.px]="agentSize()"
          [style.height.px]="agentSize()"
        >
          <img
            [src]="agentImage()"
            alt="U2 Assistant"
            class="launcher-img"
            [style.width.px]="agentSize() - 4"
            [style.height.px]="agentSize() - 4"
            draggable="false"
          />
          <!-- Glowing Pulse Ring -->
          <div class="ring-pulse"></div>
          <!-- Red Notification Dot -->
          <span class="notification-dot" *ngIf="assistantService.unreadCount() > 0"></span>
          <!-- Active Movement Mini Badge -->
          <span
            class="movement-mini-badge"
            *ngIf="movementMode() !== 'none'"
            [title]="'Movement active: ' + movementMode()"
          >
            {{ movementMode() === 'horizontal' ? '↔' : movementMode() === 'vertical' ? '↕' : '↗' }}
          </span>
        </div>
      </div>

      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 4. RIGHT-CLICK CONTEXT MENU                                    -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="agent-context-menu"
        *ngIf="showContextMenu()"
        [style.left.px]="contextMenuX()"
        [style.top.px]="contextMenuY()"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <div class="menu-header">
          <div class="menu-title-wrap">
            <span class="menu-agent-icon">✨</span>
            <span class="menu-title">U2 Agent Controls</span>
          </div>
          <button class="menu-close-btn" (click)="closeContextMenu()" title="Close menu">✕</button>
        </div>

        <div class="menu-section-label">CONTINUOUS MOVEMENT</div>
        <div class="menu-actions-list">
          <button
            type="button"
            class="menu-item"
            [class.active]="movementMode() === 'horizontal'"
            (click)="setMovementMode('horizontal')"
          >
            <span class="item-icon">↔️</span>
            <span class="item-text">Move Horizontally</span>
            <span class="active-dot" *ngIf="movementMode() === 'horizontal'">●</span>
          </button>

          <button
            type="button"
            class="menu-item"
            [class.active]="movementMode() === 'vertical'"
            (click)="setMovementMode('vertical')"
          >
            <span class="item-icon">↕️</span>
            <span class="item-text">Move Vertically</span>
            <span class="active-dot" *ngIf="movementMode() === 'vertical'">●</span>
          </button>

          <button
            type="button"
            class="menu-item"
            [class.active]="movementMode() === 'diagonal'"
            (click)="setMovementMode('diagonal')"
          >
            <span class="item-icon">↗️</span>
            <span class="item-text">Move Diagonally</span>
            <span class="active-dot" *ngIf="movementMode() === 'diagonal'">●</span>
          </button>

          <button
            type="button"
            class="menu-item stop-item"
            [disabled]="movementMode() === 'none'"
            (click)="stopMovement()"
          >
            <span class="item-icon">⏹️</span>
            <span class="item-text">Stop Movement</span>
          </button>
        </div>

        <div class="menu-divider"></div>

        <div class="menu-section-label">POSITION & SETTINGS</div>
        <div class="menu-actions-list">
          <button type="button" class="menu-item" (click)="resetPosition()">
            <span class="item-icon">↩️</span>
            <span class="item-text">Reset Position</span>
          </button>

          <!-- Size Adjuster Control -->
          <div class="menu-slider-block">
            <div class="slider-label-row">
              <span class="slider-title">🔍 Image Size</span>
              <span class="slider-value">{{ agentSize() }}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="110"
              step="2"
              [value]="agentSize()"
              (input)="onSizeChange($event)"
              class="menu-range-slider"
            />
            <div class="size-presets-row">
              <button type="button" class="preset-btn" [class.selected]="agentSize() === 44" (click)="setSize(44)">S (44)</button>
              <button type="button" class="preset-btn" [class.selected]="agentSize() === 60" (click)="setSize(60)">M (60)</button>
              <button type="button" class="preset-btn" [class.selected]="agentSize() === 80" (click)="setSize(80)">L (80)</button>
              <button type="button" class="preset-btn" [class.selected]="agentSize() === 100" (click)="setSize(100)">XL (100)</button>
            </div>
          </div>

          <!-- Speed Adjuster Control -->
          <div class="menu-slider-block">
            <div class="slider-label-row">
              <span class="slider-title">⚡ Movement Speed</span>
              <span class="slider-value">{{ agentSpeed() }}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              [value]="agentSpeed()"
              (input)="onSpeedChange($event)"
              class="menu-range-slider"
            />
            <div class="speed-presets-row">
              <button type="button" class="preset-btn" [class.selected]="agentSpeed() === 1.5" (click)="setSpeed(1.5)">Slow</button>
              <button type="button" class="preset-btn" [class.selected]="agentSpeed() === 3" (click)="setSpeed(3)">Normal</button>
              <button type="button" class="preset-btn" [class.selected]="agentSpeed() === 5" (click)="setSpeed(5)">Fast</button>
              <button type="button" class="preset-btn" [class.selected]="agentSpeed() === 8" (click)="setSpeed(8)">Turbo</button>
            </div>
          </div>

          <!-- Change Agent Image Button -->
          <button type="button" class="menu-item" (click)="triggerImageUpload()">
            <span class="item-icon">🖼️</span>
            <span class="item-text">Change Agent Image...</span>
          </button>

          <!-- Reset Default Image (if custom image is active) -->
          <button
            type="button"
            class="menu-item text-danger"
            *ngIf="hasCustomImage()"
            (click)="resetDefaultImage()"
          >
            <span class="item-icon">🔄</span>
            <span class="item-text">Restore Default Avatar</span>
          </button>
        </div>
      </div>

      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 5. CHANGE IMAGE PREVIEW MODAL                                  -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="agent-modal-backdrop"
        *ngIf="showImagePreviewModal()"
        (click)="closeImagePreviewModal()"
      >
        <div class="agent-modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-row">
              <span class="modal-icon">🖼️</span>
              <h4 class="modal-title">Change Agent Avatar</h4>
            </div>
            <button type="button" class="modal-close-btn" (click)="closeImagePreviewModal()">✕</button>
          </div>

          <div class="modal-body">
            <!-- Avatar Comparison / Preview -->
            <div class="avatar-preview-box">
              <div class="preview-avatar-circle">
                <img
                  *ngIf="pendingPreviewImage"
                  [src]="pendingPreviewImage"
                  alt="Preview Avatar"
                  class="preview-img"
                />
                <span *ngIf="!pendingPreviewImage" class="no-preview-txt">No Image</span>
              </div>
              <div class="preview-file-info" *ngIf="pendingFileName">
                <span class="file-name">{{ pendingFileName }}</span>
                <span class="file-size">{{ pendingFileSize }}</span>
              </div>
            </div>

            <!-- Validation Error Alert if any -->
            <div class="modal-error-alert" *ngIf="imageErrorMessage">
              <span>⚠️ {{ imageErrorMessage }}</span>
            </div>

            <p class="modal-desc">
              Select an image from your computer to replace the floating U2Tools agent. Supported formats: PNG, JPG, WEBP, SVG, GIF (max 5MB).
            </p>

            <div class="modal-upload-bar">
              <button type="button" class="btn-choose-file" (click)="triggerImageUpload()">
                📁 Choose File...
              </button>
              <button
                type="button"
                class="btn-reset-default"
                *ngIf="hasCustomImage()"
                (click)="resetDefaultImageFromModal()"
              >
                Restore Original
              </button>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-modal-cancel" (click)="closeImagePreviewModal()">
              Cancel
            </button>
            <button
              type="button"
              class="btn-modal-apply"
              [disabled]="!pendingPreviewImage"
              (click)="applyPendingImage()"
            >
              Apply Avatar
            </button>
          </div>
        </div>
      </div>

      <!-- Hidden Local File Input -->
      <input
        #fileInput
        type="file"
        class="hidden-file-input"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        (change)="onFileSelected($event)"
      />

      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 6. CHARACTER RIGHT-CLICK CONTEXT MENU                           -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="agent-context-menu char-context-menu"
        *ngIf="showCharContextMenu()"
        [style.left.px]="charContextMenuX()"
        [style.top.px]="charContextMenuY()"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <div class="menu-header">
          <div class="menu-title-wrap">
            <span class="menu-agent-icon">💃</span>
            <span class="menu-title">Character Controls</span>
          </div>
          <button class="menu-close-btn" (click)="closeCharContextMenu()" title="Close menu">✕</button>
        </div>

        <div class="menu-section-label">CONTINUOUS MOVEMENT</div>
        <div class="menu-actions-list">
          <button
            type="button"
            class="menu-item"
            [class.active]="charMovementMode() === 'horizontal'"
            (click)="setCharMovementMode('horizontal')"
          >
            <span class="item-icon">↔️</span>
            <span class="item-text">Move Horizontally</span>
            <span class="active-dot" *ngIf="charMovementMode() === 'horizontal'">●</span>
          </button>

          <button
            type="button"
            class="menu-item"
            [class.active]="charMovementMode() === 'vertical'"
            (click)="setCharMovementMode('vertical')"
          >
            <span class="item-icon">↕️</span>
            <span class="item-text">Move Vertically</span>
            <span class="active-dot" *ngIf="charMovementMode() === 'vertical'">●</span>
          </button>

          <button
            type="button"
            class="menu-item"
            [class.active]="charMovementMode() === 'diagonal'"
            (click)="setCharMovementMode('diagonal')"
          >
            <span class="item-icon">↗️</span>
            <span class="item-text">Move Diagonally</span>
            <span class="active-dot" *ngIf="charMovementMode() === 'diagonal'">●</span>
          </button>

          <button
            type="button"
            class="menu-item stop-item"
            [disabled]="charMovementMode() === 'none'"
            (click)="stopCharMovement()"
          >
            <span class="item-icon">⏹️</span>
            <span class="item-text">Stop Movement</span>
          </button>
        </div>

        <div class="menu-divider"></div>

        <div class="menu-section-label">POSITION & SETTINGS</div>
        <div class="menu-actions-list">
          <button type="button" class="menu-item" (click)="resetCharPosition()">
            <span class="item-icon">↩️</span>
            <span class="item-text">Reset Position</span>
          </button>

          <!-- Character Size Slider & Presets -->
          <div class="menu-slider-block">
            <div class="slider-label-row">
              <span class="slider-title">🔍 Character Size</span>
              <span class="slider-value">{{ charScalePercent() }}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="140"
              step="5"
              [value]="charScalePercent()"
              (input)="onCharScaleChange($event)"
              class="menu-range-slider"
            />
            <div class="size-presets-row">
              <button type="button" class="preset-btn" [class.selected]="charScale() === 0.7" (click)="setCharScale(0.7)">S (70%)</button>
              <button type="button" class="preset-btn" [class.selected]="charScale() === 1.0" (click)="setCharScale(1.0)">M (100%)</button>
              <button type="button" class="preset-btn" [class.selected]="charScale() === 1.15" (click)="setCharScale(1.15)">L (115%)</button>
              <button type="button" class="preset-btn" [class.selected]="charScale() === 1.3" (click)="setCharScale(1.3)">XL (130%)</button>
            </div>
          </div>

          <!-- Movement Speed Slider & Presets -->
          <div class="menu-slider-block">
            <div class="slider-label-row">
              <span class="slider-title">⚡ Movement Speed</span>
              <span class="slider-value">{{ charSpeed() }}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              [value]="charSpeed()"
              (input)="onCharSpeedChange($event)"
              class="menu-range-slider"
            />
            <div class="speed-presets-row">
              <button type="button" class="preset-btn" [class.selected]="charSpeed() === 1.5" (click)="setCharSpeed(1.5)">Slow</button>
              <button type="button" class="preset-btn" [class.selected]="charSpeed() === 3" (click)="setCharSpeed(3)">Normal</button>
              <button type="button" class="preset-btn" [class.selected]="charSpeed() === 5" (click)="setCharSpeed(5)">Fast</button>
              <button type="button" class="preset-btn" [class.selected]="charSpeed() === 8" (click)="setCharSpeed(8)">Turbo</button>
            </div>
          </div>

          <!-- Change Character Image -->
          <button type="button" class="menu-item" (click)="triggerCharImageUpload()">
            <span class="item-icon">🖼️</span>
            <span class="item-text">Change Character Image...</span>
          </button>

          <!-- Restore Default Character Cutout -->
          <button
            type="button"
            class="menu-item text-danger"
            *ngIf="hasCharCustomImage()"
            (click)="resetDefaultCharImage()"
          >
            <span class="item-icon">🔄</span>
            <span class="item-text">Restore Default Character</span>
          </button>
        </div>
      </div>

      <!-- ────────────────────────────────────────────────────────────── -->
      <!-- 7. CHANGE CHARACTER IMAGE PREVIEW MODAL                        -->
      <!-- ────────────────────────────────────────────────────────────── -->
      <div
        class="agent-modal-backdrop"
        *ngIf="showCharImageModal()"
        (click)="closeCharImageModal()"
      >
        <div class="agent-modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-row">
              <span class="modal-icon">🖼️</span>
              <h4 class="modal-title">Change Character Image</h4>
            </div>
            <button type="button" class="modal-close-btn" (click)="closeCharImageModal()">✕</button>
          </div>

          <div class="modal-body">
            <div class="avatar-preview-box">
              <div class="preview-char-box">
                <img
                  *ngIf="pendingCharPreviewImage"
                  [src]="pendingCharPreviewImage"
                  alt="Preview Character"
                  class="preview-char-img"
                />
                <span *ngIf="!pendingCharPreviewImage" class="no-preview-txt">No Image</span>
              </div>
              <div class="preview-file-info" *ngIf="pendingCharFileName">
                <span class="file-name">{{ pendingCharFileName }}</span>
                <span class="file-size">{{ pendingCharFileSize }}</span>
              </div>
            </div>

            <div class="modal-error-alert" *ngIf="charImageErrorMessage">
              <span>⚠️ {{ charImageErrorMessage }}</span>
            </div>

            <p class="modal-desc">
              Select an image from your computer to replace the U2 Assistant character. Supported formats: PNG, JPG, WEBP, SVG, GIF (max 5MB).
            </p>

            <div class="modal-upload-bar">
              <button type="button" class="btn-choose-file" (click)="triggerCharImageUpload()">
                📁 Choose File...
              </button>
              <button
                type="button"
                class="btn-reset-default"
                *ngIf="hasCharCustomImage()"
                (click)="resetDefaultCharImageFromModal()"
              >
                Restore Original
              </button>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-modal-cancel" (click)="closeCharImageModal()">
              Cancel
            </button>
            <button
              type="button"
              class="btn-modal-apply"
              [disabled]="!pendingCharPreviewImage"
              (click)="applyPendingCharImage()"
            >
              Apply Character Image
            </button>
          </div>
        </div>
      </div>

      <!-- Hidden Local File Input for Character Image -->
      <input
        #charFileInput
        type="file"
        class="hidden-file-input"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        (change)="onCharFileSelected($event)"
      />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
      font-family: var(--font-family, 'Inter', -apple-system, sans-serif);
      overflow: hidden;
    }

    .ai-assistant-wrapper {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .ai-assistant-wrapper.chat-open:not(.chat-minimized) {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    /* ══════════════════════════════════════════════════════════════════ */
    /* TRANSPARENT GLASSMORPHISM CHAT WINDOW                              */
    /* ══════════════════════════════════════════════════════════════════ */
    .glass-chat-window {
      position: fixed;
      bottom: 24px;
      right: 360px;
      pointer-events: auto;
      z-index: 10000;
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
    /* CHARACTER DOCK (RIGHT SIDE - DRAGGABLE & CONTINUOUS MOVEMENT)     */
    /* ══════════════════════════════════════════════════════════════════ */
    .character-dock-container {
      position: fixed;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      cursor: grab;
      user-select: none;
      touch-action: none;
      pointer-events: auto;
      z-index: 10002;
      animation: fadeInCharacter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      transition: filter 0.2s ease, opacity 0.2s ease;
    }

    .character-dock-container.is-dragging {
      cursor: grabbing !important;
      opacity: 0.95;
    }

    .character-dock-container.is-moving {
      filter: drop-shadow(0 0 18px rgba(56, 189, 248, 0.6));
    }

    .character-scaler {
      width: 320px;
      height: 530px;
      transform-origin: top left;
      pointer-events: auto;
    }

    .char-moving-indicator {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: #ffffff;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 14px;
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.45);
      cursor: pointer;
      white-space: nowrap;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 4px;
      animation: bouncePulse 1.5s infinite;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .char-moving-indicator:hover {
      background: #ef4444;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
    }

    @keyframes bouncePulse {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-3px); }
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

    .floating-launcher {
      position: absolute;
      display: flex;
      align-items: center;
      cursor: grab;
      user-select: none;
      touch-action: none;
      pointer-events: auto;
      z-index: 9999;
      transition: transform 0.15s ease-out;
    }

    .floating-launcher.is-dragging {
      cursor: grabbing;
      transition: none;
    }

    .floating-launcher.is-moving {
      transition: none;
    }

    .launcher-bubble {
      position: absolute;
      right: calc(100% + 14px);
      top: 50%;
      transform: translateY(-50%);
      background: var(--bg-card, rgba(255, 255, 255, 0.92));
      color: var(--text-primary, #1e1e2f);
      padding: 8px 14px;
      border-radius: 16px;
      font-size: 0.8rem;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.4));
      backdrop-filter: blur(12px);
      white-space: nowrap;
      animation: floatTooltip 3s ease-in-out infinite alternate;
      cursor: pointer;
      pointer-events: auto;
    }

    .launcher-bubble.flip-right {
      right: auto;
      left: calc(100% + 14px);
    }

    .launcher-bubble.flip-right .bubble-arrow {
      right: auto;
      left: -6px;
      border-left: none;
      border-right: 6px solid var(--bg-card, rgba(255, 255, 255, 0.92));
    }

    @keyframes floatTooltip {
      0% { transform: translateY(-50%) translateY(0); }
      100% { transform: translateY(-50%) translateY(-4px); }
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
      border-left: 6px solid var(--bg-card, rgba(255, 255, 255, 0.92));
    }

    .launcher-avatar-btn {
      position: relative;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .launcher-avatar-btn:hover {
      transform: scale(1.08);
    }

    .launcher-img {
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

    .movement-mini-badge {
      position: absolute;
      bottom: -3px;
      right: -3px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 0.72rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      z-index: 4;
      animation: miniPulse 1.5s infinite;
    }

    @keyframes miniPulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }

    /* ══════════════════════════════════════════════════════════════════ */
    /* AGENT CONTEXT MENU                                                 */
    /* ══════════════════════════════════════════════════════════════════ */
    .agent-context-menu {
      position: fixed;
      z-index: 10000;
      width: 270px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      padding: 12px;
      pointer-events: auto;
      font-size: 0.84rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: menuFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes menuFadeIn {
      0% { opacity: 0; transform: scale(0.95); }
      100% { opacity: 1; transform: scale(1); }
    }

    .menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .menu-title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 0.84rem;
      color: #ffffff;
    }

    .menu-agent-icon {
      font-size: 0.95rem;
    }

    .menu-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 0.85rem;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.15s;
    }

    .menu-close-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .menu-section-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      color: #94a3b8;
      padding: 4px 6px 2px;
      text-transform: uppercase;
    }

    .menu-actions-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 7px 10px;
      border-radius: 8px;
      background: transparent;
      border: none;
      color: #cbd5e1;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s, color 0.15s;
    }

    .menu-item:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .menu-item.active {
      background: rgba(37, 99, 235, 0.35);
      color: #93c5fd;
      font-weight: 600;
      border: 1px solid rgba(59, 130, 246, 0.4);
    }

    .menu-item:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .menu-item.text-danger {
      color: #f87171;
    }

    .menu-item.text-danger:hover {
      background: rgba(239, 68, 68, 0.18);
      color: #fca5a5;
    }

    .item-icon {
      font-size: 0.95rem;
      width: 18px;
      text-align: center;
    }

    .item-text {
      flex: 1;
    }

    .active-dot {
      color: #60a5fa;
      font-size: 0.75rem;
    }

    .menu-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 3px 0;
    }

    .menu-slider-block {
      padding: 7px 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin: 2px 0;
    }

    .slider-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: #cbd5e1;
      font-weight: 500;
    }

    .slider-value {
      color: #38bdf8;
      font-weight: 700;
      font-size: 0.75rem;
    }

    .menu-range-slider {
      width: 100%;
      accent-color: #38bdf8;
      height: 4px;
      cursor: pointer;
      margin: 2px 0;
    }

    .size-presets-row,
    .speed-presets-row {
      display: flex;
      gap: 4px;
    }

    .preset-btn {
      flex: 1;
      padding: 3px 4px;
      font-size: 0.7rem;
      font-weight: 500;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s;
    }

    .preset-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    .preset-btn.selected {
      background: #2563eb;
      border-color: #3b82f6;
      color: #ffffff;
      font-weight: 700;
    }

    /* ══════════════════════════════════════════════════════════════════ */
    /* IMAGE PREVIEW MODAL                                                */
    /* ══════════════════════════════════════════════════════════════════ */
    .agent-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10001;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      pointer-events: auto;
      animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalFadeIn {
      0% { opacity: 0; transform: scale(0.96); }
      100% { opacity: 1; transform: scale(1); }
    }

    .agent-modal-dialog {
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }

    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
    }

    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-icon {
      font-size: 1.15rem;
    }

    .modal-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
    }

    .modal-close-btn {
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 1.1rem;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .modal-close-btn:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      text-align: center;
    }

    .avatar-preview-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .preview-avatar-circle {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 3px solid #3b82f6;
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
      overflow: hidden;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-char-box {
      width: 140px;
      height: 200px;
      border-radius: 16px;
      border: 3px solid #3b82f6;
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.25);
      overflow: hidden;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
    }

    .preview-char-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .preview-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .no-preview-txt {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .preview-file-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.75rem;
    }

    .file-name {
      font-weight: 600;
      color: #1e293b;
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      color: #64748b;
    }

    .modal-error-alert {
      width: 100%;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #b91c1c;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.78rem;
      font-weight: 500;
      text-align: left;
    }

    .modal-desc {
      font-size: 0.8rem;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
    }

    .modal-upload-bar {
      display: flex;
      gap: 10px;
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn-choose-file {
      padding: 8px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1d4ed8;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-choose-file:hover {
      background: #dbeafe;
    }

    .btn-reset-default {
      padding: 8px 14px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      color: #475569;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-reset-default:hover {
      background: #f1f5f9;
      color: #0f172a;
    }

    .modal-footer {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn-modal-cancel {
      padding: 8px 16px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-modal-cancel:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }

    .btn-modal-apply {
      padding: 8px 18px;
      background: #2563eb;
      border: none;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #ffffff;
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
    }

    .btn-modal-apply:hover:not(:disabled) {
      background: #1d4ed8;
      transform: translateY(-1px);
    }

    .btn-modal-apply:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .hidden-file-input {
      display: none;
    }

    /* ── Responsive Behavior ── */
    @media (max-width: 900px) {
      .ai-assistant-wrapper.chat-open:not(.chat-minimized) {
        flex-direction: column-reverse;
        align-items: flex-end;
        bottom: 16px;
        right: 16px;
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
  @ViewChild('fileInput') private fileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('charFileInput') private charFileInputRef?: ElementRef<HTMLInputElement>;

  readonly Math = Math;

  userInput = '';
  readonly isVoiceRecording = signal<boolean>(false);
  private speechRecognition?: any;

  // ── Character Cutout Drag, Movement & Customization State ──
  readonly charScale = signal<number>(1.0);
  readonly charSpeed = signal<number>(3);
  readonly charMovementMode = signal<'none' | 'horizontal' | 'vertical' | 'diagonal'>('none');
  readonly isCharDragging = signal<boolean>(false);
  readonly charCustomImage = signal<string | null>(null);
  readonly hasCharCustomImage = computed(() => !!this.charCustomImage());

  readonly baseCharWidth = 320;
  readonly baseCharHeight = 530;
  readonly charWidth = computed(() => Math.round(this.baseCharWidth * this.charScale()));
  readonly charHeight = computed(() => Math.round(this.baseCharHeight * this.charScale()));
  readonly charScalePercent = computed(() => Math.round(this.charScale() * 100));

  readonly charX = signal<number>(
    typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 320 - 24) : 1000
  );
  readonly charY = signal<number>(
    typeof window !== 'undefined' ? Math.max(10, window.innerHeight - 530 - 16) : 400
  );

  // Character Context Menu
  readonly showCharContextMenu = signal<boolean>(false);
  readonly charContextMenuX = signal<number>(0);
  readonly charContextMenuY = signal<number>(0);

  // Character Image Upload Modal
  readonly showCharImageModal = signal<boolean>(false);
  pendingCharPreviewImage: string | null = null;
  pendingCharFileName = '';
  pendingCharFileSize = '';
  charImageErrorMessage = '';

  // Internal Character Movement & Drag tracking
  private charAnimFrameId: number | null = null;
  private charDirX = 1;
  private charDirY = 1;
  private isCharPointerDown = false;
  private hasCharMovedDistance = false;
  private startCharMouseX = 0;
  private startCharMouseY = 0;
  private startCharPosX = 0;
  private startCharPosY = 0;
  private readonly charStorageKey = 'u2_character_image_prefs';

  // ── Drag & Drop, Movement & Customization State (Launcher Badge) ──
  readonly defaultAvatar = 'assets/images/assistant/assistant-avatar-head.png';
  readonly agentX = signal<number>(typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 60 - 28) : 100);
  readonly agentY = signal<number>(typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 60 - 28) : 100);
  readonly agentSize = signal<number>(60);
  readonly agentSpeed = signal<number>(3);
  readonly movementMode = signal<'none' | 'horizontal' | 'vertical' | 'diagonal'>('none');
  readonly isDragging = signal<boolean>(false);

  // Avatar image
  readonly agentImage = signal<string>(this.defaultAvatar);
  readonly hasCustomImage = signal<boolean>(false);

  // Context menu
  readonly showContextMenu = signal<boolean>(false);
  readonly contextMenuX = signal<number>(0);
  readonly contextMenuY = signal<number>(0);

  // Upload preview modal
  readonly showImagePreviewModal = signal<boolean>(false);
  pendingPreviewImage: string | null = null;
  pendingFileName = '';
  pendingFileSize = '';
  imageErrorMessage = '';

  // Internal movement & drag tracking
  private animFrameId: number | null = null;
  private dirX = 1;
  private dirY = 1;
  private isPointerDown = false;
  private hasMovedDistance = false;
  private startMouseX = 0;
  private startMouseY = 0;
  private startAgentX = 0;
  private startAgentY = 0;
  private readonly storageKey = 'u2_floating_agent_prefs';

  ngOnInit(): void {
    this.initSpeechRecognition();
    this.loadPreferences();
    this.loadCharPreferences();
  }

  ngOnDestroy(): void {
    this.cleanupMovement();
    this.cleanupDragListeners();
    this.cleanupCharMovement();
    this.cleanupCharDragListeners();
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch {}
    }
  }

  // ── Preferences Persistence ──
  private loadPreferences(): void {
    if (typeof window === 'undefined') return;

    const defaultSize = 60;
    const defaultSpeed = 3;
    const defaultX = Math.max(16, window.innerWidth - defaultSize - 28);
    const defaultY = Math.max(16, window.innerHeight - defaultSize - 28);

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const prefs = JSON.parse(raw);
        const size = typeof prefs.size === 'number' && prefs.size >= 36 && prefs.size <= 120 ? prefs.size : defaultSize;
        const speed = typeof prefs.speed === 'number' && prefs.speed >= 1 && prefs.speed <= 10 ? prefs.speed : defaultSpeed;
        const maxX = Math.max(0, window.innerWidth - size);
        const maxY = Math.max(0, window.innerHeight - size);

        let x = typeof prefs.posX === 'number' ? prefs.posX : defaultX;
        let y = typeof prefs.posY === 'number' ? prefs.posY : defaultY;
        x = Math.max(0, Math.min(maxX, x));
        y = Math.max(0, Math.min(maxY, y));

        this.agentSize.set(size);
        this.agentSpeed.set(speed);
        this.agentX.set(x);
        this.agentY.set(y);

        if (prefs.customImage && typeof prefs.customImage === 'string') {
          this.agentImage.set(prefs.customImage);
          this.hasCustomImage.set(true);
        }

        if (prefs.movementMode && ['horizontal', 'vertical', 'diagonal'].includes(prefs.movementMode)) {
          this.setMovementMode(prefs.movementMode, false);
        }
        return;
      }
    } catch (e) {
      console.warn('Failed to parse agent preferences', e);
    }

    this.agentSize.set(defaultSize);
    this.agentSpeed.set(defaultSpeed);
    this.agentX.set(defaultX);
    this.agentY.set(defaultY);
  }

  savePreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      const prefs = {
        posX: this.agentX(),
        posY: this.agentY(),
        size: this.agentSize(),
        speed: this.agentSpeed(),
        movementMode: this.movementMode(),
        customImage: this.hasCustomImage() ? this.agentImage() : null
      };
      localStorage.setItem(this.storageKey, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save agent preferences', e);
    }
  }

  // ── Drag & Drop ──
  onLauncherMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // left click only
    this.startDrag(event.clientX, event.clientY);
  }

  onLauncherTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.startDrag(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  private startDrag(clientX: number, clientY: number): void {
    this.isPointerDown = true;
    this.hasMovedDistance = false;
    this.startMouseX = clientX;
    this.startMouseY = clientY;
    this.startAgentX = this.agentX();
    this.startAgentY = this.agentY();

    this.closeContextMenu();

    window.addEventListener('mousemove', this.onWindowMouseMove, { passive: false });
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('touchmove', this.onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', this.onWindowTouchEnd);
  }

  private onWindowMouseMove = (event: MouseEvent): void => {
    if (!this.isPointerDown) return;
    this.updateDrag(event.clientX, event.clientY);
  };

  private onWindowTouchMove = (event: TouchEvent): void => {
    if (!this.isPointerDown || event.touches.length !== 1) return;
    this.updateDrag(event.touches[0].clientX, event.touches[0].clientY);
  };

  private updateDrag(clientX: number, clientY: number): void {
    const deltaX = clientX - this.startMouseX;
    const deltaY = clientY - this.startMouseY;

    if (!this.hasMovedDistance && Math.hypot(deltaX, deltaY) > 4) {
      this.hasMovedDistance = true;
      this.isDragging.set(true);
      if (this.movementMode() !== 'none') {
        this.stopMovement(false);
      }
    }

    if (this.hasMovedDistance) {
      const size = this.agentSize();
      const maxX = Math.max(0, window.innerWidth - size);
      const maxY = Math.max(0, window.innerHeight - size);

      let newX = this.startAgentX + deltaX;
      let newY = this.startAgentY + deltaY;

      newX = Math.max(0, Math.min(maxX, newX));
      newY = Math.max(0, Math.min(maxY, newY));

      this.agentX.set(Math.round(newX));
      this.agentY.set(Math.round(newY));
    }
  }

  private onWindowMouseUp = (): void => {
    this.endDrag();
  };

  private onWindowTouchEnd = (): void => {
    this.endDrag();
  };

  private endDrag(): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.cleanupDragListeners();

    if (this.hasMovedDistance) {
      this.savePreferences();
      setTimeout(() => {
        this.isDragging.set(false);
      }, 50);
    } else {
      this.isDragging.set(false);
    }
  }

  private cleanupDragListeners(): void {
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    window.removeEventListener('touchmove', this.onWindowTouchMove);
    window.removeEventListener('touchend', this.onWindowTouchEnd);
  }

  onLauncherClick(event: MouseEvent): void {
    if (this.hasMovedDistance) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.assistantService.openChat();
  }

  // ── Context Menu ──
  onLauncherContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 270;
    const menuHeight = 520;
    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > window.innerWidth - 12) {
      x = window.innerWidth - menuWidth - 12;
    }
    if (y + menuHeight > window.innerHeight - 12) {
      y = window.innerHeight - menuHeight - 12;
    }
    x = Math.max(12, x);
    y = Math.max(12, y);

    this.contextMenuX.set(x);
    this.contextMenuY.set(y);
    this.showContextMenu.set(true);
  }

  closeContextMenu(): void {
    this.showContextMenu.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showContextMenu()) {
      this.closeContextMenu();
    }
    if (this.showCharContextMenu()) {
      this.closeCharContextMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showContextMenu()) {
      this.closeContextMenu();
    }
    if (this.showImagePreviewModal()) {
      this.closeImagePreviewModal();
    }
    if (this.showCharContextMenu()) {
      this.closeCharContextMenu();
    }
    if (this.showCharImageModal()) {
      this.closeCharImageModal();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    // 1. Clamp launcher badge
    const size = this.agentSize();
    const maxX = Math.max(0, window.innerWidth - size);
    const maxY = Math.max(0, window.innerHeight - size);

    let curX = this.agentX();
    let curY = this.agentY();
    let adjusted = false;

    if (curX > maxX) {
      curX = maxX;
      adjusted = true;
    }
    if (curY > maxY) {
      curY = maxY;
      adjusted = true;
    }

    if (adjusted) {
      this.agentX.set(curX);
      this.agentY.set(curY);
      this.savePreferences();
    }

    // 2. Clamp character stage
    const charW = this.charWidth();
    const charH = this.charHeight();
    const maxCharX = Math.max(0, window.innerWidth - charW);
    const maxCharY = Math.max(0, window.innerHeight - charH);

    let curCharX = this.charX();
    let curCharY = this.charY();
    let charAdjusted = false;

    if (curCharX > maxCharX) {
      curCharX = maxCharX;
      charAdjusted = true;
    }
    if (curCharY > maxCharY) {
      curCharY = maxCharY;
      charAdjusted = true;
    }

    if (charAdjusted) {
      this.charX.set(curCharX);
      this.charY.set(curCharY);
      this.saveCharPreferences();
    }
  }

  // ── Movement Engine ──
  setMovementMode(mode: 'horizontal' | 'vertical' | 'diagonal', save = true): void {
    if (this.movementMode() === mode) {
      this.stopMovement(save);
      return;
    }

    this.cleanupMovement();
    this.movementMode.set(mode);
    this.dirX = 1;
    this.dirY = 1;

    if (save) {
      this.savePreferences();
    }

    this.animFrameId = requestAnimationFrame(this.moveLoop);
    this.closeContextMenu();
  }

  stopMovement(save = true): void {
    this.cleanupMovement();
    this.movementMode.set('none');
    if (save) {
      this.savePreferences();
    }
  }

  private cleanupMovement(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private moveLoop = (): void => {
    if (this.movementMode() === 'none') {
      this.animFrameId = null;
      return;
    }

    const size = this.agentSize();
    const maxX = Math.max(0, window.innerWidth - size);
    const maxY = Math.max(0, window.innerHeight - size);
    const spd = this.agentSpeed();
    const mode = this.movementMode();

    let curX = this.agentX();
    let curY = this.agentY();

    if (mode === 'horizontal' || mode === 'diagonal') {
      curX += this.dirX * spd;
      if (curX >= maxX) {
        curX = maxX;
        this.dirX = -1;
      } else if (curX <= 0) {
        curX = 0;
        this.dirX = 1;
      }
    }

    if (mode === 'vertical' || mode === 'diagonal') {
      curY += this.dirY * spd;
      if (curY >= maxY) {
        curY = maxY;
        this.dirY = -1;
      } else if (curY <= 0) {
        curY = 0;
        this.dirY = 1;
      }
    }

    this.agentX.set(Math.round(curX * 10) / 10);
    this.agentY.set(Math.round(curY * 10) / 10);

    this.animFrameId = requestAnimationFrame(this.moveLoop);
  };

  resetPosition(): void {
    this.stopMovement(false);
    const size = this.agentSize();
    const x = Math.max(16, window.innerWidth - size - 28);
    const y = Math.max(16, window.innerHeight - size - 28);
    this.agentX.set(x);
    this.agentY.set(y);
    this.savePreferences();
    this.closeContextMenu();
  }

  onSizeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val)) {
      this.setSize(val);
    }
  }

  setSize(size: number): void {
    this.agentSize.set(size);
    const maxX = Math.max(0, window.innerWidth - size);
    const maxY = Math.max(0, window.innerHeight - size);
    if (this.agentX() > maxX) this.agentX.set(maxX);
    if (this.agentY() > maxY) this.agentY.set(maxY);
    this.savePreferences();
  }

  onSpeedChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
      this.setSpeed(val);
    }
  }

  setSpeed(speed: number): void {
    this.agentSpeed.set(speed);
    this.savePreferences();
  }

  // ── Change Agent Image ──
  triggerImageUpload(): void {
    this.closeContextMenu();
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
      this.fileInputRef.nativeElement.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];

    if (!validTypes.includes(file.type.toLowerCase())) {
      this.imageErrorMessage = 'Unsupported format (' + (file.type || 'unknown') + '). Please select PNG, JPG, WEBP, SVG, or GIF.';
      this.pendingPreviewImage = null;
      this.showImagePreviewModal.set(true);
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.imageErrorMessage = 'File size (' + (file.size / (1024 * 1024)).toFixed(1) + 'MB) exceeds 5MB limit.';
      this.pendingPreviewImage = null;
      this.showImagePreviewModal.set(true);
      return;
    }

    this.imageErrorMessage = '';
    this.pendingFileName = file.name;
    this.pendingFileSize = (file.size / 1024).toFixed(0) + ' KB';

    const reader = new FileReader();
    reader.onload = (e) => {
      this.pendingPreviewImage = e.target?.result as string;
      this.showImagePreviewModal.set(true);
    };
    reader.readAsDataURL(file);
  }

  closeImagePreviewModal(): void {
    this.showImagePreviewModal.set(false);
    this.pendingPreviewImage = null;
    this.imageErrorMessage = '';
  }

  applyPendingImage(): void {
    if (!this.pendingPreviewImage) return;
    this.agentImage.set(this.pendingPreviewImage);
    this.hasCustomImage.set(true);
    this.savePreferences();
    this.closeImagePreviewModal();
  }

  resetDefaultImage(): void {
    this.agentImage.set(this.defaultAvatar);
    this.hasCustomImage.set(false);
    this.savePreferences();
    this.closeContextMenu();
  }

  resetDefaultImageFromModal(): void {
    this.agentImage.set(this.defaultAvatar);
    this.hasCustomImage.set(false);
    this.savePreferences();
    this.closeImagePreviewModal();
  }

  // ── Chat & Theme Handlers ──
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

  // ══════════════════════════════════════════════════════════════════════════
  // CHARACTER IMAGE: DRAG & DROP, CONTINUOUS MOVEMENT & CUSTOMIZATION ENGINE
  // ══════════════════════════════════════════════════════════════════════════

  // ── Preferences Persistence ──
  private loadCharPreferences(): void {
    if (typeof window === 'undefined') return;

    const defaultScale = 1.0;
    const defaultSpeed = 3;
    const defaultW = Math.round(this.baseCharWidth * defaultScale);
    const defaultH = Math.round(this.baseCharHeight * defaultScale);
    const defaultX = Math.max(10, window.innerWidth - defaultW - 24);
    const defaultY = Math.max(10, window.innerHeight - defaultH - 16);

    try {
      const raw = localStorage.getItem(this.charStorageKey);
      if (raw) {
        const prefs = JSON.parse(raw);
        const scale = typeof prefs.scale === 'number' && prefs.scale >= 0.5 && prefs.scale <= 1.5 ? prefs.scale : defaultScale;
        const speed = typeof prefs.speed === 'number' && prefs.speed >= 1 && prefs.speed <= 8 ? prefs.speed : defaultSpeed;
        this.charScale.set(scale);
        this.charSpeed.set(speed);

        const w = Math.round(this.baseCharWidth * scale);
        const h = Math.round(this.baseCharHeight * scale);
        const maxX = Math.max(0, window.innerWidth - w);
        const maxY = Math.max(0, window.innerHeight - h);

        let x = typeof prefs.posX === 'number' ? prefs.posX : defaultX;
        let y = typeof prefs.posY === 'number' ? prefs.posY : defaultY;
        x = Math.max(0, Math.min(maxX, x));
        y = Math.max(0, Math.min(maxY, y));

        this.charX.set(x);
        this.charY.set(y);

        if (prefs.customImage && typeof prefs.customImage === 'string') {
          this.charCustomImage.set(prefs.customImage);
        }

        if (prefs.movementMode && ['horizontal', 'vertical', 'diagonal'].includes(prefs.movementMode)) {
          this.setCharMovementMode(prefs.movementMode, false);
        }
        return;
      }
    } catch (e) {
      console.warn('Failed to parse character preferences', e);
    }

    this.charScale.set(defaultScale);
    this.charSpeed.set(defaultSpeed);
    this.charX.set(defaultX);
    this.charY.set(defaultY);
  }

  saveCharPreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      const prefs = {
        posX: this.charX(),
        posY: this.charY(),
        scale: this.charScale(),
        speed: this.charSpeed(),
        movementMode: this.charMovementMode(),
        customImage: this.charCustomImage()
      };
      localStorage.setItem(this.charStorageKey, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save character preferences', e);
    }
  }

  // ── Drag & Drop for Character Cutout ──
  onCharMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // Left click only
    this.startCharDrag(event.clientX, event.clientY);
  }

  onCharTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.startCharDrag(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  private startCharDrag(clientX: number, clientY: number): void {
    this.isCharPointerDown = true;
    this.hasCharMovedDistance = false;
    this.startCharMouseX = clientX;
    this.startCharMouseY = clientY;
    this.startCharPosX = this.charX();
    this.startCharPosY = this.charY();

    this.closeCharContextMenu();

    window.addEventListener('mousemove', this.onCharWindowMouseMove, { passive: false });
    window.addEventListener('mouseup', this.onCharWindowMouseUp);
    window.addEventListener('touchmove', this.onCharWindowTouchMove, { passive: false });
    window.addEventListener('touchend', this.onCharWindowTouchEnd);
  }

  private onCharWindowMouseMove = (event: MouseEvent): void => {
    if (!this.isCharPointerDown) return;
    this.updateCharDrag(event.clientX, event.clientY);
  };

  private onCharWindowTouchMove = (event: TouchEvent): void => {
    if (!this.isCharPointerDown || event.touches.length !== 1) return;
    this.updateCharDrag(event.touches[0].clientX, event.touches[0].clientY);
  };

  private updateCharDrag(clientX: number, clientY: number): void {
    const deltaX = clientX - this.startCharMouseX;
    const deltaY = clientY - this.startCharMouseY;

    if (!this.hasCharMovedDistance && Math.hypot(deltaX, deltaY) > 5) {
      this.hasCharMovedDistance = true;
      this.isCharDragging.set(true);
      if (this.charMovementMode() !== 'none') {
        this.stopCharMovement(false);
      }
    }

    if (this.hasCharMovedDistance) {
      const w = this.charWidth();
      const h = this.charHeight();
      const maxX = Math.max(0, window.innerWidth - w);
      const maxY = Math.max(0, window.innerHeight - h);

      let newX = this.startCharPosX + deltaX;
      let newY = this.startCharPosY + deltaY;

      newX = Math.max(0, Math.min(maxX, newX));
      newY = Math.max(0, Math.min(maxY, newY));

      this.charX.set(Math.round(newX));
      this.charY.set(Math.round(newY));
    }
  }

  private onCharWindowMouseUp = (): void => {
    this.endCharDrag();
  };

  private onCharWindowTouchEnd = (): void => {
    this.endCharDrag();
  };

  private endCharDrag(): void {
    if (!this.isCharPointerDown) return;
    this.isCharPointerDown = false;
    this.cleanupCharDragListeners();

    if (this.hasCharMovedDistance) {
      this.saveCharPreferences();
      setTimeout(() => {
        this.isCharDragging.set(false);
      }, 50);
    } else {
      this.isCharDragging.set(false);
    }
  }

  private cleanupCharDragListeners(): void {
    window.removeEventListener('mousemove', this.onCharWindowMouseMove);
    window.removeEventListener('mouseup', this.onCharWindowMouseUp);
    window.removeEventListener('touchmove', this.onCharWindowTouchMove);
    window.removeEventListener('touchend', this.onCharWindowTouchEnd);
  }

  onCharacterClick(): void {
    if (this.hasCharMovedDistance) {
      return;
    }
    this.assistantService.setPose('happy');
  }

  // ── Character Context Menu ──
  onCharContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 280;
    const menuHeight = 540;
    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > window.innerWidth - 12) {
      x = window.innerWidth - menuWidth - 12;
    }
    if (y + menuHeight > window.innerHeight - 12) {
      y = window.innerHeight - menuHeight - 12;
    }
    x = Math.max(12, x);
    y = Math.max(12, y);

    this.charContextMenuX.set(x);
    this.charContextMenuY.set(y);
    this.showCharContextMenu.set(true);
  }

  closeCharContextMenu(): void {
    this.showCharContextMenu.set(false);
  }

  // ── Character Movement Engine ──
  setCharMovementMode(mode: 'none' | 'horizontal' | 'vertical' | 'diagonal', save = true): void {
    if (this.charMovementMode() === mode) {
      this.stopCharMovement(save);
      return;
    }

    this.cleanupCharMovement();
    this.charMovementMode.set(mode);
    this.charDirX = 1;
    this.charDirY = 1;

    if (save) {
      this.saveCharPreferences();
    }

    if (mode !== 'none') {
      this.charAnimFrameId = requestAnimationFrame(this.charMoveLoop);
    }
    this.closeCharContextMenu();
  }

  stopCharMovement(save = true): void {
    this.cleanupCharMovement();
    this.charMovementMode.set('none');
    if (save) {
      this.saveCharPreferences();
    }
  }

  private cleanupCharMovement(): void {
    if (this.charAnimFrameId !== null) {
      cancelAnimationFrame(this.charAnimFrameId);
      this.charAnimFrameId = null;
    }
  }

  private charMoveLoop = (): void => {
    if (this.charMovementMode() === 'none') {
      this.charAnimFrameId = null;
      return;
    }

    const w = this.charWidth();
    const h = this.charHeight();
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    const spd = this.charSpeed();
    const mode = this.charMovementMode();

    let curX = this.charX();
    let curY = this.charY();

    if (mode === 'horizontal' || mode === 'diagonal') {
      curX += this.charDirX * spd;
      if (curX >= maxX) {
        curX = maxX;
        this.charDirX = -1;
      } else if (curX <= 0) {
        curX = 0;
        this.charDirX = 1;
      }
    }

    if (mode === 'vertical' || mode === 'diagonal') {
      curY += this.charDirY * spd;
      if (curY >= maxY) {
        curY = maxY;
        this.charDirY = -1;
      } else if (curY <= 0) {
        curY = 0;
        this.charDirY = 1;
      }
    }

    this.charX.set(Math.round(curX * 10) / 10);
    this.charY.set(Math.round(curY * 10) / 10);

    this.charAnimFrameId = requestAnimationFrame(this.charMoveLoop);
  };

  resetCharPosition(): void {
    this.stopCharMovement(false);
    const w = this.charWidth();
    const h = this.charHeight();
    const defaultX = Math.max(10, window.innerWidth - w - 24);
    const defaultY = Math.max(10, window.innerHeight - h - 16);
    this.charX.set(defaultX);
    this.charY.set(defaultY);
    this.saveCharPreferences();
    this.closeCharContextMenu();
  }

  // ── Character Size & Speed ──
  setCharScale(scale: number): void {
    const clamped = Math.max(0.5, Math.min(1.5, scale));
    this.charScale.set(Math.round(clamped * 100) / 100);
    const w = this.charWidth();
    const h = this.charHeight();
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    if (this.charX() > maxX) this.charX.set(maxX);
    if (this.charY() > maxY) this.charY.set(maxY);
    this.saveCharPreferences();
  }

  onCharScaleChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
      this.setCharScale(val / 100);
    }
  }

  setCharSpeed(speed: number): void {
    this.charSpeed.set(speed);
    this.saveCharPreferences();
  }

  onCharSpeedChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
      this.setCharSpeed(val);
    }
  }

  // ── Change Character Image ──
  triggerCharImageUpload(): void {
    this.closeCharContextMenu();
    if (this.charFileInputRef?.nativeElement) {
      this.charFileInputRef.nativeElement.value = '';
      this.charFileInputRef.nativeElement.click();
    }
  }

  onCharFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];

    if (!validTypes.includes(file.type.toLowerCase())) {
      this.charImageErrorMessage = 'Unsupported format (' + (file.type || 'unknown') + '). Please select PNG, JPG, WEBP, SVG, or GIF.';
      this.pendingCharPreviewImage = null;
      this.showCharImageModal.set(true);
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.charImageErrorMessage = 'File size (' + (file.size / (1024 * 1024)).toFixed(1) + 'MB) exceeds 5MB limit.';
      this.pendingCharPreviewImage = null;
      this.showCharImageModal.set(true);
      return;
    }

    this.charImageErrorMessage = '';
    this.pendingCharFileName = file.name;
    this.pendingCharFileSize = (file.size / 1024).toFixed(0) + ' KB';

    const reader = new FileReader();
    reader.onload = (e) => {
      this.pendingCharPreviewImage = e.target?.result as string;
      this.showCharImageModal.set(true);
    };
    reader.readAsDataURL(file);
  }

  closeCharImageModal(): void {
    this.showCharImageModal.set(false);
    this.pendingCharPreviewImage = null;
    this.charImageErrorMessage = '';
  }

  applyPendingCharImage(): void {
    if (!this.pendingCharPreviewImage) return;
    this.charCustomImage.set(this.pendingCharPreviewImage);
    this.saveCharPreferences();
    this.closeCharImageModal();
  }

  resetDefaultCharImage(): void {
    this.charCustomImage.set(null);
    this.saveCharPreferences();
    this.closeCharContextMenu();
  }

  resetDefaultCharImageFromModal(): void {
    this.charCustomImage.set(null);
    this.saveCharPreferences();
    this.closeCharImageModal();
  }
}
