import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssessmentSession,
  SubmitAssessmentResponse,
} from '../../models/goal-quest.models';
import { GoalQuestApiService } from '../../services/goal-quest-api.service';

@Component({
  selector: 'app-gq-assessment-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="gq-modal-backdrop">
      <div class="gq-modal">
        <div class="modal-header">
          <div>
            <span class="cp-tag">{{ session().checkpointCode }}</span>
            <h3>📝 {{ session().checkpointTitle }} — Assessment</h3>
          </div>
          <div class="header-right">
            @if (!result()) {
              <div class="timer-badge" [class.warning]="remainingSeconds() <= 60">
                ⏱️ {{ formattedTime() }}
              </div>
            }
            <button type="button" class="close-btn" (click)="close.emit()">✕</button>
          </div>
        </div>

        <div class="modal-body">
          @if (!result()) {
            <!-- Meta bar -->
            <div class="meta-strip">
              <span>Pass Mark: <strong>{{ session().passingPercentage }}%</strong></span>
              <span>Reward: <strong class="gold">+{{ session().rewardCash }} G</strong></span>
              <span>Early Bonus: <strong class="emerald">+{{ session().earlyBonusCash }} G</strong></span>
              <span>Late Penalty: <strong class="crimson">-{{ session().latePenaltyCash }} G</strong></span>
            </div>

            @if (session().questions.length === 0) {
              <div class="empty-q">
                <p>No assessment questions are configured for this checkpoint yet.</p>
                <p class="hint">You can submit self-verification to complete this stage or add questions in the Assessment tab.</p>
              </div>
            } @else {
              <div class="questions-list">
                @for (q of session().questions; track q.id; let idx = $index) {
                  <div class="question-card">
                    <div class="q-head">
                      <span class="q-num">Q{{ idx + 1 }}</span>
                      <span class="q-type">{{ formatType(q.questionType) }}</span>
                      <span class="q-pts">{{ q.points }} pt</span>
                    </div>
                    <p class="q-text">{{ q.questionText }}</p>

                    @if (q.questionType === 'ShortAnswer') {
                      <input
                        type="text"
                        class="short-input"
                        placeholder="Type your answer here..."
                        [ngModel]="getShortAnswer(q.id)"
                        (ngModelChange)="setSingleAnswer(q.id, $event)"
                      />
                    } @else if (q.questionType === 'MultipleSelect') {
                      <div class="options-grid">
                        @for (opt of q.options; track opt) {
                          <label class="option-tile" [class.selected]="isSelected(q.id, opt)">
                            <input
                              type="checkbox"
                              [checked]="isSelected(q.id, opt)"
                              (change)="toggleMultiAnswer(q.id, opt)"
                            />
                            <span>{{ opt }}</span>
                          </label>
                        }
                      </div>
                    } @else {
                      <div class="options-grid">
                        @for (opt of q.options; track opt) {
                          <label class="option-tile" [class.selected]="isSelected(q.id, opt)">
                            <input
                              type="radio"
                              [name]="'q-' + q.id"
                              [checked]="isSelected(q.id, opt)"
                              (change)="setSingleAnswer(q.id, opt)"
                            />
                            <span>{{ opt }}</span>
                          </label>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            @if (errorMsg()) {
              <div class="error-banner">{{ errorMsg() }}</div>
            }
          } @else if (result(); as res) {
            <!-- Results View -->
            <div class="result-hero" [class.passed]="res.passed" [class.failed]="!res.passed">
              <div class="result-icon">{{ res.passed ? '🏆' : '⚔️' }}</div>
              <h2>{{ res.passed ? 'Checkpoint Conquered!' : 'Keep Training, Hero!' }}</h2>
              <p class="score-line">
                Score: <strong>{{ res.scorePercent }}%</strong>
                ({{ res.correctAnswers }}/{{ res.totalQuestions }} correct · Pass mark {{ res.passingPercentage }}%)
              </p>

              <div class="reward-chips">
                <span class="chip timing">Timing: {{ res.completionTiming }}</span>
                @if (res.normalRewardAwarded > 0) {
                  <span class="chip reward">+{{ res.normalRewardAwarded }} G Reward</span>
                }
                @if (res.earlyBonusAwarded > 0) {
                  <span class="chip bonus">⚡ +{{ res.earlyBonusAwarded }} G Early Bonus!</span>
                }
                @if (res.latePenaltyDeducted > 0) {
                  <span class="chip penalty">-{{ res.latePenaltyDeducted }} G Late Penalty</span>
                }
                @if (res.alreadyRewarded) {
                  <span class="chip neutral">Already Rewarded (No Duplicate Payout)</span>
                }
              </div>

              @if (res.newlyUnlockedAchievements.length > 0) {
                <div class="ach-unlock-box">
                  @for (ach of res.newlyUnlockedAchievements; track ach.achievementCode) {
                    <div class="ach-row">
                      <span>{{ ach.icon }} Achievement Unlocked: <strong>{{ ach.title }}</strong></span>
                      <span class="gold">+{{ ach.rewardCash }} G</span>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="feedback-list">
              @for (fb of res.feedback; track fb.questionId; let i = $index) {
                <div class="fb-card" [class.correct]="fb.isCorrect" [class.wrong]="!fb.isCorrect">
                  <div class="fb-top">
                    <span>{{ fb.isCorrect ? '✅' : '❌' }} Q{{ i + 1 }}: {{ fb.questionText }}</span>
                  </div>
                  <div class="fb-answers">
                    <span>Your Answer: <strong>{{ fb.submittedAnswers.join(', ') || '(None)' }}</strong></span>
                    @if (!fb.isCorrect) {
                      <span>Correct: <strong class="emerald">{{ fb.correctAnswers.join(', ') }}</strong></span>
                    }
                  </div>
                  @if (fb.explanation) {
                    <p class="fb-exp">{{ fb.explanation }}</p>
                  }
                </div>
              }
            </div>
          }
        </div>

        <div class="modal-footer">
          @if (!result()) {
            <button type="button" class="btn-secondary" (click)="close.emit()">Cancel</button>
            <button
              type="button"
              class="btn-gold"
              [disabled]="isSubmitting()"
              (click)="submit()"
            >
              {{ isSubmitting() ? 'Grading on Server...' : '🚀 Submit Assessment' }}
            </button>
          } @else {
            <button type="button" class="btn-gold" (click)="finish()">
              Continue Adventure →
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .gq-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(5, 8, 22, 0.82);
        backdrop-filter: blur(8px);
        z-index: 1200;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .gq-modal {
        width: 100%;
        max-width: 820px;
        max-height: 92vh;
        display: flex;
        flex-direction: column;
        background: linear-gradient(160deg, #151c3d 0%, #0b1026 100%);
        border: 1px solid rgba(251, 191, 36, 0.4);
        border-radius: 18px;
        color: #f8fafc;
        overflow: hidden;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.35rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      }
      .cp-tag {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #fbbf24;
        font-weight: 700;
      }
      .modal-header h3 {
        margin: 0.15rem 0 0;
        font-size: 1.15rem;
      }
      .header-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .timer-badge {
        background: rgba(59, 130, 246, 0.22);
        border: 1px solid #60a5fa;
        color: #dbeafe;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.9rem;
      }
      .timer-badge.warning {
        background: rgba(239, 68, 68, 0.28);
        border-color: #f87171;
        color: #fecaca;
      }
      .close-btn {
        background: rgba(255, 255, 255, 0.08);
        border: none;
        color: #e2e8f0;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
      }
      .modal-body {
        padding: 1.1rem 1.35rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .meta-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 0.65rem 0.95rem;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.18);
        font-size: 0.85rem;
      }
      .gold {
        color: #fbbf24;
      }
      .emerald {
        color: #34d399;
      }
      .crimson {
        color: #f87171;
      }
      .questions-list {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .question-card {
        background: rgba(30, 41, 59, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 14px;
        padding: 1rem;
      }
      .q-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .q-num {
        background: #7c3aed;
        color: #fff;
        font-weight: 700;
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
      }
      .q-type {
        font-size: 0.75rem;
        color: #93c5fd;
      }
      .q-pts {
        margin-left: auto;
        font-size: 0.75rem;
        color: #cbd5e1;
      }
      .q-text {
        margin: 0 0 0.75rem;
        font-weight: 600;
        line-height: 1.45;
      }
      .options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.55rem;
      }
      .option-tile {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.65rem 0.8rem;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(148, 163, 184, 0.24);
        cursor: pointer;
        font-size: 0.88rem;
      }
      .option-tile.selected {
        background: rgba(124, 58, 237, 0.28);
        border-color: #a855f7;
      }
      .short-input {
        width: 100%;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: #f8fafc;
        border-radius: 10px;
        padding: 0.65rem 0.85rem;
      }
      .result-hero {
        text-align: center;
        padding: 1.25rem;
        border-radius: 16px;
      }
      .result-hero.passed {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(124, 58, 237, 0.22));
        border: 1px solid rgba(52, 211, 153, 0.5);
      }
      .result-hero.failed {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(15, 23, 42, 0.6));
        border: 1px solid rgba(248, 113, 113, 0.5);
      }
      .result-icon {
        font-size: 2.6rem;
      }
      .result-hero h2 {
        margin: 0.3rem 0;
      }
      .reward-chips {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.8rem;
      }
      .chip {
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .chip.timing {
        background: rgba(59, 130, 246, 0.25);
        color: #bfdbfe;
      }
      .chip.reward {
        background: rgba(245, 158, 11, 0.25);
        color: #fde68a;
      }
      .chip.bonus {
        background: rgba(16, 185, 129, 0.25);
        color: #a7f3d0;
      }
      .chip.penalty {
        background: rgba(239, 68, 68, 0.25);
        color: #fecaca;
      }
      .chip.neutral {
        background: rgba(148, 163, 184, 0.22);
        color: #e2e8f0;
      }
      .ach-unlock-box {
        margin-top: 0.9rem;
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(251, 191, 36, 0.45);
        border-radius: 12px;
        padding: 0.7rem 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .ach-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.86rem;
      }
      .feedback-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .fb-card {
        padding: 0.75rem 0.95rem;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.65);
        border-left: 4px solid #64748b;
        font-size: 0.84rem;
      }
      .fb-card.correct {
        border-left-color: #22c55e;
      }
      .fb-card.wrong {
        border-left-color: #ef4444;
      }
      .fb-answers {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin-top: 0.35rem;
        color: #cbd5e1;
      }
      .fb-exp {
        margin: 0.35rem 0 0;
        color: #94a3b8;
        font-size: 0.8rem;
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 0.95rem 1.35rem;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
      }
      .btn-secondary {
        background: rgba(148, 163, 184, 0.18);
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: #e2e8f0;
        padding: 0.55rem 1.1rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .btn-gold {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        border: none;
        color: #1e1b4b;
        font-weight: 800;
        padding: 0.6rem 1.3rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .empty-q {
        text-align: center;
        padding: 1.5rem;
        background: rgba(30, 41, 59, 0.5);
        border-radius: 12px;
      }
      .hint {
        color: #94a3b8;
        font-size: 0.85rem;
      }
      .error-banner {
        padding: 0.7rem 0.9rem;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid #f87171;
        border-radius: 10px;
        color: #fecaca;
      }
    `,
  ],
})
export class AssessmentModalComponent implements OnInit, OnDestroy {
  private readonly api = inject(GoalQuestApiService);

  readonly session = input.required<AssessmentSession>();
  readonly close = output<void>();
  readonly completed = output<SubmitAssessmentResponse>();

  readonly answersMap = signal<Record<number, string[]>>({});
  readonly remainingSeconds = signal(0);
  readonly isSubmitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly result = signal<SubmitAssessmentResponse | null>(null);

  private startedAtUtc = new Date().toISOString();
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  readonly formattedTime = computed(() => {
    const total = Math.max(0, this.remainingSeconds());
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  ngOnInit(): void {
    this.startedAtUtc = new Date().toISOString();
    this.remainingSeconds.set(Math.max(1, this.session().timeLimitMinutes) * 60);
    this.timerHandle = setInterval(() => {
      const next = this.remainingSeconds() - 1;
      this.remainingSeconds.set(next);
      if (next <= 0) {
        this.stopTimer();
        if (!this.result() && !this.isSubmitting()) {
          void this.submit();
        }
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  formatType(type: string): string {
    switch (type) {
      case 'MultipleSelect':
        return 'Multiple Select';
      case 'TrueFalse':
        return 'True / False';
      case 'ShortAnswer':
        return 'Short Answer';
      default:
        return 'Multiple Choice';
    }
  }

  isSelected(questionId: number, option: string): boolean {
    return (this.answersMap()[questionId] ?? []).includes(option);
  }

  getShortAnswer(questionId: number): string {
    return (this.answersMap()[questionId] ?? [])[0] ?? '';
  }

  setSingleAnswer(questionId: number, value: string): void {
    this.answersMap.update((curr) => ({ ...curr, [questionId]: value ? [value] : [] }));
  }

  toggleMultiAnswer(questionId: number, option: string): void {
    this.answersMap.update((curr) => {
      const existing = curr[questionId] ?? [];
      const next = existing.includes(option)
        ? existing.filter((x) => x !== option)
        : [...existing, option];
      return { ...curr, [questionId]: next };
    });
  }

  async submit(): Promise<void> {
    this.stopTimer();
    this.isSubmitting.set(true);
    this.errorMsg.set(null);

    try {
      const map = this.answersMap();
      const answers = this.session().questions.map((q) => ({
        questionId: q.id,
        selectedAnswers: map[q.id] ?? [],
      }));

      const res = await this.api.submitAssessment(this.session().checkpointId, {
        startedAtUtc: this.startedAtUtc,
        answers,
      });
      this.result.set(res);
    } catch {
      this.errorMsg.set('Failed to submit assessment to the server. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  finish(): void {
    const res = this.result();
    if (res) {
      this.completed.emit(res);
    } else {
      this.close.emit();
    }
  }
}
