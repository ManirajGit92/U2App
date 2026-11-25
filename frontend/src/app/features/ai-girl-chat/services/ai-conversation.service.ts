import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  CharacterSettings,
  GIRL_AVATAR_IMAGE,
  GIRL_CHARACTER_IMAGE,
  GirlChatMessage,
  StructuredGirlResponse,
} from '../models/girl-chat.models';
import { EmotionDetectionService } from './emotion-detection.service';
import { GirlVideoMappingService } from './girl-video-mapping.service';
import { TextToSpeechService } from './text-to-speech.service';

const CHARACTER_SETTINGS_KEY = 'u2_girl_chat_character_settings_v1';

const DEFAULT_CHARACTER_SETTINGS: CharacterSettings = {
  name: 'Aanya',
  personality: 'Warm, expressive, cheerful, caring, and naturally conversational.',
  blendWhiteBackground: true,
  overrideVideoAudio: false,
  overrideLoopVideo: false,
  showEmotionBadge: true,
  fallbackImageUrl: GIRL_CHARACTER_IMAGE,
  avatarImageUrl: GIRL_AVATAR_IMAGE,
};

@Injectable({
  providedIn: 'root',
})
export class AIConversationService {
  private readonly emotionService = inject(EmotionDetectionService);
  private readonly videoMapping = inject(GirlVideoMappingService);
  private readonly tts = inject(TextToSpeechService);

  readonly characterSettings = signal<CharacterSettings>(this.loadCharacterSettings());
  readonly isGenerating = signal<boolean>(false);
  readonly lastBackendError = signal<string | null>(null);

  updateCharacterSettings(patch: Partial<CharacterSettings>): void {
    const next = { ...this.characterSettings(), ...patch };
    this.characterSettings.set(next);
    this.saveCharacterSettings(next);
  }

  /**
   * Sends the user's message + conversation history + configured video catalog to
   * `/api/girl-chat/respond` and returns a structured emotional & playback response.
   */
  async sendMessage(
    userMessage: string,
    history: GirlChatMessage[],
  ): Promise<StructuredGirlResponse> {
    this.isGenerating.set(true);
    this.lastBackendError.set(null);

    const charCfg = this.characterSettings();
    const voiceCfg = this.tts.settings();

    const payload = {
      message: userMessage,
      history: history.slice(-14).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      language: voiceCfg.language,
      characterName: charCfg.name,
      personality: charCfg.personality,
      availableVideos: this.videoMapping.getCatalogForAI(),
      voiceEnabled: voiceCfg.enabled,
    };

    try {
      const endpoints = this.getEndpoints();
      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 18000);
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = (await response.json()) as StructuredGirlResponse;
            if (data?.responseText) {
              return data;
            }
          }
        } catch {
          // Try next endpoint
        }
      }

      this.lastBackendError.set(
        'AI backend is currently unreachable — using built-in contextual mode.',
      );
      return this.emotionService.generateOfflineFallback(
        userMessage,
        voiceCfg.language,
        voiceCfg.enabled,
      );
    } finally {
      this.isGenerating.set(false);
    }
  }

  private getEndpoints(): string[] {
    const list = ['/api/girl-chat/respond'];
    if (environment.pythonApiBaseUrl) {
      list.push(`${environment.pythonApiBaseUrl.replace(/\/$/, '')}/api/girl-chat/respond`);
    }
    return list;
  }

  private loadCharacterSettings(): CharacterSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_CHARACTER_SETTINGS };
    try {
      const raw = localStorage.getItem(CHARACTER_SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_CHARACTER_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_CHARACTER_SETTINGS };
  }

  private saveCharacterSettings(settings: CharacterSettings): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CHARACTER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }
}
