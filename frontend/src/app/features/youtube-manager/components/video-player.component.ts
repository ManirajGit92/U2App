import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
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
    <div class="player-container">
      <div class="direct-input-bar">
        <input type="text" [(ngModel)]="directUrl" placeholder="Paste YouTube URL here and press Enter..." (keyup.enter)="playDirectUrl()">
        <button class="btn btn-primary" (click)="playDirectUrl()">Play</button>
        <button class="btn btn-secondary" *ngIf="isDirectPlaying && !isVideoInDb" (click)="saveDirectToDb()">➕ Save to DB</button>
      </div>

      <div class="video-info" *ngIf="video">
        <h2>{{ video.videoName }}</h2>
        <div class="tags" *ngIf="video.tags.length > 0">
          <span class="tag" *ngIf="video.category">{{ video.category }}</span>
          <span class="tag" *ngFor="let t of video.tags">{{ t }}</span>
        </div>
      </div>

      <div class="player-wrapper" [class.has-border]="video">
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
      </div>

      <div class="advanced-controls" *ngIf="video">
        <div class="control-group">
          <h3>Slicing & Loops</h3>
          <p class="status-text">
            Current Slice: {{ currentSliceIndex + 1 }} / {{ activeSlices.length }}
            | Loops Remaining: {{ currentLoopRemaining }}
          </p>
        </div>
        
        <div class="control-actions">
           <!-- Download Mock -->
           <a class="btn btn-secondary" [href]="'https://www.ssyoutube.com/watch?v=' + video.youtubeVideoId" target="_blank">
             ⬇️ Download Video (External)
           </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .player-container { display: flex; flex-direction: column; height: 100%; width: 100%; max-width: 900px; margin: 0 auto; gap: 16px; padding: 24px; overflow-y: auto; }
    
    .direct-input-bar { display: flex; gap: 8px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.1); }
    .direct-input-bar input { flex: 1; min-width: 0; background: transparent; border: none; color: #fff; font-size: 0.95rem; outline: none; }
    .direct-input-bar input::placeholder { color: rgba(255,255,255,0.4); }
    
    .video-info h2 { margin: 0 0 12px; color: #fff; font-size: 1.5rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
    .tags { display: flex; gap: 8px; flex-wrap: wrap; }
    .tag { background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.2)); border: 1px solid rgba(239,68,68,0.3); color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;}
    
    .player-wrapper { 
      flex: 1; 
      background: #0a0a0a; 
      border-radius: var(--radius-lg); 
      overflow: hidden; 
      display: flex; align-items: center; justify-content: center;
      position: relative;
      min-height: 400px;
      transition: all 0.3s ease;
    }
    .player-wrapper.has-border {
      border: 2px solid rgba(239,68,68,0.4);
      box-shadow: 0 0 24px rgba(239,68,68,0.1);
    }
    
    /* Ensure the youtube player expands */
    youtube-player { width: 100%; height: 100%; display: block; }
    ::ng-deep youtube-player iframe { width: 100% !important; height: 100% !important; aspect-ratio: 16/9; }
    
    .empty-state { color: #666; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;}
    .empty-icon { font-size: 3rem; margin-bottom: 12px; opacity: 0.5; }

    .advanced-controls { 
      background: rgba(255,255,255,0.05); 
      padding: 16px; 
      border-radius: var(--radius-md); 
      display: flex; justify-content: space-between; align-items: center;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .advanced-controls h3 { margin: 0 0 8px; font-size: 1rem; color: #fff; }
    .status-text { margin: 0; color: #aaa; font-size: 0.85rem; }
    .control-actions { display: flex; gap: 12px; }
    
    .btn { padding: 8px 16px; font-size: 0.9rem; border-radius: var(--radius-sm); border: none; font-weight: 500; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
    .btn-primary { background: var(--accent-primary); color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,0.3); }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-secondary { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
  `]
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('youtubePlayer') youtubePlayer: any;

  video: YouTubeVideoData | null = null;
  playerVars = { autoplay: 1, controls: 1, rel: 0 };
  
  directUrl = '';
  isDirectPlaying = false;
  isVideoInDb = true;

  // Slicing logic
  activeSlices: SliceTiming[] = [];
  currentSliceIndex = 0;
  currentLoopRemaining = 0;

  private destroy$ = new Subject<void>();
  private sliceMonitorSub: any;

  constructor(private state: YouTubeStateService) {}

  ngOnInit() {
    // Load YT API if not loaded
    if (!window.document.getElementById('yt-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    this.state.currentVideo$.pipe(takeUntil(this.destroy$)).subscribe((v: YouTubeVideoData | null) => {
      if (!v) {
        this.video = null;
        this.stopMonitoring();
        return;
      }
      
      this.video = v;
      this.activeSlices = v.sliceTimings || [];
      this.currentSliceIndex = 0;
      this.currentLoopRemaining = v.loopCount || 0;
      
      // If slicing exists, force start at slice zero
      if (this.activeSlices.length > 0) {
        this.playerVars = { ...this.playerVars, start: Math.floor(this.activeSlices[0].start) } as any;
      } else {
        this.playerVars = { ...this.playerVars, start: 0 } as any; // reset
      }

      this.startMonitoring();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopMonitoring();
  }

  onStateChange(event: any) {
    // 1 = PLAYING, 0 = ENDED
    if (event.data === 0) {
      if (!this.isDirectPlaying) {
        this.state.playNextVideo();
      }
    }
  }

  playDirectUrl() {
    if (!this.directUrl) return;
    const ytid = this.extractId(this.directUrl);
    if (ytid) {
      this.isDirectPlaying = true;
      this.isVideoInDb = !!this.state.videos.find(v => v.youtubeVideoId === ytid);
      
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
        loopCount: 0
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
      alert("Saved to local database! It will now appear in the Navigation Tree.");
    }
  }

  private extractId(url: string): string {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  }

  private startMonitoring() {
    this.stopMonitoring();
    this.sliceMonitorSub = interval(500).subscribe(() => {
      this.checkSliceBounds();
    });
  }

  private stopMonitoring() {
    if (this.sliceMonitorSub) {
      this.sliceMonitorSub.unsubscribe();
    }
  }

  private checkSliceBounds() {
    if (!this.youtubePlayer || !this.video || this.activeSlices.length === 0) return;
    
    // ensure player is ready
    if (!this.youtubePlayer.getCurrentTime) return;

    const currentTime = this.youtubePlayer.getCurrentTime();
    const currentSlice = this.activeSlices[this.currentSliceIndex];
    
    if (currentTime >= currentSlice.end) {
      if (this.currentLoopRemaining > 0) {
        // Loop back
        this.currentLoopRemaining--;
        this.youtubePlayer.seekTo(currentSlice.start, true);
      } else {
        // Move to next slice if available
        if (this.currentSliceIndex < this.activeSlices.length - 1) {
          this.currentSliceIndex++;
          this.currentLoopRemaining = this.video.loopCount || 0;
          this.youtubePlayer.seekTo(this.activeSlices[this.currentSliceIndex].start, true);
        } else {
          // Finished all slices
          if (this.isDirectPlaying) {
             this.youtubePlayer.pauseVideo();
          } else {
             this.state.playNextVideo();
          }
        }
      }
    }
  }
}
