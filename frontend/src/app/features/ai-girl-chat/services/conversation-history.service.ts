import { Injectable, computed, inject, signal } from '@angular/core';
import { FirestoreService } from '../../../core/services/firestore.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import { GirlChatMessage, GirlConversation } from '../models/girl-chat.models';

const HISTORY_STORAGE_KEY = 'u2_girl_chat_conversations_v1';
const APP_NAME = 'ai-girl-chat';
const COLLECTION_NAME = 'conversations';

@Injectable({
  providedIn: 'root',
})
export class ConversationHistoryService {
  private readonly firestore = inject(FirestoreService);
  private readonly firebaseSync = inject(FirebaseSyncService);

  private readonly _conversations = signal<GirlConversation[]>(this.loadFromLocalStorage());
  private readonly _activeConversationId = signal<string>('');

  readonly conversations = this._conversations.asReadonly();
  readonly activeConversationId = this._activeConversationId.asReadonly();

  readonly activeConversation = computed<GirlConversation>(() => {
    const all = this._conversations();
    const id = this._activeConversationId();
    return all.find((c) => c.id === id) ?? all[0];
  });

  readonly activeMessages = computed<GirlChatMessage[]>(
    () => this.activeConversation()?.messages ?? [],
  );

  constructor() {
    if (this._conversations().length === 0) {
      this.createNewConversation();
    } else {
      this._activeConversationId.set(this._conversations()[0].id);
    }

    this.firebaseSync.onAuthChange((uid) => {
      if (uid) {
        void this.syncFromFirestore(uid);
      }
    });
  }

  createNewConversation(title = 'New Conversation'): GirlConversation {
    const now = new Date().toISOString();
    const greeting: GirlChatMessage = {
      id: `msg_${Date.now().toString(36)}`,
      sender: 'assistant',
      text: "Hi! 👋 I'm so happy you're here. How are you doing today?",
      timestamp: now,
      emotion: 'happy',
      action: 'wave_hand',
      voiceStyle: 'cheerful',
      language: 'en',
      voiceEnabled: true,
      videoAudioEnabled: false,
      loopVideo: true,
    };

    const conversation: GirlConversation = {
      id: `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      preview: greeting.text,
      createdAt: now,
      updatedAt: now,
      messages: [greeting],
    };

    const next = [conversation, ...this._conversations()];
    this._conversations.set(next);
    this._activeConversationId.set(conversation.id);
    this.persist(next, conversation);
    return conversation;
  }

  selectConversation(id: string): void {
    if (this._conversations().some((c) => c.id === id)) {
      this._activeConversationId.set(id);
    }
  }

  appendMessage(message: GirlChatMessage): void {
    const activeId = this.activeConversation()?.id;
    if (!activeId) return;

    const now = new Date().toISOString();
    let updatedConv: GirlConversation | null = null;

    const next = this._conversations().map((conv) => {
      if (conv.id !== activeId) return conv;
      const messages = [...conv.messages, message];
      const isDefaultTitle =
        conv.title === 'New Conversation' || conv.title === 'Today';
      const title =
        isDefaultTitle && message.sender === 'user'
          ? this.deriveTitle(message.text)
          : conv.title;

      updatedConv = {
        ...conv,
        title,
        preview: message.text.slice(0, 72),
        updatedAt: now,
        messages,
      };
      return updatedConv;
    });

    // Move updated conversation to top
    const sorted = [...next].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    this._conversations.set(sorted);
    if (updatedConv) {
      this.persist(sorted, updatedConv);
    }
  }

  updateMessageAudio(
    messageId: string,
    audioUrl: string | null,
    audioDurationSec?: number,
  ): void {
    const activeId = this.activeConversation()?.id;
    if (!activeId) return;

    const next = this._conversations().map((conv) => {
      if (conv.id !== activeId) return conv;
      return {
        ...conv,
        messages: conv.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                audioUrl: audioUrl ?? m.audioUrl,
                audioDurationSec: audioDurationSec ?? m.audioDurationSec,
              }
            : m,
        ),
      };
    });
    this._conversations.set(next);
    this.saveToLocalStorage(next);
  }

  clearActiveConversation(): void {
    const activeId = this.activeConversation()?.id;
    if (!activeId) return;

    const now = new Date().toISOString();
    const greeting: GirlChatMessage = {
      id: `msg_${Date.now().toString(36)}`,
      sender: 'assistant',
      text: "Fresh start! 😊 What would you like to talk about?",
      timestamp: now,
      emotion: 'happy',
      action: 'smile_while_talking',
      voiceStyle: 'cheerful',
      language: 'en',
    };

    let updatedConv: GirlConversation | null = null;
    const next = this._conversations().map((conv) => {
      if (conv.id !== activeId) return conv;
      updatedConv = {
        ...conv,
        preview: greeting.text,
        updatedAt: now,
        messages: [greeting],
      };
      return updatedConv;
    });

    this._conversations.set(next);
    if (updatedConv) {
      this.persist(next, updatedConv);
    }
  }

  deleteConversation(id: string): void {
    const remaining = this._conversations().filter((c) => c.id !== id);
    if (remaining.length === 0) {
      this._conversations.set([]);
      this.createNewConversation();
    } else {
      this._conversations.set(remaining);
      if (this._activeConversationId() === id) {
        this._activeConversationId.set(remaining[0].id);
      }
      this.saveToLocalStorage(remaining);
    }

    const uid = this.firebaseSync.getUid();
    if (uid) {
      const path = `${this.firestore.getUserCollectionPath(uid, APP_NAME, COLLECTION_NAME)}/${id}`;
      void this.firestore.deleteDocument(path).catch(() => {});
    }
  }

  private deriveTitle(text: string): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= 28) return clean;
    return `${clean.slice(0, 28)}…`;
  }

  private persist(all: GirlConversation[], changed: GirlConversation): void {
    this.saveToLocalStorage(all);
    const uid = this.firebaseSync.getUid();
    if (uid) {
      const path = `${this.firestore.getUserCollectionPath(uid, APP_NAME, COLLECTION_NAME)}/${changed.id}`;
      // Strip transient blob: URLs before saving to Firestore
      const serializable: GirlConversation = {
        ...changed,
        messages: changed.messages.map((m) => ({ ...m, audioUrl: null })),
      };
      void this.firestore.setDocument(path, serializable).catch(() => {});
    }
  }

  private loadFromLocalStorage(): GirlConversation[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as GirlConversation[];
      if (Array.isArray(parsed)) {
        // Blob URLs expire across reloads
        return parsed.map((conv) => ({
          ...conv,
          messages: (conv.messages || []).map((m) => ({ ...m, audioUrl: null })),
        }));
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveToLocalStorage(conversations: GirlConversation[]): void {
    if (typeof window === 'undefined') return;
    try {
      const serializable = conversations.slice(0, 30).map((c) => ({
        ...c,
        messages: c.messages.slice(-60).map((m) => ({ ...m, audioUrl: null })),
      }));
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // ignore
    }
  }

  private async syncFromFirestore(uid: string): Promise<void> {
    try {
      const colPath = this.firestore.getUserCollectionPath(uid, APP_NAME, COLLECTION_NAME);
      const remote = await this.firestore.getCollection<GirlConversation>(colPath);
      if (remote.length > 0) {
        const sorted = [...remote].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        this._conversations.set(sorted);
        this._activeConversationId.set(sorted[0].id);
        this.saveToLocalStorage(sorted);
      }
    } catch {
      // ignore
    }
  }
}
