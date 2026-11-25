import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GIRL_AVATAR_IMAGE, GirlChatMessage } from '../../models/girl-chat.models';
import { EmotionDetectionService } from '../../services/emotion-detection.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';

@Component({
  selector: 'app-girl-chat-message',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="msg-row" [class.user-row]="message().sender === 'user'" [class.ai-row]="message().sender === 'assistant'">
      @if (message().sender === 'user') {
        <div class="avatar-circle user-avatar" aria-hidden="true">
          <i class="pi pi-user"></i>
        </div>
        <div class="user-bubble">
          <p class="msg-text">{{ message().text }}</p>
        </div>
      } @else {
        <img
          class="avatar-circle girl-avatar"
          [src]="avatarUrl() || defaultAvatar"
          alt="Virtual Girl"
          draggable="false"
        />
        <div class="ai-bubble">
          <p class="msg-text">{{ message().text }}</p>

          <!-- Inline Purple Audio Player Bar (matches mockup design) -->
          @if (message().voiceEnabled !== false) {
            <div class="audio-pill" [class.playing]="isThisMessagePlaying()">
              <button
                type="button"
                class="audio-play-btn"
                (click)="replayRequested.emit(message())"
                [title]="isThisMessagePlaying() ? 'Pause voice' : 'Play voice'"
                [attr.aria-label]="isThisMessagePlaying() ? 'Pause voice' : 'Play voice'"
              >
                <i [class]="isThisMessagePlaying() ? 'pi pi-pause' : 'pi pi-play'"></i>
              </button>

              <div class="waveform" aria-hidden="true">
                @for (h of waveformHeights; track $index) {
                  <span
                    class="bar"
                    [style.height.px]="h"
                    [class.active]="isBarActive($index)"
                  ></span>
                }
              </div>

              <span class="audio-duration">{{ formattedDuration() }}</span>
            </div>
          }

          @if (message().emotion) {
            <div class="msg-meta-row">
              <span class="emotion-chip">
                {{ emotionMeta().emoji }} {{ emotionMeta().label }}
              </span>
              @if (message().action) {
                <span class="action-hint">{{ actionLabel() }}</span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './chat-message.component.scss',
})
export class ChatMessageComponent {
  private readonly emotionService = inject(EmotionDetectionService);
  private readonly tts = inject(TextToSpeechService);

  readonly message = input.required<GirlChatMessage>();
  readonly avatarUrl = input<string>(GIRL_AVATAR_IMAGE);
  readonly replayRequested = output<GirlChatMessage>();

  readonly defaultAvatar = GIRL_AVATAR_IMAGE;

  readonly waveformHeights = [
    6, 10, 15, 8, 13, 18, 11, 7, 16, 20, 14, 9, 17, 12, 8, 19, 14, 10, 15, 7, 12, 16, 9, 6,
  ];

  readonly isThisMessagePlaying = computed(
    () => this.tts.isSpeaking() && this.tts.activeMessageId() === this.message().id,
  );

  readonly emotionMeta = computed(() =>
    this.emotionService.getEmotionMeta(this.message().emotion),
  );

  readonly actionLabel = computed(() =>
    this.emotionService.getActionLabel(this.message().action),
  );

  readonly formattedDuration = computed(() => {
    const sec =
      this.message().audioDurationSec ??
      Math.max(3, Math.round(this.message().text.split(/\s+/).length / 2.5));
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  });

  isBarActive(index: number): boolean {
    if (!this.isThisMessagePlaying()) return false;
    const progress = this.tts.playbackProgress();
    const threshold = Math.floor(progress * this.waveformHeights.length);
    return index <= threshold;
  }
}
