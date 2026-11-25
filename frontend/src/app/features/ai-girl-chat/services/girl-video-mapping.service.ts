import { Injectable, computed, inject, signal } from '@angular/core';
import { FirestoreService } from '../../../core/services/firestore.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import {
  GirlAction,
  GirlEmotion,
  GirlVideoItem,
  VideoSourceType,
} from '../models/girl-chat.models';

const STORAGE_KEY = 'u2_girl_chat_video_library_v1';
const APP_NAME = 'ai-girl-chat';
const COLLECTION_NAME = 'videos';

/**
 * Starter template entries with empty URLs so the user can paste their own YouTube URLs
 * immediately without any hardcoded external video IDs inside the chat component.
 */
const DEFAULT_VIDEO_TEMPLATES: Omit<GirlVideoItem, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'neutral_default',
    name: 'Neutral Conversational (Default)',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'neutral',
    action: 'look_directly_talking',
    description: 'Default calm conversational posture used as fallback when no exact reaction matches.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: true,
    priority: 10,
    isActive: true,
    isDefault: true,
    isFallback: true,
  },
  {
    id: 'happy_smile',
    name: 'Happy & Smiling',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'happy',
    action: 'smile_while_talking',
    description: 'Warm cheerful smile while talking naturally.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: true,
    priority: 9,
    isActive: true,
    isDefault: false,
    isFallback: false,
  },
  {
    id: 'greeting_wave',
    name: 'Welcoming Greeting & Wave',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'happy',
    action: 'wave_hand',
    description: 'Friendly hand wave for greetings and introductions.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: false,
    priority: 10,
    isActive: true,
    isDefault: false,
    isFallback: false,
  },
  {
    id: 'shy_smile',
    name: 'Shy Smile',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'shy',
    action: 'smile_shyly',
    description: 'Gentle shy smile for sweet compliments or affectionate messages.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: true,
    priority: 9,
    isActive: true,
    isDefault: false,
    isFallback: false,
  },
  {
    id: 'romantic_look',
    name: 'Romantic Look',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'romantic',
    action: 'look_romantically',
    description: 'Soft affectionate expression.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: true,
    priority: 9,
    isActive: true,
    isDefault: false,
    isFallback: false,
  },
  {
    id: 'angry_talking',
    name: 'Angry Talking',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'angry',
    action: 'talk_angrily',
    description: 'Expressive annoyed/angry talking reaction.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: false,
    priority: 8,
    isActive: true,
    isDefault: false,
    isFallback: false,
  },
  {
    id: 'thinking_pose',
    name: 'Thinking & Curious',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'thinking',
    action: 'thinking_pose',
    description: 'Thoughtful expression while answering questions.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: true,
    priority: 8,
    isActive: true,
    isDefault: false,
    isFallback: false,
  },
  {
    id: 'laughing_natural',
    name: 'Laughing Naturally',
    youtubeUrl: '',
    youtubeVideoId: '',
    sourceType: 'youtube',
    emotion: 'laughing',
    action: 'laugh_naturally',
    description: 'Natural joyful laugh for jokes and funny moments.',
    videoAudioEnabled: false,
    voiceEnabled: true,
    loopVideo: false,
    priority: 9,
    isActive: true,
    isDefault: false,
    isFallback: false,
  },
];

@Injectable({
  providedIn: 'root',
})
export class GirlVideoMappingService {
  private readonly firestore = inject(FirestoreService);
  private readonly firebaseSync = inject(FirebaseSyncService);

  private readonly _videos = signal<GirlVideoItem[]>(this.loadFromLocalStorage());

  readonly videos = this._videos.asReadonly();
  readonly activeVideos = computed(() =>
    this._videos().filter((v) => v.isActive && this.hasPlayableSource(v)),
  );
  readonly configuredCount = computed(
    () => this._videos().filter((v) => this.hasPlayableSource(v)).length,
  );

  constructor() {
    this.firebaseSync.onAuthChange((uid) => {
      if (uid) {
        void this.syncFromFirestore(uid);
      }
    });
  }

  /**
   * Extracts a YouTube 11-character video ID from standard watch, youtu.be, shorts, or embed URLs.
   */
  extractYouTubeVideoId(urlOrId: string): string {
    const raw = (urlOrId || '').trim();
    if (!raw) return '';

    // Already a plain 11-char YouTube ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
      return raw;
    }

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /[?&]v=([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
    return '';
  }

  detectSourceType(url: string): VideoSourceType {
    const raw = (url || '').trim().toLowerCase();
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/.test(raw)) {
      return 'direct';
    }
    return 'youtube';
  }

  hasPlayableSource(video: GirlVideoItem | null | undefined): boolean {
    if (!video) return false;
    if (video.sourceType === 'direct') {
      return Boolean(video.youtubeUrl?.trim());
    }
    return Boolean(video.youtubeVideoId?.trim());
  }

  getThumbnailUrl(video: GirlVideoItem): string {
    if (video.sourceType === 'youtube' && video.youtubeVideoId) {
      return `https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`;
    }
    return '';
  }

  /**
   * Selects the best matching active playable video for an AI emotion + action + optional videoId.
   */
  resolveVideo(
    emotion: GirlEmotion,
    action?: GirlAction,
    requestedVideoId?: string,
  ): GirlVideoItem | null {
    const playable = this.activeVideos();
    if (playable.length === 0) {
      return null;
    }

    // 1. Exact ID match from AI response
    if (requestedVideoId) {
      const byId = playable.find((v) => v.id.toLowerCase() === requestedVideoId.toLowerCase());
      if (byId) return byId;
    }

    // 2. Exact emotion + action match (highest priority)
    if (action) {
      const exactBoth = playable
        .filter((v) => v.emotion === emotion && v.action === action)
        .sort((a, b) => b.priority - a.priority);
      if (exactBoth.length > 0) return exactBoth[0];
    }

    // 3. Exact emotion match (highest priority)
    const exactEmotion = playable
      .filter((v) => v.emotion === emotion)
      .sort((a, b) => b.priority - a.priority);
    if (exactEmotion.length > 0) return exactEmotion[0];

    // 4. Close emotional family match
    const familyFallback = this.findEmotionalFamilyMatch(emotion, playable);
    if (familyFallback) return familyFallback;

    // 5. Configured fallback or default video
    return this.getFallbackVideo() ?? playable[0];
  }

  getDefaultVideo(): GirlVideoItem | null {
    const playable = this.activeVideos();
    return (
      playable.find((v) => v.isDefault) ??
      playable.find((v) => v.emotion === 'neutral') ??
      playable[0] ??
      null
    );
  }

  getFallbackVideo(): GirlVideoItem | null {
    const playable = this.activeVideos();
    return (
      playable.find((v) => v.isFallback) ??
      playable.find((v) => v.isDefault) ??
      playable.find((v) => v.emotion === 'neutral') ??
      playable[0] ??
      null
    );
  }

  /**
   * Returns a lightweight metadata payload for the AI backend so it can pick exact videoIds.
   */
  getCatalogForAI(): Array<{
    id: string;
    name: string;
    emotion: string;
    action: string;
    description: string;
    videoAudioEnabled: boolean;
    loopVideo: boolean;
    priority: number;
    isDefault: boolean;
  }> {
    return this.activeVideos().map((v) => ({
      id: v.id,
      name: v.name,
      emotion: v.emotion,
      action: v.action,
      description: v.description,
      videoAudioEnabled: v.videoAudioEnabled,
      loopVideo: v.loopVideo,
      priority: v.priority,
      isDefault: v.isDefault,
    }));
  }

  addVideo(
    input: Omit<GirlVideoItem, 'id' | 'youtubeVideoId' | 'sourceType' | 'createdAt' | 'updatedAt'>,
  ): GirlVideoItem {
    const now = new Date().toISOString();
    const sourceType = this.detectSourceType(input.youtubeUrl);
    const youtubeVideoId =
      sourceType === 'youtube' ? this.extractYouTubeVideoId(input.youtubeUrl) : '';

    const newItem: GirlVideoItem = {
      ...input,
      id: `${input.emotion}_${Date.now().toString(36)}`,
      sourceType,
      youtubeVideoId,
      createdAt: now,
      updatedAt: now,
    };

    const next = this.applySingletonFlags([...this._videos(), newItem], newItem);
    this.commitVideos(next);
    return newItem;
  }

  updateVideo(id: string, patch: Partial<GirlVideoItem>): void {
    const now = new Date().toISOString();
    let updatedItem: GirlVideoItem | null = null;

    const mapped = this._videos().map((item) => {
      if (item.id !== id) return item;
      const nextUrl = patch.youtubeUrl !== undefined ? patch.youtubeUrl : item.youtubeUrl;
      const sourceType = this.detectSourceType(nextUrl);
      const youtubeVideoId =
        sourceType === 'youtube' ? this.extractYouTubeVideoId(nextUrl) : '';

      updatedItem = {
        ...item,
        ...patch,
        youtubeUrl: nextUrl,
        sourceType,
        youtubeVideoId,
        updatedAt: now,
      };
      return updatedItem;
    });

    const next = updatedItem ? this.applySingletonFlags(mapped, updatedItem) : mapped;
    this.commitVideos(next);
  }

  deleteVideo(id: string): void {
    const next = this._videos().filter((v) => v.id !== id);
    this.commitVideos(next);

    const uid = this.firebaseSync.getUid();
    if (uid) {
      const path = `${this.firestore.getUserCollectionPath(uid, APP_NAME, COLLECTION_NAME)}/${id}`;
      void this.firestore.deleteDocument(path).catch((err) => {
        console.warn('Failed to delete girl-chat video from Firestore:', err);
      });
    }
  }

  toggleVideoActive(id: string): void {
    const target = this._videos().find((v) => v.id === id);
    if (!target) return;
    this.updateVideo(id, { isActive: !target.isActive });
  }

  setDefaultVideo(id: string): void {
    this.updateVideo(id, { isDefault: true });
  }

  setFallbackVideo(id: string): void {
    this.updateVideo(id, { isFallback: true });
  }

  private applySingletonFlags(list: GirlVideoItem[], changed: GirlVideoItem): GirlVideoItem[] {
    return list.map((item) => {
      if (item.id === changed.id) return item;
      return {
        ...item,
        isDefault: changed.isDefault ? false : item.isDefault,
        isFallback: changed.isFallback ? false : item.isFallback,
      };
    });
  }

  private findEmotionalFamilyMatch(
    emotion: GirlEmotion,
    playable: GirlVideoItem[],
  ): GirlVideoItem | null {
    const families: Record<GirlEmotion, GirlEmotion[]> = {
      happy: ['excited', 'laughing', 'playful', 'neutral'],
      excited: ['happy', 'laughing', 'surprised'],
      laughing: ['happy', 'playful', 'excited'],
      shy: ['romantic', 'happy', 'playful'],
      romantic: ['shy', 'happy'],
      playful: ['happy', 'shy', 'laughing'],
      curious: ['thinking', 'confused', 'neutral'],
      thinking: ['curious', 'neutral'],
      confused: ['curious', 'thinking', 'surprised'],
      surprised: ['excited', 'curious', 'happy'],
      worried: ['sad', 'thinking', 'neutral'],
      sad: ['crying', 'worried', 'neutral'],
      crying: ['sad', 'worried'],
      angry: ['worried', 'neutral'],
      neutral: ['happy', 'thinking'],
    };

    for (const candidate of families[emotion] ?? []) {
      const match = playable
        .filter((v) => v.emotion === candidate)
        .sort((a, b) => b.priority - a.priority)[0];
      if (match) return match;
    }
    return null;
  }

  private commitVideos(videos: GirlVideoItem[]): void {
    this._videos.set(videos);
    this.saveToLocalStorage(videos);

    const uid = this.firebaseSync.getUid();
    if (uid) {
      void this.persistToFirestore(uid, videos);
    }
  }

  private loadFromLocalStorage(): GirlVideoItem[] {
    if (typeof window === 'undefined') return this.buildDefaultTemplates();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.buildDefaultTemplates();
      const parsed = JSON.parse(raw) as GirlVideoItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('Could not load girl video library from localStorage:', err);
    }
    return this.buildDefaultTemplates();
  }

  private saveToLocalStorage(videos: GirlVideoItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    } catch (err) {
      console.warn('Could not save girl video library to localStorage:', err);
    }
  }

  private buildDefaultTemplates(): GirlVideoItem[] {
    const now = new Date().toISOString();
    return DEFAULT_VIDEO_TEMPLATES.map((t) => ({
      ...t,
      createdAt: now,
      updatedAt: now,
    }));
  }

  private async syncFromFirestore(uid: string): Promise<void> {
    try {
      const colPath = this.firestore.getUserCollectionPath(uid, APP_NAME, COLLECTION_NAME);
      const remote = await this.firestore.getCollection<GirlVideoItem>(colPath);
      if (remote.length > 0) {
        this._videos.set(remote);
        this.saveToLocalStorage(remote);
      }
    } catch (err) {
      console.warn('GirlVideoMappingService Firestore sync skipped:', err);
    }
  }

  private async persistToFirestore(uid: string, videos: GirlVideoItem[]): Promise<void> {
    try {
      const colPath = this.firestore.getUserCollectionPath(uid, APP_NAME, COLLECTION_NAME);
      const ops = videos.map((v) => ({
        type: 'set' as const,
        path: `${colPath}/${v.id}`,
        data: { ...v } as Record<string, unknown>,
      }));
      if (ops.length > 0) {
        await this.firestore.batchWrite(ops);
      }
    } catch (err) {
      console.warn('GirlVideoMappingService Firestore save failed:', err);
    }
  }
}
