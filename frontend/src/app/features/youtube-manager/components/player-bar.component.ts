import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeVideoData, Bookmark } from '../models/youtube.models';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-player-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="player-bar-container" *ngIf="state.showPlayerBar && video">
      <!-- Progress Bar & Time -->
      <div class="progress-container">
        <span class="time-label">{{ formatTime(playerState.currentTime) }}</span>
        <input 
          type="range" 
          class="progress-slider" 
          [min]="0" 
          [max]="playerState.duration || 100" 
          [value]="playerState.currentTime" 
          (change)="onProgressChange($event)"
          (input)="onProgressDrag($event)">
        <span class="time-label">{{ formatTime(playerState.duration) }}</span>
      </div>

      <!-- Main Controls Row -->
      <div class="controls-row">
        <!-- Left Section: Video Details -->
        <div class="meta-section">
          <img [src]="'https://img.youtube.com/vi/' + video.youtubeVideoId + '/default.jpg'" alt="" class="bar-thumb">
          <div class="bar-meta">
            <span class="bar-title">{{ video.songName || video.videoName }}</span>
            <span class="bar-artist">{{ video.singerName || video.category }}</span>
          </div>
        </div>

        <!-- Center Section: Playback Buttons -->
        <div class="buttons-section">
          <button class="control-btn" (click)="state.playFirstVideo()" title="First Video">⏮</button>
          <button class="control-btn" (click)="state.playPrevVideo()" title="Previous Video">◀</button>
          
          <button class="play-btn" (click)="togglePlay()" [title]="playerState.isPlaying ? 'Pause' : 'Play'">
            {{ playerState.isPlaying ? '⏸' : '▶' }}
          </button>
          
          <button class="control-btn" (click)="state.playNextVideo()" title="Next Video">▶</button>
          <button class="control-btn" (click)="state.playLastVideo()" title="Last Video">⏭</button>
        </div>

        <!-- Right Section: Volume, Speed, Loop, Bookmarks -->
        <div class="utilities-section">
          <!-- Playback Speed -->
          <div class="utility-item speed-control">
            <select [ngModel]="playerState.speed" (ngModelChange)="setSpeed($event)">
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1">1.0×</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2.0×</option>
            </select>
          </div>

          <!-- Loop Mode -->
          <button 
            class="utility-btn loop-btn" 
            [class.active]="playerState.loopMode !== 'off'" 
            (click)="toggleLoopMode()" 
            [title]="'Loop mode: ' + playerState.loopMode">
            🔁 <span class="loop-badge">{{ playerState.loopMode }}</span>
          </button>

          <!-- Bookmarks -->
          <div class="bookmark-control-wrapper">
            <button class="utility-btn" (click)="addBookmark()" title="Add Bookmark at Current Time">
              🔖+
            </button>
            <div class="bookmarks-dropdown-container" *ngIf="video.bookmarks && video.bookmarks.length > 0">
              <button class="utility-btn" (click)="toggleBookmarks($event)" title="View Bookmarks">
                🔖 ({{ video.bookmarks.length }})
              </button>
              
              <!-- Bookmarks List Overlay -->
              <div class="bookmarks-dropdown-menu" *ngIf="showBookmarks" (click)="$event.stopPropagation()">
                <h4>Video Bookmarks (Click to Play)</h4>
                <div class="bookmark-list">
                  <div class="bookmark-item" *ngFor="let bm of video.bookmarks" (click)="seekToBookmark(bm.timestamp)">
                    <span class="bm-play-icon">▶</span>
                    <span class="bm-label">{{ bm.label }}</span>
                    <span class="bm-time">{{ formatTime(bm.timestamp) }}</span>
                    <button class="bm-delete" (click)="deleteBookmark(bm.id, $event)">✕</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Volume Controls -->
          <div class="volume-container">
            <span class="volume-icon" (click)="toggleMute()">
              {{ playerState.volume === 0 || isMuted ? '🔇' : playerState.volume < 40 ? '🔉' : '🔊' }}
            </span>
            <input 
              type="range" 
              class="volume-slider" 
              [min]="0" 
              [max]="100" 
              [value]="isMuted ? 0 : playerState.volume" 
              (input)="onVolumeChange($event)">
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .player-bar-container {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100vw;
      background: var(--navbar-bg);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border-top: 1px solid var(--border-color-strong);
      padding: 6px 1rem 12px 1rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    /* Progress bar */
    .progress-container {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    .time-label {
      font-size: 0.75rem;
      font-family: monospace;
      color: var(--text-secondary);
      min-width: 40px;
    }
    .progress-slider {
      flex: 1;
      height: 4px;
      background: var(--border-color-strong);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
      accent-color: var(--accent-primary);
      transition: height 0.1s;
    }
    .progress-slider:hover {
      height: 6px;
    }

    /* Controls row layout */
    .controls-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 48px;
      gap: 16px;
    }

    /* Meta section */
    .meta-section {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 30%;
      min-width: 180px;
    }
    .bar-thumb {
      width: 48px;
      height: 36px;
      object-fit: cover;
      border-radius: 4px;
      background: #000;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .bar-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .bar-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar-artist {
      font-size: 0.72rem;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Buttons section */
    .buttons-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .control-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.1rem;
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }
    .control-btn:hover {
      color: var(--accent-primary);
      background: var(--accent-surface);
    }
    .play-btn {
      background: var(--accent-gradient);
      border: none;
      color: #fff;
      font-size: 1.25rem;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(99,102,241,0.3);
      transition: transform 0.2s;
    }
    .play-btn:hover {
      transform: scale(1.08);
    }

    /* Utilities Section */
    .utilities-section {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 30%;
      justify-content: flex-end;
      min-width: 260px;
    }

    .utility-btn {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 4px 8px;
      font-size: 0.8rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      position: relative;
    }
    .utility-btn:hover {
      background: var(--accent-surface);
      color: var(--accent-primary);
    }
    .utility-btn.active {
      border-color: var(--accent-primary);
      background: var(--accent-surface);
    }

    .loop-badge {
      font-size: 0.65rem;
      text-transform: uppercase;
      font-weight: 700;
    }

    .speed-control select {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-size: 0.78rem;
      padding: 3px 6px;
      border-radius: var(--radius-sm);
      outline: none;
      cursor: pointer;
    }

    /* Bookmark control drop menu */
    .bookmark-control-wrapper {
      display: flex;
      gap: 4px;
      position: relative;
    }
    .bookmarks-dropdown-container {
      position: relative;
    }
    .bookmarks-dropdown-menu {
      position: absolute;
      bottom: 120%;
      right: 0;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color-strong);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: 0.5rem;
      width: 220px;
      z-index: 1010;
    }
    .bookmarks-dropdown-menu h4 {
      margin: 0 0 6px 0;
      font-size: 0.8rem;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 4px;
    }
    .bookmark-list {
      max-height: 150px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bookmark-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 6px;
      font-size: 0.78rem;
      border-radius: 4px;
      cursor: pointer;
      color: var(--text-primary);
    }
    .bookmark-item:hover {
      background: var(--bg-primary);
    }
    .bm-play-icon {
      color: var(--accent-primary);
      margin-right: 6px;
      font-size: 0.7rem;
    }
    .bm-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 6px;
    }
    .bm-time {
      font-family: monospace;
      color: var(--text-tertiary);
      font-size: 0.7rem;
    }
    .bm-delete {
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      padding: 2px 4px;
      margin-left: 6px;
      border-radius: 2px;
    }
    .bm-delete:hover {
      color: #ef4444;
      background: rgba(239,68,68,0.1);
    }

    /* Volume container styling */
    .volume-container {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .volume-icon {
      cursor: pointer;
      font-size: 0.95rem;
    }
    .volume-slider {
      width: 70px;
      height: 4px;
      cursor: pointer;
      accent-color: var(--accent-primary);
    }

    /* Responsiveness */
    @media (max-width: 768px) {
      .player-bar-container {
        padding: 4px 0.5rem 8px 0.5rem;
      }
      .meta-section {
        display: none; /* Hide details on small mobile */
      }
      .controls-row {
        gap: 8px;
      }
      .buttons-section {
        flex: 1;
        justify-content: center;
      }
      .utilities-section {
        width: auto;
        min-width: 0;
      }
      .volume-slider {
        display: none; /* Hide volume bar on mobile slider */
      }
    }
  `]
})
export class PlayerBarComponent implements OnInit, OnDestroy {
  state = inject(YouTubeStateService);

  video: YouTubeVideoData | null = null;
  playerState = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 100,
    speed: 1,
    loopMode: 'all' as 'off' | 'one' | 'all'
  };

  showBookmarks = false;
  isMuted = false;
  private prevVolume = 100;
  private isProgressDragging = false;

  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Listen to video
    this.state.currentVideo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(v => {
        this.video = v;
        this.showBookmarks = false;
      });

    // Listen to real-time player states
    this.state.playerState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ps => {
        // If user is actively dragging progress bar, don't overwrite currentTime values
        if (this.isProgressDragging) {
          const { currentTime, ...rest } = ps;
          this.playerState = { ...this.playerState, ...rest };
        } else {
          this.playerState = { ...this.playerState, ...ps };
        }
      });

    // Close bookmark list on click elsewhere
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.onDocumentClick.bind(this));
  }

  onDocumentClick() {
    this.showBookmarks = false;
  }

  togglePlay() {
    if (this.playerState.isPlaying) {
      this.state.sendCommand('pause');
    } else {
      this.state.sendCommand('play');
    }
  }

  onProgressDrag(event: any) {
    this.isProgressDragging = true;
    this.playerState.currentTime = parseFloat(event.target.value);
  }

  onProgressChange(event: any) {
    this.isProgressDragging = false;
    const seekVal = parseFloat(event.target.value);
    this.state.sendCommand('seek', seekVal);
  }

  onVolumeChange(event: any) {
    const vol = parseInt(event.target.value, 10);
    this.isMuted = vol === 0;
    this.state.sendCommand('volume', vol);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.prevVolume = this.playerState.volume;
      this.state.sendCommand('volume', 0);
    } else {
      this.state.sendCommand('volume', this.prevVolume);
    }
  }

  setSpeed(speed: any) {
    const rate = parseFloat(speed);
    this.state.sendCommand('speed', rate);
  }

  toggleLoopMode() {
    let nextMode: 'off' | 'one' | 'all' = 'all';
    if (this.playerState.loopMode === 'all') nextMode = 'one';
    else if (this.playerState.loopMode === 'one') nextMode = 'off';
    
    this.state.updatePlayerState({ loopMode: nextMode });
  }

  addBookmark() {
    if (!this.video) return;
    const label = prompt(`Enter Bookmark label at ${this.formatTime(this.playerState.currentTime)}:`);
    if (label !== null) {
      this.state.addBookmark(this.video.id, label, this.playerState.currentTime);
    }
  }

  toggleBookmarks(event: Event) {
    event.stopPropagation();
    this.showBookmarks = !this.showBookmarks;
  }

  seekToBookmark(seconds: number) {
    this.state.sendCommand('seek', seconds);
    this.state.sendCommand('play');
    this.showBookmarks = false;
  }

  deleteBookmark(id: string, event: Event) {
    event.stopPropagation();
    if (this.video && confirm('Delete this bookmark?')) {
      this.state.deleteBookmark(this.video.id, id);
    }
  }

  formatTime(sec: number): string {
    if (isNaN(sec) || sec === null || sec === undefined) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
