import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TanglishConvertRequest {
  text: string;
  engine?: string;
  preserveUnknownWords?: boolean;
}

export interface TanglishConvertResponse {
  sourceText: string;
  tanglishText: string;
  engine: string;
  fullyMatched: boolean;
  appliedRules: string[];
  note?: string | null;
}

export interface TanglishSpeakRequest {
  text: string;
  voice: TanglishVoiceId;
  speed: number;
  format?: 'mp3' | 'wav';
  instructions?: string;
}

export type TanglishVoiceId =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'fable'
  | 'nova'
  | 'onyx'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar';

export interface TanglishVoiceOption {
  id: TanglishVoiceId;
  name: string;
  tone: string;
}

export const TANGLISH_VOICE_OPTIONS: readonly TanglishVoiceOption[] = [
  { id: 'coral', name: 'Coral', tone: 'Warm and clear' },
  { id: 'alloy', name: 'Alloy', tone: 'Balanced neutral' },
  { id: 'ash', name: 'Ash', tone: 'Calm and steady' },
  { id: 'ballad', name: 'Ballad', tone: 'Storytelling style' },
  { id: 'echo', name: 'Echo', tone: 'Light and crisp' },
  { id: 'fable', name: 'Fable', tone: 'Expressive' },
  { id: 'nova', name: 'Nova', tone: 'Bright and energetic' },
  { id: 'onyx', name: 'Onyx', tone: 'Deep and bold' },
  { id: 'sage', name: 'Sage', tone: 'Soft and composed' },
  { id: 'shimmer', name: 'Shimmer', tone: 'Gentle and polished' },
  { id: 'verse', name: 'Verse', tone: 'Natural narration' },
  { id: 'marin', name: 'Marin', tone: 'Studio quality' },
  { id: 'cedar', name: 'Cedar', tone: 'Grounded and rich' },
];

@Injectable({
  providedIn: 'root',
})
export class TanglishVoiceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.tanglishApiBaseUrl;

  convert(request: TanglishConvertRequest): Promise<TanglishConvertResponse> {
    return firstValueFrom(
      this.http.post<TanglishConvertResponse>(`${this.baseUrl}/convert`, request)
    );
  }

  speak(request: TanglishSpeakRequest): Promise<Blob> {
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/speak`, request, {
        responseType: 'blob',
      })
    );
  }

  getErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      if (
        error.error.includes('ECONNREFUSED') ||
        error.error.toLowerCase().includes('proxy error')
      ) {
        return 'Tanglish API is unreachable on http://127.0.0.1:5199. Start the .NET service or use npm start so the frontend launches it automatically.';
      }

      return error.error;
    }

    if (error.error?.detail) {
      return error.error.detail as string;
    }

    if (error.error?.title) {
      return error.error.title as string;
    }

    if (error.status === 0) {
      return 'Tanglish API is unreachable on http://127.0.0.1:5199. Start the .NET service or use npm start so the frontend launches it automatically.';
    }

    return `${fallback} (HTTP ${error.status})`;
  }
}
