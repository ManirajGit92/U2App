import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  HostListener,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarPose } from './ai-character-assistant.service';

@Component({
  selector: 'app-ai-avatar-animator',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="avatar-character-stage"
      [class.is-speaking]="isSpeaking"
      [class.is-listening]="isListening"
      [class.is-thinking]="isThinking"
      [class.is-happy]="pose === 'happy'"
      [class.is-pointing]="pose === 'pointing'"
      [class.is-explaining]="pose === 'explaining'"
      [style.transform]="characterTransform()"
      (click)="avatarClicked.emit()"
      title="Click to chat with U2 Assistant"
    >
      <!-- Glowing Reactive Aura behind character -->
      <div class="character-aura" [class.active]="isListening || isSpeaking || pose === 'happy'"></div>

      <!-- Main Full-Res Cutout Layer -->
      <div class="character-body-container" [class.breathe]="pose === 'idle' || pose === 'listening'">
        <!-- Base Character Cutout -->
        <img
          src="assets/images/assistant/SriIdle.png"
          alt="U2 Assistant Character"
          class="character-image base-layer"
          [class.visible]="pose === 'idle' || pose === 'speaking' || pose === 'listening'"
          draggable="false"
        />

        <!-- Explaining Pose Overlay -->
        <img
          src="assets/images/assistant/SriWelcome.png"
          alt="Explaining Gesture"
          class="character-image pose-overlay explaining-overlay"
          [class.visible]="pose === 'explaining'"
          draggable="false"
        />

        <!-- Pointing / Suggest Pose Overlay -->
        <img
          src="assets/images/assistant/SriSuccess.png"
          alt="Pointing Gesture"
          class="character-image pose-overlay pointing-overlay"
          [class.visible]="pose === 'pointing'"
          draggable="false"
        />

        <!-- Thinking Pose Overlay -->
        <img
          src="assets/images/assistant/SriThinking.png"
          alt="Thinking"
          class="character-image pose-overlay thinking-overlay"
          [class.visible]="pose === 'thinking'"
          draggable="false"
        />

        <!-- Happy / Confirmation Pose Overlay -->
        <img
          src="assets/images/assistant/SriSuccess.png"
          alt="Happy Confirmation"
          class="character-image pose-overlay happy-overlay"
          [class.visible]="pose === 'happy'"
          draggable="false"
        />

        <!-- Realistic Procedural Eyelid Blink Overlay (Over Base Character) -->
        <div
          class="eyelids-container"
          *ngIf="pose === 'idle' || pose === 'speaking' || pose === 'listening'"
          [class.is-blinking]="isBlinking()"
        >
          <!-- Left Eye Eyelid (Viewer's left) -->
          <div class="eyelid eye-left"></div>
          <!-- Right Eye Eyelid (Viewer's right) -->
          <div class="eyelid eye-right"></div>
        </div>

        <!-- Realistic Procedural Lip-Sync Mouth Overlay (When Speaking) -->
         <!--   -->
        <div
          class="lipsync-container"
         *ngIf="isSpeaking && (pose === 'speaking' || pose === 'idle')"
          [style.transform]="lipSyncScale()"
        >
          <div class="mouth-shape" [ngClass]="currentViseme()"></div>
        </div>

        <!-- Thinking Sparkle / Particle Indicators -->
        <div class="thinking-particles" *ngIf="isThinking">
          <span class="particle p1">💭</span>
          <span class="particle p2">✨</span>
          <span class="particle p3">💡</span>
        </div>

        <!-- Happy Confetti / Sparkle Burst -->
        <div class="happy-sparkles" *ngIf="pose === 'happy'">
          <span class="sparkle s1">✨</span>
          <span class="sparkle s2">🌟</span>
          <span class="sparkle s3">⭐</span>
          <span class="sparkle s4">🎉</span>
        </div>

        <!-- Listening Sound Waves Indicator -->
        <div class="listening-waves" *ngIf="isListening">
          <span class="wave w1"></span>
          <span class="wave w2"></span>
          <span class="wave w3"></span>
        </div>
      </div>

      <!-- State Pill Indicator -->
      <div class="state-badge" [ngClass]="pose">
        <span class="badge-dot"></span>
        <span class="badge-label">{{ stateLabel() }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      user-select: none;
    }

    .avatar-character-stage {
      position: relative;
      cursor: pointer;
      transform-origin: center bottom;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      perspective: 1000px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .character-aura {
      position: absolute;
      bottom: 10%;
      width: 280px;
      height: 380px;
      border-radius: 50%;
      background: radial-gradient(
        ellipse at center,
        rgba(var(--accent-primary-rgb, 99, 102, 241), 0.22) 0%,
        rgba(236, 72, 153, 0.15) 45%,
        transparent 75%
      );
      filter: blur(28px);
      pointer-events: none;
      opacity: 0.6;
      transition: opacity 0.5s ease, transform 0.5s ease;
      z-index: 1;
    }

    .character-aura.active {
      opacity: 1;
      transform: scale(1.15);
      animation: pulseAura 2s ease-in-out infinite alternate;
    }

    @keyframes pulseAura {
      0% { transform: scale(1); opacity: 0.7; }
      100% { transform: scale(1.22); opacity: 1; filter: blur(34px); }
    }

    .character-body-container {
      position: relative;
      width: 320px;
      height: 490px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 2;
    }

    .character-body-container.breathe {
      animation: naturalBreathing 4.5s ease-in-out infinite;
    }

    @keyframes naturalBreathing {
      0%, 100% {
        transform: translateY(0px) scale(1);
      }
      50% {
        transform: translateY(-5px) scale(1.008);
      }
    }

    .character-image {
      position: absolute;
      bottom: 0;
      height: 100%;
      width: auto;
      max-width: 100%;
      object-fit: contain;
      pointer-events: none;
      filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.35));
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      transform: scale(0.97);
    }

    .character-image.visible {
      opacity: 1;
      transform: scale(1);
    }

    .base-layer {
      z-index: 2;
    }

    .pose-overlay {
      z-index: 3;
      border-radius: 18px;
      bottom: 20px;
      max-width: 82%;
      max-height: 82%;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
      border: 2px solid rgba(255, 255, 255, 0.25);
    }

    /* ── Procedural Eyelids ── */
    .eyelids-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
      pointer-events: none;
    }

    .eyelid {
      position: absolute;
      background: #c38466;
      border-radius: 50% 50% 40% 40%;
      opacity: 0;
      transform: scaleY(0);
      transform-origin: top center;
      transition: transform 0.08s ease-in, opacity 0.05s ease-in;
      box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.2);
    }

    .eyelids-container.is-blinking .eyelid {
      opacity: 1;
      transform: scaleY(1);
    }

    .eye-left {
      top: 35%;
      left: 41%;
      width: 12%;
      height: 4.8%;
    }

    .eye-right {
      top: 40%;
      left: 60%;
      width: 12%;
      height: 4.8%;
    }

    /* ── Procedural Lip-Sync Mouth ── */
    .lipsync-container {
      position: absolute;
      top: 46%;
      left: 35%;
      width: 29%;
      height: 7.5%;
      z-index: 6;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-10deg); /* Change the angle here */
    transform-origin: center center;
      transition: transform 0.1s ease-out;
    }

    .mouth-shape {
      background: rgba(180, 50, 75, 0.85);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(60, 10, 20, 0.7);
      transition: width 0.08s ease, height 0.08s ease, border-radius 0.08s ease;
    }

    .mouth-shape.viseme-open {
      width: 20px;
      height: 12px;
      border-radius: 40% 40% 60% 60%;
    }

    .mouth-shape.viseme-wide {
      width: 26px;
      height: 8px;
      border-radius: 20px;
    }

    .mouth-shape.viseme-round {
      width: 14px;
      height: 14px;
      border-radius: 50%;
    }

    .mouth-shape.viseme-smile {
      width: 22px;
      height: 6px;
      border-radius: 10px 10px 20px 20px;
    }

    /* ── State Indicators & Badges ── */
    .state-badge {
      margin-top: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      z-index: 4;
      transition: all 0.3s ease;
    }

    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    .state-badge.thinking .badge-dot {
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
    }

    .state-badge.speaking .badge-dot {
      background: #3b82f6;
      box-shadow: 0 0 8px #3b82f6;
      animation: blinkDot 0.6s infinite alternate;
    }

    .state-badge.listening .badge-dot {
      background: #06b6d4;
      box-shadow: 0 0 10px #06b6d4;
      animation: blinkDot 0.4s infinite alternate;
    }

    .state-badge.happy .badge-dot {
      background: #ec4899;
      box-shadow: 0 0 10px #ec4899;
    }

    @keyframes blinkDot {
      0% { opacity: 0.3; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1.3); }
    }

    /* ── Floating Particles ── */
    .thinking-particles {
      position: absolute;
      top: 5%;
      right: 10%;
      z-index: 10;
      pointer-events: none;
    }

    .particle {
      position: absolute;
      font-size: 1.4rem;
      animation: floatUp 2s ease-in-out infinite;
    }

    .p1 { animation-delay: 0s; left: -10px; }
    .p2 { animation-delay: 0.6s; left: 15px; }
    .p3 { animation-delay: 1.2s; left: -25px; }

    @keyframes floatUp {
      0% { transform: translateY(0) scale(0.8); opacity: 0; }
      50% { opacity: 1; transform: translateY(-16px) scale(1.1); }
      100% { transform: translateY(-32px) scale(0.7); opacity: 0; }
    }

    .happy-sparkles {
      position: absolute;
      top: 15%;
      width: 100%;
      height: 80%;
      z-index: 10;
      pointer-events: none;
    }

    .sparkle {
      position: absolute;
      font-size: 1.5rem;
      animation: popSparkle 1.8s ease-out infinite;
    }

    .s1 { top: 10%; left: 20%; animation-delay: 0s; }
    .s2 { top: 20%; right: 25%; animation-delay: 0.4s; }
    .s3 { top: 45%; left: 15%; animation-delay: 0.8s; }
    .s4 { top: 35%; right: 15%; animation-delay: 1.1s; }

    @keyframes popSparkle {
      0% { transform: scale(0) rotate(0deg); opacity: 0; }
      40% { transform: scale(1.3) rotate(45deg); opacity: 1; }
      100% { transform: scale(0.6) translateY(-25px) rotate(90deg); opacity: 0; }
    }

    .listening-waves {
      position: absolute;
      bottom: 25%;
      width: 100%;
      display: flex;
      justify-content: center;
      gap: 5px;
      z-index: 10;
    }

    .wave {
      width: 4px;
      background: #06b6d4;
      border-radius: 4px;
      animation: wavePulse 0.8s ease-in-out infinite alternate;
    }

    .w1 { height: 16px; animation-delay: 0s; }
    .w2 { height: 26px; animation-delay: 0.2s; }
    .w3 { height: 18px; animation-delay: 0.4s; }

    @keyframes wavePulse {
      0% { transform: scaleY(0.4); opacity: 0.5; }
      100% { transform: scaleY(1.3); opacity: 1; }
    }

    @media (max-width: 1024px) {
      .character-body-container {
        width: 210px;
        height: 300px;
      }
      .character-aura {
        width: 200px;
        height: 280px;
      }
    }

    @media (max-width: 768px) {
      .character-body-container {
        width: 170px;
        height: 240px;
      }
      .state-badge {
        font-size: 0.7rem;
        padding: 3px 8px;
      }
    }
  `]
})
export class AiAvatarAnimatorComponent implements OnInit, OnDestroy {
  @Input() pose: AvatarPose = 'idle';
  @Input() isSpeaking: boolean = false;
  @Input() isListening: boolean = false;
  @Input() isThinking: boolean = false;

  @Output() avatarClicked = new EventEmitter<void>();

  // Procedural Blinking State
  readonly isBlinking = signal<boolean>(false);
  private blinkTimer?: any;

  // Procedural Lip-Sync State
  readonly currentViseme = signal<string>('viseme-smile');
  readonly lipSyncScale = signal<string>('scale(1)');
  private lipSyncTimer?: any;

  // 3D Mouse Parallax Tracking
  private mouseX = 0;
  private mouseY = 0;
  readonly tiltX = signal<number>(0);
  readonly tiltY = signal<number>(0);

  readonly characterTransform = computed(() => {
    return `perspective(900px) rotateY(${this.tiltX()}deg) rotateX(${this.tiltY()}deg)`;
  });

  readonly stateLabel = computed(() => {
    if (this.isListening) return 'Listening...';
    if (this.isThinking) return 'Thinking...';
    if (this.isSpeaking) return 'Speaking...';
    switch (this.pose) {
      case 'happy': return 'Success!';
      case 'pointing': return 'Check this out';
      case 'explaining': return 'Here to help';
      default: return 'U2 Assistant';
    }
  });

  ngOnInit(): void {
    this.startBlinkLoop();
    this.startLipSyncLoop();
  }

  ngOnDestroy(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    if (this.lipSyncTimer) clearInterval(this.lipSyncTimer);
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (typeof window === 'undefined') return;
    const normX = (event.clientX / window.innerWidth) - 0.5;
    const normY = (event.clientY / window.innerHeight) - 0.5;
    // Subtly track cursor: rotateY up to +/- 5 deg, rotateX up to +/- 3 deg
    this.tiltX.set(Math.round(normX * 8 * 10) / 10);
    this.tiltY.set(Math.round(-normY * 5 * 10) / 10);
  }

  private startBlinkLoop(): void {
    const scheduleNextBlink = () => {
      // Natural human blink interval: 2800ms - 4500ms
      const interval = 2800 + Math.random() * 2000;
      this.blinkTimer = setTimeout(() => {
        this.isBlinking.set(true);
        setTimeout(() => {
          this.isBlinking.set(false);

          // 15% chance of realistic double-blink
          if (Math.random() < 0.18) {
            setTimeout(() => {
              this.isBlinking.set(true);
              setTimeout(() => {
                this.isBlinking.set(false);
                scheduleNextBlink();
              }, 110);
            }, 120);
          } else {
            scheduleNextBlink();
          }
        }, 130);
      }, interval);
    };

    scheduleNextBlink();
  }

  private startLipSyncLoop(): void {
    const visemes = ['viseme-open', 'viseme-wide', 'viseme-round', 'viseme-smile'];
    let idx = 0;

    this.lipSyncTimer = setInterval(() => {
      if (this.isSpeaking) {
        idx = (idx + 1) % visemes.length;
        this.currentViseme.set(visemes[idx]);
        const scaleVal = 0.95 + Math.random() * 0.15;
        this.lipSyncScale.set(`scale(${scaleVal.toFixed(2)})`);
      } else {
        this.currentViseme.set('viseme-smile');
        this.lipSyncScale.set('scale(1)');
      }
    }, 120);
  }
}
