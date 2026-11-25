import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  GirlChatMessage,
  QUICK_PROMPT_SUGGESTIONS,
  VoiceStyle,
} from './models/girl-chat.models';
import { AIConversationService } from './services/ai-conversation.service';
import { ConversationHistoryService } from './services/conversation-history.service';
import { GirlVideoMappingService } from './services/girl-video-mapping.service';
import { TextToSpeechService } from './services/text-to-speech.service';
import { VideoPlaybackService } from './services/video-playback.service';
import { GirlVideoPlayerComponent } from './components/girl-video-player/girl-video-player.component';
import { ChatMessageComponent } from './components/chat-message/chat-message.component';
import { VideoLibraryComponent } from './components/video-library/video-library.component';
import { VoiceSettingsComponent } from './components/voice-settings/voice-settings.component';
import { CharacterSettingsComponent } from './components/character-settings/character-settings.component';

type SidebarTab = 'history' | 'settings' | 'library';

@Component({
  selector: 'app-interactive-girl-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GirlVideoPlayerComponent,
    ChatMessageComponent,
    VideoLibraryComponent,
    VoiceSettingsComponent,
    CharacterSettingsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './interactive-girl-chat.component.html',
  styleUrl: './interactive-girl-chat.component.scss',
})
export class InteractiveGirlChatComponent implements OnDestroy {
  private readonly router = inject(Router);
  readonly aiService = inject(AIConversationService);
  readonly historyService = inject(ConversationHistoryService);
  readonly videoService = inject(GirlVideoMappingService);
  readonly tts = inject(TextToSpeechService);
  readonly playback = inject(VideoPlaybackService);

  @ViewChild('chatScrollArea') chatScrollArea?: ElementRef<HTMLDivElement>;
  @ViewChild('rootShell') rootShell?: ElementRef<HTMLDivElement>;

  readonly quickPrompts = QUICK_PROMPT_SUGGESTIONS;

  readonly userInput = signal<string>('');
  readonly sidebarOpen = signal<boolean>(true);
  readonly activeTab = signal<SidebarTab>('history');
  readonly historySearch = signal<string>('');
  readonly isFullscreen = signal<boolean>(false);
  readonly isBusy = signal<boolean>(false);

  readonly filteredConversations = computed(() => {
    const q = this.historySearch().trim().toLowerCase();
    const all = this.historyService.conversations();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q),
    );
  });

  constructor() {
    // Auto-scroll conversation area when messages change
    effect(() => {
      const count = this.historyService.activeMessages().length;
      if (count > 0) {
        queueMicrotask(() => this.scrollToBottom());
      }
    });
  }

  ngOnDestroy(): void {
    this.tts.stopVoiceInput();
    this.playback.stopAll();
    this.tts.revokeAllAudioUrls();
  }

  async sendPrompt(overrideText?: string): Promise<void> {
    const text = (overrideText ?? this.userInput()).trim();
    if (!text || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.userInput.set('');
    this.tts.stop();

    const userMsg: GirlChatMessage = {
      id: `usr_${Date.now().toString(36)}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    this.historyService.appendMessage(userMsg);

    try {
      const historyBeforeThis = this.historyService.activeMessages().slice(0, -1);
      const aiResponse = await this.aiService.sendMessage(text, historyBeforeThis);

      const aiMsgId = `ai_${Date.now().toString(36)}`;
      const charCfg = this.aiService.characterSettings();

      // Synchronize TTS generation + matched video playback
      const speech = await this.playback.playSynchronizedReaction(
        aiResponse,
        aiMsgId,
        {
          overrideVideoAudio: charCfg.overrideVideoAudio,
          overrideLoopVideo: charCfg.overrideLoopVideo,
        },
      );

      const aiMsg: GirlChatMessage = {
        id: aiMsgId,
        sender: 'assistant',
        text: aiResponse.responseText,
        timestamp: new Date().toISOString(),
        emotion: aiResponse.emotion,
        action: aiResponse.action,
        videoId: aiResponse.videoId,
        voiceStyle: aiResponse.voiceStyle,
        language: aiResponse.language,
        audioUrl: speech.audioUrl,
        audioDurationSec: speech.durationSec,
        voiceEnabled: aiResponse.voiceEnabled && this.tts.settings().enabled,
        videoAudioEnabled: aiResponse.videoAudioEnabled,
        loopVideo: aiResponse.loopVideo,
      };
      this.historyService.appendMessage(aiMsg);
    } finally {
      this.isBusy.set(false);
      this.scrollToBottom();
    }
  }

  async onReplayMessage(msg: GirlChatMessage): Promise<void> {
    const newUrl = await this.tts.replayMessageAudio(
      msg.id,
      msg.text,
      msg.audioUrl,
      msg.language ?? 'en',
      msg.voiceStyle ?? 'natural',
    );
    if (newUrl && newUrl !== msg.audioUrl) {
      this.historyService.updateMessageAudio(msg.id, newUrl);
    }
  }

  toggleVoiceInput(): void {
    if (this.tts.isListening()) {
      this.tts.stopVoiceInput();
      return;
    }

    this.tts.startVoiceInput((transcript) => {
      if (transcript.trim()) {
        void this.sendPrompt(transcript);
      }
    });
  }

  startNewChat(): void {
    this.playback.stopAll();
    this.historyService.createNewConversation();
  }

  clearCurrentChat(): void {
    this.playback.stopAll();
    this.historyService.clearActiveConversation();
  }

  selectConversation(id: string): void {
    this.playback.stopAll();
    this.historyService.selectConversation(id);
  }

  deleteConversation(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.historyService.deleteConversation(id);
  }

  openTab(tab: SidebarTab): void {
    this.activeTab.set(tab);
    this.sidebarOpen.set(true);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      this.rootShell?.nativeElement.requestFullscreen?.().catch(() => {});
      this.isFullscreen.set(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      this.isFullscreen.set(false);
    }
  }

  exitTool(): void {
    this.playback.stopAll();
    void this.router.navigate(['/']);
  }

  onQuickSpeedChange(speedVal: string): void {
    this.tts.updateSettings({ speed: Number(speedVal) || 1.0 });
  }

  onQuickStyleChange(styleVal: string): void {
    this.tts.updateSettings({ voiceStyle: styleVal as VoiceStyle | 'auto' });
  }

  formatRelativeTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendPrompt();
    }
  }

  private scrollToBottom(): void {
    const el = this.chatScrollArea?.nativeElement;
    if (!el) return;
    setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 30);
  }
}
