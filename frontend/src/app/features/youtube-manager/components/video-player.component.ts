import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubePlayer } from '@angular/youtube-player';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeVideoData, SliceTiming } from '../models/youtube.models';
import { Subject, takeUntil, interval } from 'rxjs';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule, FormsModule, YouTubePlayer],
  template: `
    <div class="player-container" (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
      <!-- Top Direct Input Bar -->
      <div class="direct-input-bar">
        <input type="text" [(ngModel)]="directUrl" placeholder="Paste YouTube URL here and press Enter..." (keyup.enter)="playDirectUrl()">
        <button class="btn btn-primary" (click)="playDirectUrl()">Play</button>
        <button class="btn btn-secondary" *ngIf="isDirectPlaying && !isVideoInDb" (click)="saveDirectToDb()">➕ Save to DB</button>
      </div>

      <!-- Video Info -->
      <div class="video-info" *ngIf="video">
        <div class="title-row">
          <h2>{{ video.songName || video.videoName }}</h2>
          <button class="btn-fullscreen-toggle" (click)="toggleFullscreen()" title="Toggle Fullscreen">
            {{ isFullscreen ? '🗗 Exit Fullscreen' : '🖵 Fullscreen' }}
          </button>
        </div>
        <p class="movie-singer-info" *ngIf="video.movieName || video.singerName">
          <span *ngIf="video.movieName">🎬 {{ video.movieName }}</span>
          <span *ngIf="video.movieName && video.singerName"> • </span>
          <span *ngIf="video.singerName">🎙️ {{ video.singerName }}</span>
        </p>
        <div class="tags" *ngIf="video.tags.length > 0 || video.songType">
          <span class="tag song-type" *ngIf="video.songType">✨ {{ video.songType }}</span>
          <span class="tag" *ngFor="let t of video.tags">{{ t }}</span>
        </div>
      </div>

      <!-- Video Player Wrapper -->
      <div 
        #playerWrapper 
        class="player-wrapper" 
        [class.has-border]="video"
        [class.is-fullscreen]="isFullscreen">
        
        <youtube-player
          #youtubePlayer
          *ngIf="video"
          [videoId]="video.youtubeVideoId"
          [playerVars]="playerVars"
          (stateChange)="onStateChange($event)">
        </youtube-player>
        
        <div *ngIf="!video" class="empty-state">
          <span class="empty-icon">📺</span>
          <p>Select a video from the library or paste a URL above.</p>
        </div>

        <!-- Floating Fullscreen Exit Button -->
        <button 
          *ngIf="isFullscreen" 
          class="exit-fullscreen-floating" 
          (click)="toggleFullscreen()">
          Exit Fullscreen
        </button>

        <!-- Carousel Transition Overlay -->
        <div 
          class="transition-overlay" 
          *ngIf="isTransitioning"
          [class.slide-left]="transitionDirection === 'left'"
          [class.slide-right]="transitionDirection === 'right'">
          <div class="transition-card">
            <img [src]="'https://img.youtube.com/vi/' + transitionVideo?.youtubeVideoId + '/mqdefault.jpg'" class="transition-thumb" alt="">
            <div class="transition-meta">
              <span class="next-label">PLAYING NEXT</span>
              <span class="next-title">{{ transitionVideo?.songName || transitionVideo?.videoName }}</span>
              <span class="next-desc" *ngIf="transitionVideo?.singerName">{{ transitionVideo?.singerName }}</span>
            </div>
            <div class="transition-loader"></div>
          </div>
        </div>
      </div>

      <!-- Advanced Slicing & Export Options -->
      <div class="advanced-controls" *ngIf="video">
        <div class="control-group">
          <h3>Slicing & Loop Segments</h3>
          <p class="status-text" *ngIf="activeSlices.length > 0; else noSlices">
            Active Segment: {{ currentSliceIndex + 1 }} / {{ activeSlices.length }}
            ({{ activeSlices[currentSliceIndex].start }}s - {{ activeSlices[currentSliceIndex].end }}s)
            | Loops Remaining: {{ currentLoopRemaining }}
          </p>
          <ng-template #noSlices>
            <p class="status-text">Playing full video (no slices defined).</p>
          </ng-template>
        </div>
        
        <div class="control-actions">
           <!-- External Download Mock -->
           <a class="btn btn-secondary" [href]="'https://www.ssyoutube.com/watch?v=' + video.youtubeVideoId" target="_blank">
             ⬇️ Download external video link
           </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .player-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      gap: 12px;
      padding: 0.75rem;
      overflow-y: auto;
    }
    
    .direct-input-bar {
      display: flex;
      gap: 8px;
      background: var(--bg-secondary);
      padding: 0.5rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
    }
    .direct-input-bar input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 0.9rem;
      outline: none;
    }
    .direct-input-bar input::placeholder {
      color: var(--text-tertiary);
    }
    
    .video-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .video-info h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.35rem;
      font-weight: 700;
    }
    .movie-singer-info {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin: 0;
    }
    .btn-fullscreen-toggle {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 4px 10px;
      font-size: 0.8rem;
      font-weight: 600;
      border-radius: var(--radius-sm);
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-fullscreen-toggle:hover {
      background: var(--accent-surface);
      color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .tag {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .song-type {
      background: var(--accent-surface);
      color: var(--accent-primary);
      border-color: var(--accent-primary);
    }
    
    .player-wrapper { 
      flex: 1; 
      background: #000; 
      border-radius: var(--radius-lg); 
      overflow: hidden; 
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      min-height: 380px;
      transition: all 0.3s ease;
    }
    .player-wrapper.has-border {
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-md);
    }

    .player-wrapper.is-fullscreen {
      width: 100% !important;
      height: 100% !important;
      border-radius: 0;
      border: none;
    }
    
    youtube-player {
      width: 100%;
      height: 100%;
      display: block;
    }
    ::ng-deep youtube-player iframe {
      width: 100% !important;
      height: 100% !important;
      aspect-ratio: 16/9;
    }
    
    .empty-state {
      color: var(--text-tertiary);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    .exit-fullscreen-floating {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.8rem;
      z-index: 10;
    }
    .exit-fullscreen-floating:hover {
      background: rgba(0,0,0,0.8);
    }

    .transition-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15,15,26,0.95);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.6s cubic-bezier(0.77, 0, 0.175, 1);
    }
    
    .transition-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
      max-width: 80%;
      color: #fff;
    }
    .transition-thumb {
      width: 200px;
      height: 112px;
      object-fit: cover;
      border-radius: var(--radius-md);
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    .transition-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .next-label {
      font-size: 0.7rem;
      letter-spacing: 2px;
      color: var(--accent-primary);
      font-weight: 700;
    }
    .next-title {
      font-size: 1.25rem;
      font-weight: 700;
    }
    .next-desc {
      font-size: 0.85rem;
      color: #aaa;
    }
    .transition-loader {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      border-top-color: var(--accent-primary);
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .advanced-controls { 
      background: var(--bg-secondary); 
      padding: 0.6rem; 
      border-radius: var(--radius-md); 
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--border-color);
    }
    .advanced-controls h3 {
      margin: 0 0 4px;
      font-size: 0.85rem;
      color: var(--text-primary);
    }
    .status-text {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.78rem;
    }
    .control-actions {
      display: flex;
      gap: 12px;
    }
  `]
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('youtubePlayer') youtubePlayer: any;
  @ViewChild('playerWrapper') playerWrapper!: ElementRef;

  video: YouTubeVideoData | null = null;
  playerVars = { autoplay: 1, controls: 1, rel: 0, origin: window.location.origin };
  
  directUrl = '';
  isDirectPlaying = false;
  isVideoInDb = true;

  // Slicing logic
  activeSlices: SliceTiming[] = [];
  currentSliceIndex = 0;
  currentLoopRemaining = 0;

  // Carousel/Slide transitions
  isTransitioning = false;
  transitionDirection: 'left' | 'right' = 'left';
  transitionVideo: YouTubeVideoData | null = null;

  // Touch gesture state
  private touchStartX = 0;
  private touchStartY = 0;

  // Fullscreen state
  isFullscreen = false;

  private destroy$ = new Subject<void>();
  private sliceMonitorSub: any;

  constructor(private state: YouTubeStateService) {}

  ngOnInit() {
    // Add fullscreen change listener
    document.addEventListener('fullscreenchange', this.onFullscreenChange.bind(this));

    // Listen to video changes
    this.state.currentVideo$
      .pipe(takeUntil(this.destroy$))
      .subscribe((v: YouTubeVideoData | null) => {
        if (!v) {
          this.video = null;
          this.stopMonitoring();
          return;
        }

        if (this.video && this.video.id !== v.id) {
          this.triggerTransition(v);
        } else {
          this.loadVideoImmediate(v);
        }
      });

    // Subscribe to external control commands from Bottom Control Bar
    this.state.playerCommand$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ command, arg }) => {
        if (!this.youtubePlayer) return;
        try {
          switch (command) {
            case 'play':
              this.youtubePlayer.playVideo();
              break;
            case 'pause':
              this.youtubePlayer.pauseVideo();
              break;
            case 'seek':
              this.youtubePlayer.seekTo(arg, true);
              break;
            case 'volume':
              this.youtubePlayer.setVolume(arg);
              break;
            case 'speed':
              this.youtubePlayer.setPlaybackRate(arg);
              break;
          }
        } catch (e) {
          console.warn('Player command execution failed:', e);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopMonitoring();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
  }

  private triggerTransition(nextVid: YouTubeVideoData) {
    const sortedList = this.state.getFilteredAndSortedVideos();
    const curIdx = sortedList.findIndex(x => x.id === this.video?.id);
    const nextIdx = sortedList.findIndex(x => x.id === nextVid.id);
    
    this.transitionDirection = (nextIdx >= curIdx) ? 'left' : 'right';
    this.transitionVideo = nextVid;
    this.isTransitioning = true;

    setTimeout(() => {
      this.loadVideoImmediate(nextVid);
      this.isTransitioning = false;
    }, 750);
  }

  private loadVideoImmediate(v: YouTubeVideoData) {
    this.video = v;
    this.activeSlices = v.sliceTimings || [];
    this.currentSliceIndex = 0;
    this.currentLoopRemaining = v.loopCount || 0;

    if (v.id.startsWith('DIR-')) {
      this.isDirectPlaying = true;
      this.isVideoInDb = false;
    } else {
      this.isDirectPlaying = false;
      this.isVideoInDb = true;
    }

    if (this.activeSlices.length > 0) {
      this.playerVars = { ...this.playerVars, start: Math.floor(this.activeSlices[0].start) } as any;
    } else {
      this.playerVars = { ...this.playerVars, start: 0 } as any;
    }

    this.startMonitoring();
  }

  onStateChange(event: any) {
    // states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    const isPlaying = event.data === 1;
    this.state.updatePlayerState({ isPlaying });

    if (event.data === 0) {
      const loopMode = this.state.playerState$.pipe().subscribe(s => s.loopMode); // check loopMode
      
      // We handle loop modes here when the video actually ends
      this.handlePlaybackEnd();
    }
  }

  private handlePlaybackEnd() {
    this.state.playerState$.pipe(takeUntil(this.destroy$)).subscribe(ps => {
      if (ps.loopMode === 'one') {
        // Loop current video
        if (this.youtubePlayer && this.youtubePlayer.seekTo) {
          const startPos = this.activeSlices.length > 0 ? this.activeSlices[0].start : 0;
          this.youtubePlayer.seekTo(startPos, true);
          this.youtubePlayer.playVideo();
        }
      } else if (ps.loopMode === 'all') {
        // Play next video in playlist
        if (!this.isDirectPlaying) {
          this.state.playNextVideo();
        }
      } else {
        // loopMode === 'off' -> stop
        if (this.youtubePlayer && this.youtubePlayer.pauseVideo) {
          this.youtubePlayer.pauseVideo();
        }
      }
    }).unsubscribe();
  }

  playDirectUrl() {
    if (!this.directUrl) return;
    const ytid = this.extractId(this.directUrl);
    if (ytid) {
      const syntheticVideo: YouTubeVideoData = {
        id: 'DIR-' + Date.now(),
        videoName: 'Direct URL Video',
        youtubeUrl: this.directUrl,
        youtubeVideoId: ytid,
        category: 'Uncategorized',
        subcategory: 'Direct',
        tags: ['direct'],
        lyrics: '',
        sliceTimings: [],
        loopCount: 0,
        songName: 'Direct Playback',
        singerName: '',
        musicianName: '',
        songType: '',
        actor: '',
        actress: '',
        songWriter: '',
        movieName: '',
        directorName: '',
        releaseYear: null,
        customFields: [],
        bookmarks: []
      };
      
      this.state.setCurrentVideo(syntheticVideo);
    } else {
      alert("Invalid YouTube URL!");
    }
  }

  saveDirectToDb() {
    if (this.video && this.isDirectPlaying && !this.isVideoInDb) {
      this.state.addVideo(this.video);
      this.isVideoInDb = true;
      alert("Saved to local database!");
    }
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    
    const diffX = endX - this.touchStartX;
    const diffY = endY - this.touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
      if (diffX > 0) {
        this.state.playPrevVideo();
      } else {
        this.state.playNextVideo();
      }
    }
  }

  toggleFullscreen() {
    const el = this.playerWrapper.nativeElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch((err: any) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  private onFullscreenChange() {
    this.isFullscreen = !!document.fullscreenElement;
  }

  private startMonitoring() {
    this.stopMonitoring();
    this.sliceMonitorSub = interval(500).subscribe(() => {
      this.checkSliceBounds();
      this.publishRealTimeState();
    });
  }

  private stopMonitoring() {
    if (this.sliceMonitorSub) {
      this.sliceMonitorSub.unsubscribe();
    }
  }

  private publishRealTimeState() {
    if (!this.youtubePlayer || !this.video) return;
    try {
      if (this.youtubePlayer.getCurrentTime && this.youtubePlayer.getDuration) {
        const currentTime = this.youtubePlayer.getCurrentTime();
        const duration = this.youtubePlayer.getDuration();
        const volume = this.youtubePlayer.getVolume ? this.youtubePlayer.getVolume() : 100;
        const speed = this.youtubePlayer.getPlaybackRate ? this.youtubePlayer.getPlaybackRate() : 1;
        
        this.state.updatePlayerState({
          currentTime,
          duration,
          volume,
          speed
        });
      }
    } catch(e) {}
  }

  private checkSliceBounds() {
    if (!this.youtubePlayer || !this.video || this.activeSlices.length === 0) return;
    if (!this.youtubePlayer.getCurrentTime) return;

    const currentTime = this.youtubePlayer.getCurrentTime();
    const currentSlice = this.activeSlices[this.currentSliceIndex];
    
    if (currentTime >= currentSlice.end) {
      if (this.currentLoopRemaining > 0) {
        this.currentLoopRemaining--;
        this.youtubePlayer.seekTo(currentSlice.start, true);
      } else {
        if (this.currentSliceIndex < this.activeSlices.length - 1) {
          this.currentSliceIndex++;
          this.currentLoopRemaining = this.video.loopCount || 0;
          this.youtubePlayer.seekTo(this.activeSlices[this.currentSliceIndex].start, true);
        } else {
          // Loop modes for final slice boundary
          this.handlePlaybackEnd();
        }
      }
    }
  }

  private extractId(url: string): string {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  }
}
