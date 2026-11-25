import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  GIRL_CHARACTER_IMAGE,
  GirlVideoItem,
} from '../../models/girl-chat.models';
import { EmotionDetectionService } from '../../services/emotion-detection.service';
import { VideoPlaybackService } from '../../services/video-playback.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function ensureYouTubeApiLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (ytApiPromise) {
    return ytApiPromise;
  }

  ytApiPromise = new Promise<void>((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return ytApiPromise;
}

@Component({
  selector: 'app-girl-video-player',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="character-stage"
      [class.blend-white]="blendWhiteBackground()"
      [class.is-speaking]="tts.isSpeaking()"
      [class.is-thinking]="isThinking()"
    >
      <!-- Fallback / Idle Pure-White Character Portrait -->
      <img
        class="character-fallback-img"
        [class.hidden]="showLiveVideo()"
        [src]="fallbackImageUrl() || defaultImage"
        alt="AI Virtual Girl"
        draggable="false"
      />

      <!-- Direct MP4/WebM Seamless Video Layer -->
      @if (activeDirectUrl()) {
        <video
          #directVideoEl
          class="direct-video-layer"
          [class.visible]="showLiveVideo()"
          [src]="activeDirectUrl()"
          [muted]="currentMute()"
          [loop]="currentLoop()"
          autoplay
          playsinline
          (playing)="onDirectPlaying()"
          (ended)="onDirectEnded()"
          (error)="onVideoError()"
        ></video>
      }

      <!-- Chromeless YouTube IFrame Layer (No Controls, No Branding, Pure White Blend) -->
      <div
        class="yt-crop-viewport"
        [class.visible]="showLiveVideo() && !activeDirectUrl()"
        aria-hidden="true"
      >
        <div class="yt-scale-frame">
          <div #ytHost class="yt-host-slot"></div>
        </div>
        <!-- Soft pure-white radial/edge feather mask so edges dissolve into #FFFFFF -->
        <div class="white-edge-feather"></div>
      </div>

      <!-- Optional Subtle Live Status / Emotion Pill -->
      @if (showEmotionBadge()) {
        <div class="character-status-pill" [class.speaking]="tts.isSpeaking()">
          <span class="status-dot" [style.background]="emotionMeta().color"></span>
          <span class="status-emoji">{{ emotionMeta().emoji }}</span>
          <span class="status-label">{{ emotionMeta().label }}</span>
          @if (tts.isSpeaking()) {
            <span class="speaking-bars" aria-label="Speaking">
              <i></i><i></i><i></i>
            </span>
          } @else if (isThinking()) {
            <span class="thinking-text">Thinking…</span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './girl-video-player.component.scss',
})
export class GirlVideoPlayerComponent implements AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly playback = inject(VideoPlaybackService);
  private readonly emotionService = inject(EmotionDetectionService);
  readonly tts = inject(TextToSpeechService);

  readonly blendWhiteBackground = input<boolean>(true);
  readonly showEmotionBadge = input<boolean>(true);
  readonly fallbackImageUrl = input<string>(GIRL_CHARACTER_IMAGE);
  readonly isThinking = input<boolean>(false);

  readonly defaultImage = GIRL_CHARACTER_IMAGE;

  @ViewChild('ytHost') ytHostRef?: ElementRef<HTMLDivElement>;
  @ViewChild('directVideoEl') directVideoRef?: ElementRef<HTMLVideoElement>;

  readonly showLiveVideo = signal<boolean>(false);
  readonly activeDirectUrl = signal<string>('');
  readonly currentMute = signal<boolean>(true);
  readonly currentLoop = signal<boolean>(true);
  readonly videoErrorOccurred = signal<boolean>(false);

  readonly emotionMeta = computed(() =>
    this.emotionService.getEmotionMeta(this.playback.currentCommand().emotion),
  );

  private ytPlayer: any = null;
  private ytReady = false;
  private lastLoadedYtId = '';
  private pendingYtCommand: {
    videoId: string;
    mute: boolean;
    loop: boolean;
  } | null = null;
  private isDestroyed = false;
  private revealTimerId: ReturnType<typeof setTimeout> | null = null;
  private loopMonitorId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const cmd = this.playback.currentCommand();
      if (cmd.playNonce === 0) {
        return;
      }
      this.applyPlaybackCommand(cmd.video, cmd.muteVideo, cmd.loopVideo);
    });
  }

  ngAfterViewInit(): void {
    void ensureYouTubeApiLoaded();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.clearTimers();
    this.destroyYtPlayer();
  }

  onDirectPlaying(): void {
    this.videoErrorOccurred.set(false);
    this.showLiveVideo.set(true);
    this.playback.isVideoPlaying.set(true);
  }

  onDirectEnded(): void {
    if (!this.currentLoop()) {
      this.playback.handleVideoEnded();
    }
  }

  onVideoError(): void {
    this.videoErrorOccurred.set(true);
    this.showLiveVideo.set(false);
    this.playback.isVideoPlaying.set(false);
  }

  private applyPlaybackCommand(
    video: GirlVideoItem | null,
    muteVideo: boolean,
    loopVideo: boolean,
  ): void {
    this.currentMute.set(muteVideo);
    this.currentLoop.set(loopVideo);
    this.videoErrorOccurred.set(false);

    if (!video) {
      this.activeDirectUrl.set('');
      this.showLiveVideo.set(false);
      this.pauseYtIfActive();
      return;
    }

    // Direct MP4 / WebM video path
    if (video.sourceType === 'direct' && video.youtubeUrl.trim()) {
      this.pauseYtIfActive();
      this.activeDirectUrl.set(video.youtubeUrl.trim());
      setTimeout(() => {
        const el = this.directVideoRef?.nativeElement;
        if (el) {
          el.muted = muteVideo;
          el.loop = loopVideo;
          el.currentTime = 0;
          el.play().catch(() => {
            el.muted = true;
            el.play().catch(() => this.onVideoError());
          });
        }
      });
      return;
    }

    // YouTube chromeless IFrame path
    this.activeDirectUrl.set('');
    const ytId = video.youtubeVideoId?.trim();
    if (!ytId) {
      this.showLiveVideo.set(false);
      this.pauseYtIfActive();
      return;
    }

    void this.playYouTubeVideo(ytId, muteVideo, loopVideo);
  }

  private async playYouTubeVideo(
    videoId: string,
    mute: boolean,
    loop: boolean,
  ): Promise<void> {
    await ensureYouTubeApiLoaded();
    if (this.isDestroyed || !this.ytHostRef?.nativeElement || !window.YT?.Player) {
      return;
    }

    if (!this.ytPlayer) {
      this.pendingYtCommand = { videoId, mute, loop };
      this.lastLoadedYtId = videoId;

      this.ngZone.runOutsideAngular(() => {
        this.ytPlayer = new window.YT.Player(this.ytHostRef!.nativeElement, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            showinfo: 0,
            mute: mute ? 1 : 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              this.ytReady = true;
              const pending = this.pendingYtCommand;
              this.pendingYtCommand = null;
              if (pending) {
                this.applyMuteAndPlay(event.target, pending.mute);
              }
            },
            onStateChange: (event: any) => {
              this.ngZone.run(() => this.handleYtStateChange(event.data));
            },
            onError: () => {
              this.ngZone.run(() => this.onVideoError());
            },
          },
        });
      });
      return;
    }

    if (!this.ytReady) {
      this.pendingYtCommand = { videoId, mute, loop };
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      try {
        if (this.lastLoadedYtId === videoId) {
          this.ytPlayer.seekTo(0, true);
          this.applyMuteAndPlay(this.ytPlayer, mute);
        } else {
          // Keep clean fallback portrait visible while new video buffers
          this.ngZone.run(() => this.showLiveVideo.set(false));
          this.lastLoadedYtId = videoId;
          this.ytPlayer.loadVideoById({ videoId, startSeconds: 0 });
          this.applyMuteAndPlay(this.ytPlayer, mute);
        }
      } catch {
        this.ngZone.run(() => this.onVideoError());
      }
    });
  }

  private applyMuteAndPlay(player: any, mute: boolean): void {
    try {
      if (mute) {
        player.mute();
      } else {
        player.unMute();
        player.setVolume(85);
      }
      player.playVideo();
    } catch {
      // ignore autoplay block; fallback image remains visible
    }
  }

  private handleYtStateChange(state: number): void {
    const YTState = window.YT?.PlayerState;
    if (!YTState) return;

    if (state === YTState.PLAYING) {
      this.videoErrorOccurred.set(false);
      this.playback.isVideoPlaying.set(true);
      this.startSeamlessLoopMonitor();

      // Delay reveal slightly so initial decoder frame / YouTube overlay flash never shows
      if (this.revealTimerId) {
        clearTimeout(this.revealTimerId);
      }
      this.revealTimerId = setTimeout(() => {
        if (!this.isDestroyed && this.playback.isVideoPlaying()) {
          this.showLiveVideo.set(true);
        }
      }, 240);
    } else if (state === YTState.PAUSED || state === YTState.CUED) {
      // Hide YouTube iframe immediately when paused/cued so the center pause icon & dark shade never appear
      this.clearTimers();
      this.showLiveVideo.set(false);
    } else if (state === YTState.ENDED) {
      this.clearTimers();
      if (this.currentLoop() && this.ytPlayer && this.ytReady) {
        this.ngZone.runOutsideAngular(() => {
          try {
            this.ytPlayer.seekTo(0, true);
            this.ytPlayer.playVideo();
          } catch {
            // ignore
          }
        });
      } else {
        this.showLiveVideo.set(false);
        this.playback.handleVideoEnded();
      }
    }
  }

  /**
   * Loops YouTube videos ~0.35s before the true end so YouTube never enters ENDED state
   * (preventing dark shade flashes, pause icons, and end-screen recommendations).
   */
  private startSeamlessLoopMonitor(): void {
    if (this.loopMonitorId) {
      clearInterval(this.loopMonitorId);
      this.loopMonitorId = null;
    }

    this.ngZone.runOutsideAngular(() => {
      this.loopMonitorId = setInterval(() => {
        if (!this.ytPlayer || !this.ytReady || !this.currentLoop()) {
          return;
        }
        try {
          const duration = Number(this.ytPlayer.getDuration?.() ?? 0);
          const current = Number(this.ytPlayer.getCurrentTime?.() ?? 0);
          if (duration > 1.2 && current > 0 && duration - current <= 0.35) {
            this.ytPlayer.seekTo(0.05, true);
          }
        } catch {
          // ignore transient YT API read errors
        }
      }, 150);
    });
  }

  private clearTimers(): void {
    if (this.revealTimerId) {
      clearTimeout(this.revealTimerId);
      this.revealTimerId = null;
    }
    if (this.loopMonitorId) {
      clearInterval(this.loopMonitorId);
      this.loopMonitorId = null;
    }
  }

  private pauseYtIfActive(): void {
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch {
        // ignore
      }
    }
  }

  private destroyYtPlayer(): void {
    if (this.ytPlayer) {
      try {
        this.ytPlayer.destroy();
      } catch {
        // ignore
      }
      this.ytPlayer = null;
      this.ytReady = false;
    }
  }
}
