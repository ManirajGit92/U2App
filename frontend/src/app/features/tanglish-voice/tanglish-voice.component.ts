import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  TANGLISH_VOICE_OPTIONS,
  TanglishVoiceId,
  TanglishVoiceService,
} from './tanglish-voice.service';

@Component({
  selector: 'app-tanglish-voice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tanglish-voice.component.html',
  styleUrl: './tanglish-voice.component.scss',
})
export class TanglishVoiceComponent implements OnDestroy {
  private readonly tanglishVoiceService = inject(TanglishVoiceService);

  readonly voices = TANGLISH_VOICE_OPTIONS;
  readonly inputText = signal(
    'Please send the meeting report today and call me later.'
  );
  readonly outputText = signal('');
  readonly selectedVoice = signal<TanglishVoiceId>('coral');
  readonly speechSpeed = signal(1);
  readonly isConverting = signal(false);
  readonly isGeneratingAudio = signal(false);
  readonly errorMessage = signal('');
  readonly audioUrl = signal<string | null>(null);
  readonly engineNote = signal('');
  readonly appliedRuleCount = signal(0);

  async convert(): Promise<void> {
    const text = this.inputText().trim();
    if (!text) {
      this.errorMessage.set('Enter some English text before converting.');
      return;
    }

    this.errorMessage.set('');
    this.isConverting.set(true);

    try {
      const response = await this.tanglishVoiceService.convert({
        text,
        engine: 'rule-based',
        preserveUnknownWords: true,
      });

      this.outputText.set(response.tanglishText);
      this.engineNote.set(response.note ?? '');
      this.appliedRuleCount.set(response.appliedRules.length);
      this.revokeAudioUrl();
    } catch (error) {
      this.errorMessage.set(
        this.tanglishVoiceService.getErrorMessage(
          error,
          'Conversion failed.'
        )
      );
    } finally {
      this.isConverting.set(false);
    }
  }

  async generateSpeech(): Promise<void> {
    const text = this.outputText().trim();
    if (!text) {
      this.errorMessage.set('Convert text first so the Tanglish output can be spoken.');
      return;
    }

    this.errorMessage.set('');
    this.isGeneratingAudio.set(true);

    try {
      const audioBlob = await this.tanglishVoiceService.speak({
        text,
        voice: this.selectedVoice(),
        speed: this.speechSpeed(),
        format: 'mp3',
        instructions:
          'Speak the Tanglish naturally, with friendly Tamil-style rhythm and clear pronunciation.',
      });

      this.revokeAudioUrl();
      this.audioUrl.set(URL.createObjectURL(audioBlob));
    } catch (error) {
      this.errorMessage.set(
        this.tanglishVoiceService.getErrorMessage(
          error,
          'Audio generation failed. Confirm OPENAI_API_KEY is configured for the .NET API.'
        )
      );
    } finally {
      this.isGeneratingAudio.set(false);
    }
  }

  copyOutput(): void {
    const text = this.outputText().trim();
    if (!text) {
      return;
    }

    navigator.clipboard.writeText(text).catch(() => {
      this.errorMessage.set('Copy failed in this browser. You can still select the output manually.');
    });
  }

  clearAll(): void {
    this.inputText.set('');
    this.outputText.set('');
    this.engineNote.set('');
    this.appliedRuleCount.set(0);
    this.errorMessage.set('');
    this.revokeAudioUrl();
  }

  ngOnDestroy(): void {
    this.revokeAudioUrl();
  }

  private revokeAudioUrl(): void {
    const currentUrl = this.audioUrl();
    if (!currentUrl) {
      return;
    }

    URL.revokeObjectURL(currentUrl);
    this.audioUrl.set(null);
  }
}
