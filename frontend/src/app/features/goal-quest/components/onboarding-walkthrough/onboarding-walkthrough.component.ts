import { Component, output, signal } from '@angular/core';

interface WalkthroughStep {
  icon: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
}

@Component({
  selector: 'app-gq-onboarding-walkthrough',
  standalone: true,
  template: `
    <div class="gq-tour-backdrop">
      <div class="gq-tour-modal">
        <div class="tour-top">
          <span class="practice-pill">🎮 PRACTICE MODE GUIDE</span>
          <button type="button" class="skip-btn" (click)="close.emit()">Skip Tour ✕</button>
        </div>

        <div class="step-dots">
          @for (s of steps; track $index) {
            <button
              type="button"
              class="dot"
              [class.active]="currentStep() === $index"
              [class.done]="$index < currentStep()"
              (click)="currentStep.set($index)"
              [attr.aria-label]="'Step ' + ($index + 1)"
            ></button>
          }
        </div>

        @if (steps[currentStep()]; as step) {
          <div class="tour-body">
            <div class="tour-icon">{{ step.icon }}</div>
            <span class="step-badge">{{ step.badge }}</span>
            <h2>{{ step.title }}</h2>
            <p class="tour-desc">{{ step.description }}</p>

            <ul class="tour-list">
              @for (item of step.highlights; track item) {
                <li>✦ {{ item }}</li>
              }
            </ul>
          </div>
        }

        <div class="tour-footer">
          <button
            type="button"
            class="btn-ghost"
            [disabled]="currentStep() === 0"
            (click)="prev()"
          >
            ← Back
          </button>

          <div class="right-actions">
            @if (currentStep() < steps.length - 1) {
              <button type="button" class="btn-gold" (click)="next()">Next Step →</button>
            } @else {
              <button type="button" class="btn-purple" (click)="close.emit()">
                🗺️ Explore Practice Mode
              </button>
              <button type="button" class="btn-gold" (click)="startPersonal.emit()">
                🚀 Start My Own Journey
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .gq-tour-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(5, 8, 22, 0.84);
        backdrop-filter: blur(10px);
        z-index: 1300;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .gq-tour-modal {
        width: 100%;
        max-width: 600px;
        background: linear-gradient(155deg, #172047 0%, #0b1026 100%);
        border: 1px solid rgba(251, 191, 36, 0.5);
        border-radius: 22px;
        padding: 1.4rem 1.6rem;
        color: #f8fafc;
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.65);
      }
      .tour-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.9rem;
      }
      .practice-pill {
        background: rgba(245, 158, 11, 0.22);
        border: 1px solid rgba(251, 191, 36, 0.6);
        color: #fef08a;
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .skip-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 0.84rem;
      }
      .step-dots {
        display: flex;
        justify-content: center;
        gap: 0.45rem;
        margin-bottom: 1.1rem;
      }
      .dot {
        width: 28px;
        height: 6px;
        border-radius: 999px;
        border: none;
        background: rgba(148, 163, 184, 0.28);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .dot.active {
        width: 44px;
        background: linear-gradient(90deg, #fbbf24, #a855f7);
      }
      .dot.done {
        background: #22c55e;
      }
      .tour-body {
        text-align: center;
        padding: 0.5rem 0 1.1rem;
      }
      .tour-icon {
        font-size: 3rem;
        margin-bottom: 0.4rem;
      }
      .step-badge {
        display: inline-block;
        font-size: 0.75rem;
        color: #93c5fd;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
      .tour-body h2 {
        margin: 0.3rem 0 0.5rem;
        font-size: 1.4rem;
      }
      .tour-desc {
        color: #cbd5e1;
        font-size: 0.92rem;
        line-height: 1.55;
        margin: 0 0 1rem;
      }
      .tour-list {
        list-style: none;
        padding: 0.85rem 1rem;
        margin: 0;
        text-align: left;
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(139, 92, 246, 0.35);
        border-radius: 14px;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.86rem;
        color: #e2e8f0;
      }
      .tour-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
      }
      .right-actions {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .btn-ghost {
        background: rgba(148, 163, 184, 0.14);
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: #e2e8f0;
        padding: 0.55rem 1rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .btn-ghost:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      .btn-purple {
        background: linear-gradient(135deg, #7c3aed, #2563eb);
        border: none;
        color: #fff;
        font-weight: 700;
        padding: 0.55rem 1rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .btn-gold {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        border: none;
        color: #1e1b4b;
        font-weight: 800;
        padding: 0.55rem 1.1rem;
        border-radius: 10px;
        cursor: pointer;
      }
    `,
  ],
})
export class OnboardingWalkthroughComponent {
  readonly close = output<void>();
  readonly startPersonal = output<void>();

  readonly currentStep = signal(0);

  readonly steps: WalkthroughStep[] = [
    {
      icon: '🎯',
      badge: 'Step 1 of 5 · Create & Explore Goals',
      title: 'Turn Real-Life Goals into RPG Quests',
      description:
        'You are currently in isolated Practice Mode with 4 ready-to-play demo quests: Azure AI Certification, Learn Python, Improve Fitness, and Read 5 Books.',
      highlights: [
        'Switch between quests using the roadmap dropdown or My Goals tab.',
        'Everything you edit in Practice Mode is 100% isolated from your personal data.',
        'Use Bulk Excel Import/Export anytime to manage goals at scale.',
      ],
    },
    {
      icon: '🗺️',
      badge: 'Step 2 of 5 · Interactive Checkpoints',
      title: 'Conquer Sequential Adventure Checkpoints',
      description:
        'Each goal is broken into glowing map stages with target deadlines, custom time intervals (Minutes, Hours, Days, Weeks), and clear progress tracking.',
      highlights: [
        'Green nodes are Completed, Gold nodes are Active, and Locked stages unlock in sequence.',
        'Click any checkpoint on the map to inspect its rewards, pass mark, and questions.',
      ],
    },
    {
      icon: '📝',
      badge: 'Step 3 of 5 · Timed Assessments',
      title: 'Prove Mastery with 90%+ Assessments',
      description:
        'Click "Start Assessment" on an active checkpoint to take a timed quiz with Multiple Choice, Multiple Select, True/False, and Short Answer questions.',
      highlights: [
        'Grading happens securely on the backend with instant per-question feedback.',
        'Score 90% or higher (configurable) to complete the stage and unlock the next checkpoint!',
      ],
    },
    {
      icon: '🪙',
      badge: 'Step 4 of 5 · Game Cash & Achievements',
      title: 'Earn Rewards, Early Bonuses & Trophies',
      description:
        'Your Practice Wallet starts with 1,250 G and sample reward/penalty history so you can test the full game economy right away.',
      highlights: [
        'On-time completion earns the standard reward; Early completion awards a 2x bonus!',
        'Late completion deducts a configurable penalty — and duplicate payouts are prevented.',
        'Unlock achievements and trophies automatically as you hit milestones.',
      ],
    },
    {
      icon: '🛒',
      badge: 'Step 5 of 5 · Shop, Themes & Your Real Journey',
      title: 'Customize Your Hero & Start Your Own Journey',
      description:
        'Spend Game Cash in the Rewards Shop on costumes, accessories, characters, effects, and Fantasy, Jungle, Space, or Mountain themes.',
      highlights: [
        'Click "Reset Demo Data" anytime to restore the fresh practice sandbox.',
        'Ready for real goals? Click "Start My Own Journey" to switch to your clean personal workspace!',
      ],
    },
  ];

  next(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update((n) => n + 1);
    }
  }

  prev(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((n) => n - 1);
    }
  }
}
