import { Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoalDetail } from '../../models/goal-quest.models';
import {
  AiChatMessage,
  AiGeneratedGoalPlan,
  GoalQuestAiService,
} from '../../services/goal-quest-ai.service';

type PreviewTab = 'checkpoints' | 'assessment' | 'timeline' | 'rewards' | 'settings';

@Component({
  selector: 'app-gq-ai-goal-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="ai-backdrop">
      <div class="ai-shell">
        <!-- Top Header -->
        <div class="ai-header">
          <div class="ai-title-wrap">
            <span class="spark-icon">✨</span>
            <div>
              <h2>AI Goal Assistant</h2>
              <p>Tell your goal in natural language. I'll create a complete plan with checkpoints, assessments, timeline, and rewards for you.</p>
            </div>
          </div>
          <div class="ai-header-right">
            <span class="powered-badge">🤖 Powered by U2Tools AI</span>
            <button type="button" class="close-x" (click)="close.emit()" aria-label="Close AI Assistant">✕</button>
          </div>
        </div>

        <!-- Split Body -->
        <div class="ai-body">
          <!-- LEFT: Conversational Chat -->
          <section class="chat-pane">
            <div class="chat-messages">
              @for (msg of messages(); track msg.id) {
                <div class="msg-row" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
                  <div class="msg-avatar">{{ msg.role === 'user' ? '🧑‍🚀' : '🤖' }}</div>
                  <div class="msg-bubble">
                    <p>{{ msg.content }}</p>
                    <span class="msg-time">{{ msg.timestamp | date: 'shortTime' }}</span>
                  </div>
                </div>
              }

              @if (aiService.isGenerating()) {
                <div class="msg-row assistant">
                  <div class="msg-avatar">🤖</div>
                  <div class="msg-bubble thinking">
                    <span>✨ Analyzing your goal &amp; designing checkpoints, questions, and rewards...</span>
                  </div>
                </div>
              }
            </div>

            <!-- Quick Starters / Follow-ups -->
            <div class="prompt-chips">
              @if (!draftPlan()) {
                @for (starter of starterPrompts; track starter) {
                  <button type="button" class="chip-btn" (click)="sendPrompt(starter)">{{ starter }}</button>
                }
              } @else {
                @for (refine of refinePrompts; track refine) {
                  <button type="button" class="chip-btn" (click)="sendPrompt(refine)">{{ refine }}</button>
                }
              }
            </div>

            <!-- Chat Input -->
            <div class="chat-input-bar">
              <input
                type="text"
                [(ngModel)]="promptText"
                (keydown.enter)="onSend()"
                [disabled]="aiService.isGenerating()"
                placeholder="Tell me your goal or ask to modify the plan..."
              />
              <button
                type="button"
                class="send-btn"
                [disabled]="aiService.isGenerating() || !promptText.trim()"
                (click)="onSend()"
              >
                ➤
              </button>
            </div>
          </section>

          <!-- RIGHT: Structured Generated Goal Plan Preview -->
          <section class="preview-pane">
            <div class="preview-top">
              <div>
                <h3>📋 Generated Goal Plan (Preview)</h3>
                <p>Review, edit if needed, and then accept to create this goal in GoalQuest.</p>
              </div>
              @if (draftPlan()) {
                <button
                  type="button"
                  class="btn-regen"
                  [disabled]="aiService.isGenerating()"
                  (click)="regenerate()"
                >
                  🔄 Regenerate Plan
                </button>
              }
            </div>

            @if (!draftPlan()) {
              <div class="empty-preview">
                <div class="bot-art">🤖✨</div>
                <h4>Describe any goal on the left to begin!</h4>
                <p>
                  Example: <em>"I want to get Microsoft Azure AI Fundamentals (AI-900) certification in 2 months. Create a complete plan with checkpoints, assessment questions, and rewards."</em>
                </p>
              </div>
            } @else if (draftPlan(); as plan) {
              <!-- Hero Summary Card -->
              <div class="goal-summary-card">
                <div class="gsc-head">
                  <div class="gsc-badge">🎯</div>
                  <div class="gsc-title-block">
                    @if (isEditMode()) {
                      <input type="text" class="inline-input title-input" [(ngModel)]="plan.title" />
                    } @else {
                      <h4>Goal: {{ plan.title }}</h4>
                    }
                    <div class="gsc-metrics">
                      <span>⏱️ Duration: <strong>{{ plan.totalDurationDays }} Days</strong></span>
                      <span>🎯 Start: <strong>{{ plan.startDate }}</strong></span>
                      <span>📅 Target: <strong>{{ plan.targetDate }}</strong></span>
                      <span>🏆 Difficulty: <strong>{{ plan.difficulty }}</strong></span>
                      <span>🪙 Total Reward: <strong class="gold">{{ totalRewardCash() | number }} G</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 5 Preview Tabs -->
              <div class="preview-tabs">
                <button type="button" [class.active]="previewTab() === 'checkpoints'" (click)="previewTab.set('checkpoints')">
                  📍 Checkpoints ({{ plan.checkpoints.length }})
                </button>
                <button type="button" [class.active]="previewTab() === 'assessment'" (click)="previewTab.set('assessment')">
                  ❓ Assessment ({{ totalQuestionsCount() }})
                </button>
                <button type="button" [class.active]="previewTab() === 'timeline'" (click)="previewTab.set('timeline')">
                  ⏱️ Timeline
                </button>
                <button type="button" [class.active]="previewTab() === 'rewards'" (click)="previewTab.set('rewards')">
                  🎁 Rewards &amp; Rules
                </button>
                <button type="button" [class.active]="previewTab() === 'settings'" (click)="previewTab.set('settings')">
                  ⚙️ Settings
                </button>
              </div>

              <!-- Tab Content -->
              <div class="preview-tab-body">
                <!-- TAB 1: Checkpoints -->
                @if (previewTab() === 'checkpoints') {
                  <div class="cp-table-wrap">
                    <table class="plan-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Checkpoint</th>
                          <th>Interval</th>
                          <th>Target Date</th>
                          <th>Assessment</th>
                          <th>Reward</th>
                          @if (isEditMode()) {
                            <th></th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (cp of plan.checkpoints; track $index; let i = $index) {
                          <tr>
                            <td><span class="seq-orb">{{ i + 1 }}</span></td>
                            <td>
                              @if (isEditMode()) {
                                <input type="text" class="inline-input" [(ngModel)]="cp.title" />
                              } @else {
                                <strong>{{ cp.title }}</strong>
                                <div class="sub-desc">{{ cp.description }}</div>
                              }
                            </td>
                            <td>
                              @if (isEditMode()) {
                                <input type="number" min="1" class="inline-num" [(ngModel)]="cp.intervalValue" />
                              } @else {
                                {{ cp.intervalValue }} {{ cp.intervalUnit }}
                              }
                            </td>
                            <td>
                              @if (isEditMode()) {
                                <input type="date" class="inline-input" [(ngModel)]="cp.dueDate" />
                              } @else {
                                {{ cp.dueDate | date: 'dd MMM yyyy' }}
                              }
                            </td>
                            <td>{{ cp.questions.length }} Qs (≥ {{ cp.passingPercentage }}%)</td>
                            <td class="gold">
                              @if (isEditMode()) {
                                <input type="number" min="0" class="inline-num" [(ngModel)]="cp.rewardCash" />
                              } @else {
                                +{{ cp.rewardCash }} G
                              }
                            </td>
                            @if (isEditMode()) {
                              <td>
                                <button type="button" class="del-mini" (click)="removeCheckpoint(i)" title="Remove checkpoint">🗑️</button>
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                <!-- TAB 2: Assessment Questions -->
                @if (previewTab() === 'assessment') {
                  <div class="q-groups">
                    @for (cp of plan.checkpoints; track $index; let ci = $index) {
                      <div class="q-group-card">
                        <div class="q-group-head">
                          <strong>CP{{ ci + 1 }}: {{ cp.title }}</strong>
                          <span>{{ cp.questions.length }} Questions · Pass {{ cp.passingPercentage }}% · {{ cp.timeLimitMinutes }} Min</span>
                        </div>
                        @for (q of cp.questions; track $index; let qi = $index) {
                          <div class="q-row">
                            <div class="q-row-top">
                              <span class="q-type-tag">{{ q.questionType }} ({{ q.points }} pt)</span>
                              @if (isEditMode()) {
                                <button type="button" class="del-mini" (click)="removeQuestion(ci, qi)">🗑️</button>
                              }
                            </div>
                            @if (isEditMode()) {
                              <input type="text" class="inline-input" [(ngModel)]="q.questionText" />
                            } @else {
                              <div class="q-txt">Q{{ qi + 1 }}. {{ q.questionText }}</div>
                            }
                            <div class="q-ans">
                              <span class="emerald">✓ Answer: {{ q.correctAnswers.join(' | ') }}</span>
                              @if (q.explanation) {
                                <span class="q-exp"> · {{ q.explanation }}</span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

                <!-- TAB 3: Timeline & Strategy -->
                @if (previewTab() === 'timeline') {
                  <div class="strategy-box">
                    <h4>🧭 Overall Completion Strategy</h4>
                    <p>{{ plan.strategy }}</p>
                  </div>
                  <div class="timeline-list">
                    @for (cp of plan.checkpoints; track $index; let i = $index) {
                      <div class="tl-item">
                        <span class="tl-dot">{{ i + 1 }}</span>
                        <div class="tl-content">
                          <strong>{{ cp.title }}</strong>
                          <span class="tl-date">Due {{ cp.dueDate | date: 'dd MMM yyyy' }} ({{ cp.intervalValue }} {{ cp.intervalUnit }})</span>
                          <p>{{ cp.description }}</p>
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- TAB 4: Rewards & Rules -->
                @if (previewTab() === 'rewards') {
                  <div class="rules-grid">
                    <div class="rule-card">
                      <span>📝 Assessment Settings</span>
                      <strong>Pass Mark: {{ plan.passingPercentage }}% · Time: {{ plan.timeLimitMinutes }} Min</strong>
                    </div>
                    <div class="rule-card green">
                      <span>⚡ Early Completion</span>
                      <strong>Double Reward ({{ plan.earlyBonusMultiplier }}x)</strong>
                    </div>
                    <div class="rule-card red">
                      <span>⚠️ Late Completion</span>
                      <strong>Penalty: -{{ plan.defaultLatePenaltyCash }} G</strong>
                    </div>
                    <div class="rule-card blue">
                      <span>🏔️ Recommended Theme</span>
                      <strong>{{ plan.recommendedThemeLabel }}</strong>
                    </div>
                    <div class="rule-card purple">
                      <span>🦸 Recommended Character</span>
                      <strong>{{ plan.recommendedCharacterLabel }}</strong>
                    </div>
                  </div>
                }

                <!-- TAB 5: Settings -->
                @if (previewTab() === 'settings') {
                  <div class="settings-edit-grid">
                    <label>
                      Goal Description
                      <textarea rows="2" [(ngModel)]="plan.description"></textarea>
                    </label>
                    <div class="two-col">
                      <label>
                        Category
                        <input type="text" [(ngModel)]="plan.category" />
                      </label>
                      <label>
                        Priority
                        <select [(ngModel)]="plan.priority">
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </label>
                    </div>
                    <div class="two-col">
                      <label>
                        Target Date
                        <input type="date" [(ngModel)]="plan.targetDate" />
                      </label>
                      <label>
                        Recommended Theme
                        <select [(ngModel)]="plan.recommendedThemeCode">
                          <option value="THEME-FANTASY">Fantasy Kingdom</option>
                          <option value="THEME-JUNGLE">Emerald Jungle</option>
                          <option value="THEME-SPACE">Deep Space Odyssey</option>
                          <option value="THEME-MOUNTAIN">Summit Mountain Peak</option>
                        </select>
                      </label>
                    </div>
                  </div>
                }
              </div>

              <!-- Bottom Info Strip + Approve Actions -->
              <div class="preview-footer">
                <div class="mini-rule-pills">
                  <span class="pill-info">Pass: {{ plan.passingPercentage }}%</span>
                  <span class="pill-green">⚡ Early: {{ plan.earlyBonusMultiplier }}x</span>
                  <span class="pill-red">Late: -{{ plan.defaultLatePenaltyCash }} G</span>
                  <span class="pill-blue">🎨 {{ plan.recommendedThemeLabel }}</span>
                </div>

                <div class="footer-btns">
                  <button type="button" class="btn-edit" (click)="isEditMode.set(!isEditMode())">
                    {{ isEditMode() ? '✓ Done Editing' : '✏️ Edit Plan' }}
                  </button>
                  <button
                    type="button"
                    class="btn-accept"
                    [disabled]="isApplying()"
                    (click)="acceptPlan()"
                  >
                    {{ isApplying() ? 'Creating Quest...' : '✓ Accept Plan & Create Goal' }}
                  </button>
                </div>
              </div>
            }
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .ai-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(5, 8, 24, 0.84);
        backdrop-filter: blur(10px);
        z-index: 1250;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .ai-shell {
        width: 100%;
        max-width: 1220px;
        height: min(88vh, 780px);
        display: flex;
        flex-direction: column;
        background: linear-gradient(155deg, #131c42 0%, #0a0f26 100%);
        border: 1.5px solid rgba(139, 92, 246, 0.55);
        border-radius: 22px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.72);
        color: #f8fafc;
        overflow: hidden;
      }

      .ai-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.9rem 1.35rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        background: rgba(15, 23, 52, 0.85);
      }

      .ai-title-wrap {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        h2 {
          margin: 0;
          font-size: 1.2rem;
        }
        p {
          margin: 0.15rem 0 0;
          font-size: 0.8rem;
          color: #93c5fd;
        }
      }

      .spark-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: linear-gradient(135deg, #7c3aed, #2563eb);
        display: grid;
        place-items: center;
        font-size: 1.3rem;
      }

      .ai-header-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .powered-badge {
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(96, 165, 250, 0.45);
        color: #dbeafe;
        padding: 0.32rem 0.75rem;
        border-radius: 999px;
        font-size: 0.76rem;
        font-weight: 700;
      }

      .close-x {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        cursor: pointer;
      }

      .ai-body {
        flex: 1;
        display: grid;
        grid-template-columns: 360px 1fr;
        min-height: 0;
      }

      /* ─── Chat Pane ─── */
      .chat-pane {
        display: flex;
        flex-direction: column;
        border-right: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(9, 14, 34, 0.65);
        min-height: 0;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
      }

      .msg-row {
        display: flex;
        gap: 0.55rem;
        align-items: flex-start;

        &.user .msg-bubble {
          background: rgba(37, 99, 235, 0.28);
          border-color: rgba(96, 165, 250, 0.4);
        }
        &.assistant .msg-bubble {
          background: rgba(124, 58, 237, 0.24);
          border-color: rgba(168, 85, 247, 0.45);
        }
      }

      .msg-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(30, 41, 59, 0.9);
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }

      .msg-bubble {
        flex: 1;
        padding: 0.65rem 0.85rem;
        border-radius: 14px;
        border: 1px solid transparent;
        font-size: 0.84rem;
        line-height: 1.45;
        p {
          margin: 0;
        }
      }

      .msg-time {
        display: block;
        margin-top: 0.3rem;
        font-size: 0.68rem;
        color: #94a3b8;
        text-align: right;
      }

      .thinking {
        color: #fde68a;
      }

      .prompt-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.38rem;
        padding: 0.55rem 0.9rem;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
      }

      .chip-btn {
        background: rgba(30, 41, 59, 0.85);
        border: 1px solid rgba(139, 92, 246, 0.4);
        color: #e9d5ff;
        padding: 0.28rem 0.6rem;
        border-radius: 999px;
        font-size: 0.72rem;
        cursor: pointer;

        &:hover {
          background: rgba(124, 58, 237, 0.35);
        }
      }

      .chat-input-bar {
        display: flex;
        gap: 0.5rem;
        padding: 0.75rem 0.9rem;
        border-top: 1px solid rgba(148, 163, 184, 0.16);

        input {
          flex: 1;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.32);
          border-radius: 11px;
          padding: 0.6rem 0.85rem;
          color: #f8fafc;
          font-size: 0.86rem;
        }
      }

      .send-btn {
        width: 42px;
        border-radius: 11px;
        border: none;
        background: linear-gradient(135deg, #7c3aed, #2563eb);
        color: #fff;
        font-size: 1rem;
        cursor: pointer;

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }

      /* ─── Preview Pane ─── */
      .preview-pane {
        display: flex;
        flex-direction: column;
        padding: 1rem 1.2rem;
        gap: 0.75rem;
        min-height: 0;
        overflow: hidden;
      }

      .preview-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;

        h3 {
          margin: 0;
          font-size: 1.05rem;
        }
        p {
          margin: 0.12rem 0 0;
          font-size: 0.78rem;
          color: #94a3b8;
        }
      }

      .btn-regen {
        background: rgba(124, 58, 237, 0.28);
        border: 1px solid rgba(168, 85, 247, 0.55);
        color: #e9d5ff;
        padding: 0.42rem 0.85rem;
        border-radius: 10px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
      }

      .empty-preview {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2rem;
        background: rgba(15, 23, 42, 0.45);
        border: 1.5px dashed rgba(139, 92, 246, 0.35);
        border-radius: 16px;

        .bot-art {
          font-size: 3.2rem;
          margin-bottom: 0.6rem;
        }
        h4 {
          margin: 0 0 0.4rem;
        }
        p {
          max-width: 480px;
          color: #94a3b8;
          font-size: 0.88rem;
          line-height: 1.5;
        }
      }

      .goal-summary-card {
        background: linear-gradient(135deg, rgba(30, 58, 138, 0.55), rgba(76, 29, 149, 0.5));
        border: 1px solid rgba(139, 92, 246, 0.5);
        border-radius: 14px;
        padding: 0.8rem 1rem;
      }

      .gsc-head {
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }

      .gsc-badge {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.8);
        display: grid;
        place-items: center;
        font-size: 1.4rem;
        flex-shrink: 0;
      }

      .gsc-title-block {
        flex: 1;
        h4 {
          margin: 0 0 0.35rem;
          font-size: 1rem;
        }
      }

      .gsc-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 0.85rem;
        font-size: 0.78rem;
        color: #cbd5e1;
      }

      .preview-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;

        button {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.28);
          color: #cbd5e1;
          padding: 0.4rem 0.8rem;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;

          &.active {
            background: linear-gradient(135deg, #7c3aed, #2563eb);
            border-color: #c4b5fd;
            color: #fff;
          }
        }
      }

      .preview-tab-body {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding-right: 0.25rem;
      }

      .plan-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
        th,
        td {
          padding: 0.55rem 0.6rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          text-align: left;
        }
        th {
          color: #94a3b8;
          font-size: 0.72rem;
          text-transform: uppercase;
        }
      }

      .seq-orb {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #7c3aed;
        color: #fff;
        font-weight: 800;
        font-size: 0.74rem;
      }

      .sub-desc {
        font-size: 0.72rem;
        color: #94a3b8;
        margin-top: 0.12rem;
      }

      .q-groups {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
      }

      .q-group-card {
        background: rgba(15, 23, 42, 0.68);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 12px;
        padding: 0.75rem;
      }

      .q-group-head {
        display: flex;
        justify-content: space-between;
        font-size: 0.82rem;
        margin-bottom: 0.5rem;
        color: #fde68a;
      }

      .q-row {
        padding: 0.45rem 0;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
        font-size: 0.8rem;
      }

      .q-row-top {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.2rem;
      }

      .q-type-tag {
        font-size: 0.68rem;
        color: #93c5fd;
        font-weight: 700;
      }

      .q-ans {
        margin-top: 0.2rem;
        font-size: 0.74rem;
      }
      .q-exp {
        color: #94a3b8;
      }

      .strategy-box {
        background: rgba(30, 58, 138, 0.32);
        border: 1px solid rgba(96, 165, 250, 0.35);
        border-radius: 12px;
        padding: 0.8rem;
        margin-bottom: 0.8rem;
        h4 {
          margin: 0 0 0.3rem;
          font-size: 0.9rem;
        }
        p {
          margin: 0;
          font-size: 0.84rem;
          color: #dbeafe;
        }
      }

      .timeline-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .tl-item {
        display: flex;
        gap: 0.65rem;
        align-items: flex-start;
        background: rgba(15, 23, 42, 0.6);
        padding: 0.65rem;
        border-radius: 11px;
      }

      .tl-dot {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #f59e0b;
        color: #1e1b4b;
        font-weight: 900;
        font-size: 0.75rem;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }

      .tl-content {
        .tl-date {
          display: block;
          font-size: 0.74rem;
          color: #93c5fd;
        }
        p {
          margin: 0.2rem 0 0;
          font-size: 0.78rem;
          color: #cbd5e1;
        }
      }

      .rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.65rem;
      }

      .rule-card {
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 12px;
        padding: 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        span {
          font-size: 0.76rem;
          color: #94a3b8;
        }
        strong {
          font-size: 0.9rem;
        }
        &.green {
          border-color: rgba(34, 197, 94, 0.45);
        }
        &.red {
          border-color: rgba(239, 68, 68, 0.45);
        }
        &.blue {
          border-color: rgba(56, 189, 248, 0.45);
        }
        &.purple {
          border-color: rgba(168, 85, 247, 0.45);
        }
      }

      .settings-edit-grid {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.8rem;
          color: #cbd5e1;
        }
        input,
        select,
        textarea {
          background: rgba(15, 23, 42, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 9px;
          padding: 0.5rem 0.7rem;
          color: #f8fafc;
        }
      }

      .two-col {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.7rem;
      }

      .inline-input,
      .inline-num {
        width: 100%;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(139, 92, 246, 0.5);
        border-radius: 7px;
        padding: 0.3rem 0.45rem;
        color: #f8fafc;
        font-size: 0.8rem;
      }
      .inline-num {
        width: 72px;
      }
      .title-input {
        font-size: 0.95rem;
        font-weight: 800;
        margin-bottom: 0.35rem;
      }

      .del-mini {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.85rem;
      }

      .preview-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid rgba(148, 163, 184, 0.18);
      }

      .mini-rule-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        font-size: 0.72rem;
        font-weight: 700;

        span {
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          background: rgba(30, 41, 59, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.25);
        }
        .pill-green {
          color: #86efac;
          border-color: rgba(34, 197, 94, 0.45);
        }
        .pill-red {
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.45);
        }
        .pill-blue {
          color: #bae6fd;
          border-color: rgba(56, 189, 248, 0.45);
        }
      }

      .footer-btns {
        display: flex;
        gap: 0.6rem;
      }

      .btn-edit {
        background: rgba(30, 41, 59, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.38);
        color: #f8fafc;
        font-weight: 700;
        padding: 0.55rem 1rem;
        border-radius: 11px;
        cursor: pointer;
      }

      .btn-accept {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        border: none;
        color: #1e1b4b;
        font-weight: 900;
        padding: 0.55rem 1.2rem;
        border-radius: 11px;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(251, 191, 36, 0.4);

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .gold {
        color: #fbbf24;
        font-weight: 800;
      }
      .emerald {
        color: #4ade80;
      }

      @media (max-width: 960px) {
        .ai-body {
          grid-template-columns: 1fr;
          overflow-y: auto;
        }
        .chat-pane {
          max-height: 290px;
          border-right: none;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        }
      }
    `,
  ],
})
export class AiGoalAssistantComponent {
  readonly aiService = inject(GoalQuestAiService);

  readonly close = output<void>();
  readonly planAccepted = output<GoalDetail>();

  readonly messages = signal<AiChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Hi Hero! ✨ Tell me what goal you want to achieve and your target timeline. I will build a complete roadmap with checkpoints, timed assessments (90% pass), rewards, and strategy!',
      timestamp: new Date().toISOString(),
    },
  ]);

  readonly draftPlan = signal<AiGeneratedGoalPlan | null>(null);
  readonly previewTab = signal<PreviewTab>('checkpoints');
  readonly isEditMode = signal(false);
  readonly isApplying = signal(false);
  promptText = '';
  private lastUserPrompt = '';

  readonly starterPrompts = [
    'Get Microsoft Azure AI-900 certification in 2 months',
    'Learn Python & FastAPI in 45 days',
    'Train to run a 5K in 30 days',
    'Read 5 software architecture books in 60 days',
  ];

  readonly refinePrompts = [
    'Add 1 more checkpoint',
    'Increase rewards by 50%',
    'Make timeline 30 days',
    'Add more hands-on assessment questions',
  ];

  readonly totalRewardCash = computed(() =>
    (this.draftPlan()?.checkpoints ?? []).reduce((sum, cp) => sum + (Number(cp.rewardCash) || 0), 0),
  );

  readonly totalQuestionsCount = computed(() =>
    (this.draftPlan()?.checkpoints ?? []).reduce((sum, cp) => sum + (cp.questions?.length ?? 0), 0),
  );

  async onSend(): Promise<void> {
    const text = this.promptText.trim();
    if (!text || this.aiService.isGenerating()) return;
    this.promptText = '';
    await this.sendPrompt(text);
  }

  async sendPrompt(text: string): Promise<void> {
    if (this.aiService.isGenerating()) return;
    this.lastUserPrompt = text;

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    this.messages.update((list) => [...list, userMsg]);

    const { reply, plan } = await this.aiService.generateOrRefinePlan(
      text,
      this.messages(),
      this.draftPlan(),
    );

    this.draftPlan.set(plan);
    this.messages.update((list) => [
      ...list,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  async regenerate(): Promise<void> {
    if (!this.lastUserPrompt || this.aiService.isGenerating()) return;
    this.draftPlan.set(null);
    await this.sendPrompt(this.lastUserPrompt);
  }

  removeCheckpoint(index: number): void {
    const plan = this.draftPlan();
    if (!plan || plan.checkpoints.length <= 1) return;
    plan.checkpoints.splice(index, 1);
    plan.checkpoints.forEach((cp, idx) => (cp.sequenceOrder = idx + 1));
    this.draftPlan.set({ ...plan });
  }

  removeQuestion(cpIndex: number, qIndex: number): void {
    const plan = this.draftPlan();
    if (!plan) return;
    plan.checkpoints[cpIndex].questions.splice(qIndex, 1);
    this.draftPlan.set({ ...plan });
  }

  async acceptPlan(): Promise<void> {
    const plan = this.draftPlan();
    if (!plan || this.isApplying()) return;

    this.isApplying.set(true);
    try {
      const createdGoal = await this.aiService.applyAcceptedPlan(plan);
      this.planAccepted.emit(createdGoal);
    } finally {
      this.isApplying.set(false);
    }
  }
}
