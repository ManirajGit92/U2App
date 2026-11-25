import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportedLanguage, VoiceStyle } from '../../models/girl-chat.models';
import { TextToSpeechService } from '../../services/text-to-speech.service';

@Component({
  selector: 'app-girl-voice-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-section">
      <h4 class="section-title">
        <i class="pi pi-volume-up"></i> Female Voice Configuration
      </h4>

      <div class="toggle-row">
        <span>Enable AI Voice</span>
        <label class="switch">
          <input
            type="checkbox"
            [ngModel]="tts.settings().enabled"
            (ngModelChange)="tts.updateSettings({ enabled: $event })"
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <span>Hands-Free Voice Mode</span>
        <label class="switch">
          <input
            type="checkbox"
            [ngModel]="tts.settings().handsFreeMode"
            (ngModelChange)="tts.updateSettings({ handsFreeMode: $event })"
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="field-group">
        <label>Conversation Language</label>
        <select
          [ngModel]="tts.settings().language"
          (ngModelChange)="onLanguageChange($event)"
        >
          <option value="auto">Auto (English &amp; Tamil)</option>
          <option value="en-IN">Indian English</option>
          <option value="en">English (Global)</option>
          <option value="ta">Tamil (தமிழ்)</option>
        </select>
      </div>

      <div class="field-group">
        <label>English Female Voice</label>
        <select
          [ngModel]="tts.settings().voiceName"
          (ngModelChange)="tts.updateSettings({ voiceName: $event })"
        >
          @for (voice of englishVoices(); track voice.name) {
            <option [value]="voice.name">{{ voice.displayName }}</option>
          }
        </select>
      </div>

      <div class="field-group">
        <label>Tamil Female Voice</label>
        <select
          [ngModel]="tts.settings().tamilVoiceName"
          (ngModelChange)="tts.updateSettings({ tamilVoiceName: $event })"
        >
          @for (voice of tamilVoices(); track voice.name) {
            <option [value]="voice.name">{{ voice.displayName }}</option>
          }
        </select>
      </div>

      <div class="field-group">
        <label>Voice Emotion Style</label>
        <select
          [ngModel]="tts.settings().voiceStyle"
          (ngModelChange)="onStyleChange($event)"
        >
          <option value="auto">Auto (Match Emotion)</option>
          <option value="natural">Natural</option>
          <option value="cheerful">Cheerful / Happy</option>
          <option value="soft_shy">Soft &amp; Shy</option>
          <option value="affectionate">Affectionate / Romantic</option>
          <option value="excited">Excited</option>
          <option value="empathetic">Empathetic / Gentle</option>
          <option value="sad">Emotional / Sad</option>
          <option value="angry">Slightly Angry</option>
        </select>
      </div>

      <div class="range-group">
        <div class="range-head">
          <label>Speaking Speed</label>
          <span>{{ tts.settings().speed.toFixed(2) }}x</span>
        </div>
        <input
          type="range"
          min="0.75"
          max="1.35"
          step="0.05"
          [ngModel]="tts.settings().speed"
          (ngModelChange)="tts.updateSettings({ speed: +$event })"
        />
      </div>

      <div class="range-group">
        <div class="range-head">
          <label>Voice Pitch</label>
          <span>{{ tts.settings().pitch >= 0 ? '+' : '' }}{{ tts.settings().pitch }}%</span>
        </div>
        <input
          type="range"
          min="-15"
          max="15"
          step="1"
          [ngModel]="tts.settings().pitch"
          (ngModelChange)="tts.updateSettings({ pitch: +$event })"
        />
      </div>

      <div class="range-group">
        <div class="range-head">
          <label>Volume</label>
          <span>{{ Math.round(tts.settings().volume * 100) }}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          [ngModel]="tts.settings().volume"
          (ngModelChange)="tts.updateSettings({ volume: +$event })"
        />
      </div>

      <button
        type="button"
        class="btn-test-voice"
        [disabled]="tts.isSynthesizing()"
        (click)="testVoice()"
      >
        <i [class]="tts.isSynthesizing() ? 'pi pi-spin pi-spinner' : 'pi pi-play'"></i>
        {{ tts.isSynthesizing() ? 'Synthesizing...' : 'Test Female Voice' }}
      </button>
    </div>
  `,
  styleUrl: './voice-settings.component.scss',
})
export class VoiceSettingsComponent {
  readonly tts = inject(TextToSpeechService);
  readonly Math = Math;

  readonly englishVoices = computed(() =>
    this.tts.availableVoices().filter((v) => v.language === 'en'),
  );

  readonly tamilVoices = computed(() =>
    this.tts.availableVoices().filter((v) => v.language === 'ta'),
  );

  onLanguageChange(lang: SupportedLanguage): void {
    this.tts.updateSettings({ language: lang });
  }

  onStyleChange(style: VoiceStyle | 'auto'): void {
    this.tts.updateSettings({ voiceStyle: style });
  }

  async testVoice(): Promise<void> {
    const lang = this.tts.settings().language === 'ta' ? 'ta' : 'en';
    const sample =
      lang === 'ta'
        ? 'வணக்கம்! என் குரல் எப்படி இருக்கு? உங்ககூட பேச ரொம்ப சந்தோஷமா இருக்கு.'
        : "Hi! It's so wonderful to talk with you today. How does my voice sound?";
    const speech = await this.tts.synthesize(sample, lang, 'cheerful');
    await this.tts.playSpeech(speech, null);
  }
}
