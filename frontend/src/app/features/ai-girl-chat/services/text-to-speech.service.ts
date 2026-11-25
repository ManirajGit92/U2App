import { Injectable, NgZone, inject, signal } from '@angular/core';
import {
  FEMALE_VOICE_OPTIONS,
  FemaleVoiceOption,
  VoiceSettings,
  VoiceStyle,
} from '../models/girl-chat.models';
import { environment } from '../../../../environments/environment';

const VOICE_SETTINGS_KEY = 'u2_girl_chat_voice_settings_v1';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  voiceName: 'en-IN-NeerjaExpressiveNeural',
  tamilVoiceName: 'ta-IN-PallaviNeural',
  speed: 1.0,
  pitch: 0,
  volume: 1.0,
  language: 'auto',
  voiceStyle: 'auto',
  handsFreeMode: false,
};

export interface SynthesizedSpeech {
  audioUrl: string | null;
  durationSec: number;
  usedFallbackBrowserTts: boolean;
  text: string;
  language: 'en' | 'ta';
  voiceStyle: VoiceStyle;
}

@Injectable({
  providedIn: 'root',
})
export class TextToSpeechService {
  private readonly ngZone = inject(NgZone);

  readonly settings = signal<VoiceSettings>(this.loadSettings());
  readonly availableVoices = signal<FemaleVoiceOption[]>(FEMALE_VOICE_OPTIONS);
  readonly isSynthesizing = signal<boolean>(false);
  readonly isSpeaking = signal<boolean>(false);
  readonly activeMessageId = signal<string | null>(null);
  readonly playbackProgress = signal<number>(0); // 0..1
  readonly isListening = signal<boolean>(false);
  readonly liveTranscript = signal<string>('');
  readonly lastError = signal<string | null>(null);

  private currentAudio: HTMLAudioElement | null = null;
  private speechRecognition: any = null;
  private onSpeechEndedCallback: (() => void) | null = null;
  private objectUrls = new Set<string>();

  updateSettings(patch: Partial<VoiceSettings>): void {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    this.saveSettings(next);
    if (this.currentAudio) {
      this.currentAudio.volume = Math.max(0, Math.min(1, next.volume));
    }
  }

  /**
   * Pre-synthesizes female neural audio from the Python Azure Speech backend
   * so video + audio can begin at the exact same moment.
   */
  async synthesize(
    text: string,
    language: 'en' | 'ta',
    voiceStyle: VoiceStyle,
  ): Promise<SynthesizedSpeech> {
    const cfg = this.settings();
    const resolvedStyle: VoiceStyle =
      cfg.voiceStyle === 'auto' ? voiceStyle : cfg.voiceStyle;

    if (!cfg.enabled || !text.trim()) {
      return {
        audioUrl: null,
        durationSec: this.estimateDuration(text, cfg.speed),
        usedFallbackBrowserTts: false,
        text,
        language,
        voiceStyle: resolvedStyle,
      };
    }

    const voiceName = language === 'ta' ? cfg.tamilVoiceName : cfg.voiceName;
    const ratePct = Math.round((cfg.speed - 1) * 100);
    const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;
    const pitchStr = `${cfg.pitch >= 0 ? '+' : ''}${Math.round(cfg.pitch)}%`;

    this.isSynthesizing.set(true);
    this.lastError.set(null);

    try {
      const endpoints = this.getTtsEndpoints();
      let blob: Blob | null = null;

      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              voice: voiceName,
              rate: rateStr,
              pitch: pitchStr,
              style: resolvedStyle,
              style_degree: this.getStyleDegree(resolvedStyle),
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const candidate = await resp.blob();
            if (candidate.size > 100) {
              blob = candidate;
              break;
            }
          }
        } catch {
          // Try next endpoint or fall back to browser speech synthesis
        }
      }

      if (blob) {
        const audioUrl = URL.createObjectURL(blob);
        this.objectUrls.add(audioUrl);
        const durationSec = await this.probeAudioDuration(audioUrl, text, cfg.speed);
        return {
          audioUrl,
          durationSec,
          usedFallbackBrowserTts: false,
          text,
          language,
          voiceStyle: resolvedStyle,
        };
      }

      return {
        audioUrl: null,
        durationSec: this.estimateDuration(text, cfg.speed),
        usedFallbackBrowserTts: true,
        text,
        language,
        voiceStyle: resolvedStyle,
      };
    } finally {
      this.isSynthesizing.set(false);
    }
  }

  /**
   * Plays a pre-synthesized audio URL (or browser Web Speech fallback),
   * always stopping any previous audio first so voices never overlap.
   */
  async playSpeech(
    speech: SynthesizedSpeech,
    messageId: string | null,
    onEnded?: () => void,
  ): Promise<void> {
    this.stop();

    const cfg = this.settings();
    if (!cfg.enabled) {
      onEnded?.();
      return;
    }

    this.activeMessageId.set(messageId);
    this.onSpeechEndedCallback = onEnded ?? null;

    if (speech.audioUrl) {
      await this.playAudioUrl(speech.audioUrl, cfg.volume);
      return;
    }

    // Graceful browser Web Speech API fallback (female voice preference)
    this.playBrowserSpeech(speech.text, speech.language, cfg);
  }

  /**
   * Replays an existing message's cached audio URL or re-synthesizes on demand.
   */
  async replayMessageAudio(
    messageId: string,
    text: string,
    audioUrl: string | null | undefined,
    language: 'en' | 'ta',
    voiceStyle: VoiceStyle,
    onEnded?: () => void,
  ): Promise<string | null> {
    if (this.activeMessageId() === messageId && this.isSpeaking()) {
      this.stop();
      return audioUrl ?? null;
    }

    if (audioUrl) {
      await this.playSpeech(
        {
          audioUrl,
          durationSec: 0,
          usedFallbackBrowserTts: false,
          text,
          language,
          voiceStyle,
        },
        messageId,
        onEnded,
      );
      return audioUrl;
    }

    const synthesized = await this.synthesize(text, language, voiceStyle);
    await this.playSpeech(synthesized, messageId, onEnded);
    return synthesized.audioUrl;
  }

  stop(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.ontimeupdate = null;
      } catch {
        // ignore audio teardown errors
      }
      this.currentAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    this.isSpeaking.set(false);
    this.activeMessageId.set(null);
    this.playbackProgress.set(0);
    this.onSpeechEndedCallback = null;
  }

  /**
   * Starts browser SpeechRecognition for microphone voice input.
   */
  startVoiceInput(onFinalTranscript: (transcript: string) => void): void {
    if (typeof window === 'undefined') return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      this.lastError.set('Voice input is not supported in this browser.');
      return;
    }

    if (this.isListening()) {
      this.stopVoiceInput();
      return;
    }

    // Stop AI voice while user speaks
    this.stop();

    const recognition = new SpeechRec();
    const langPref = this.settings().language;
    recognition.lang = langPref === 'ta' ? 'ta-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalText = '';

    recognition.onstart = () => {
      this.ngZone.run(() => {
        this.isListening.set(true);
        this.liveTranscript.set('');
        this.lastError.set(null);
      });
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const segment = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) {
          finalText += segment;
        } else {
          interim += segment;
        }
      }
      this.ngZone.run(() => {
        this.liveTranscript.set((finalText + interim).trim());
      });
    };

    recognition.onerror = (event: any) => {
      this.ngZone.run(() => {
        this.isListening.set(false);
        if (event?.error && event.error !== 'no-speech' && event.error !== 'aborted') {
          this.lastError.set(`Microphone error: ${event.error}`);
        }
      });
    };

    recognition.onend = () => {
      this.ngZone.run(() => {
        this.isListening.set(false);
        const result = (finalText || this.liveTranscript()).trim();
        this.liveTranscript.set('');
        if (result) {
          onFinalTranscript(result);
        }
      });
    };

    this.speechRecognition = recognition;
    try {
      recognition.start();
    } catch {
      this.isListening.set(false);
    }
  }

  stopVoiceInput(): void {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {
        // ignore
      }
      this.speechRecognition = null;
    }
    this.isListening.set(false);
  }

  revokeAllAudioUrls(): void {
    this.stop();
    for (const url of this.objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    this.objectUrls.clear();
  }

  private async playAudioUrl(audioUrl: string, volume: number): Promise<void> {
    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    this.currentAudio = audio;

    audio.ontimeupdate = () => {
      if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
        this.ngZone.run(() => {
          this.playbackProgress.set(Math.min(1, audio.currentTime / audio.duration));
        });
      }
    };

    audio.onended = () => {
      this.ngZone.run(() => {
        const cb = this.onSpeechEndedCallback;
        this.isSpeaking.set(false);
        this.activeMessageId.set(null);
        this.playbackProgress.set(0);
        this.currentAudio = null;
        this.onSpeechEndedCallback = null;
        cb?.();
      });
    };

    audio.onerror = () => {
      this.ngZone.run(() => {
        const cb = this.onSpeechEndedCallback;
        this.isSpeaking.set(false);
        this.activeMessageId.set(null);
        this.currentAudio = null;
        this.onSpeechEndedCallback = null;
        cb?.();
      });
    };

    this.isSpeaking.set(true);
    try {
      await audio.play();
    } catch (err) {
      this.lastError.set('Audio autoplay was blocked by browser. Tap Play on the message.');
      this.isSpeaking.set(false);
      const cb = this.onSpeechEndedCallback;
      this.onSpeechEndedCallback = null;
      cb?.();
      console.warn('Audio playback blocked:', err);
    }
  }

  private playBrowserSpeech(text: string, language: 'en' | 'ta', cfg: VoiceSettings): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.onSpeechEndedCallback?.();
      this.onSpeechEndedCallback = null;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.max(0.7, Math.min(1.5, cfg.speed));
    utterance.pitch = Math.max(0.7, Math.min(1.5, 1.08 + cfg.pitch / 100));
    utterance.volume = Math.max(0, Math.min(1, cfg.volume));
    utterance.lang = language === 'ta' ? 'ta-IN' : 'en-IN';

    const voices = window.speechSynthesis.getVoices();
    const preferred = this.pickBestFemaleBrowserVoice(voices, language);
    if (preferred) {
      utterance.voice = preferred;
    }

    utterance.onstart = () => {
      this.ngZone.run(() => this.isSpeaking.set(true));
    };

    utterance.onend = () => {
      this.ngZone.run(() => {
        const cb = this.onSpeechEndedCallback;
        this.isSpeaking.set(false);
        this.activeMessageId.set(null);
        this.playbackProgress.set(0);
        this.onSpeechEndedCallback = null;
        cb?.();
      });
    };

    utterance.onerror = () => {
      this.ngZone.run(() => {
        const cb = this.onSpeechEndedCallback;
        this.isSpeaking.set(false);
        this.activeMessageId.set(null);
        this.onSpeechEndedCallback = null;
        cb?.();
      });
    };

    this.isSpeaking.set(true);
    window.speechSynthesis.speak(utterance);
  }

  private pickBestFemaleBrowserVoice(
    voices: SpeechSynthesisVoice[],
    language: 'en' | 'ta',
  ): SpeechSynthesisVoice | null {
    if (!voices.length) return null;
    const femaleHints = ['neerja', 'pallavi', 'jenny', 'aria', 'ava', 'samantha', 'zira', 'heera', 'female', 'google हिन्दी', 'google uk english female'];

    const langFiltered = voices.filter((v) =>
      language === 'ta'
        ? v.lang.toLowerCase().startsWith('ta')
        : v.lang.toLowerCase().startsWith('en-in') || v.lang.toLowerCase().startsWith('en'),
    );

    const pool = langFiltered.length ? langFiltered : voices;
    for (const hint of femaleHints) {
      const match = pool.find((v) => v.name.toLowerCase().includes(hint));
      if (match) return match;
    }
    return pool[0] ?? null;
  }

  private getTtsEndpoints(): string[] {
    const list = ['/api/voice/tts'];
    if (environment.pythonApiBaseUrl) {
      list.push(`${environment.pythonApiBaseUrl.replace(/\/$/, '')}/api/voice/tts`);
    }
    return list;
  }

  private getStyleDegree(style: VoiceStyle): number {
    if (style === 'excited' || style === 'cheerful') return 1.25;
    if (style === 'soft_shy' || style === 'affectionate') return 1.15;
    if (style === 'angry') return 1.1;
    return 1.05;
  }

  private probeAudioDuration(url: string, text: string, speed: number): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      const fallback = this.estimateDuration(text, speed);
      const timer = setTimeout(() => resolve(fallback), 2500);

      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : fallback);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        resolve(fallback);
      };
      audio.src = url;
    });
  }

  private estimateDuration(text: string, speed: number): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(2, Math.round((words / 2.6) / Math.max(0.7, speed)));
  }

  private loadSettings(): VoiceSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_VOICE_SETTINGS };
    try {
      const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_VOICE_SETTINGS };
  }

  private saveSettings(settings: VoiceSettings): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }
}
