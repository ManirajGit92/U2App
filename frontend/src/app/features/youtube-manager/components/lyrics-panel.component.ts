import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeExcelService } from '../services/yt-excel.service';
import { YouTubeVideoData } from '../models/youtube.models';
import { Subject, takeUntil } from 'rxjs';

interface LrcLine {
  time: number; // in seconds
  text: string;
}

@Component({
  selector: 'app-lyrics-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lyrics-container" *ngIf="video">
      <div class="panel-actions-header">
        <div class="mode-selector">
          <button class="tab-btn-sm" [class.active]="viewMode === 'sync'" (click)="viewMode = 'sync'">
            🎵 Synced view
          </button>
          <button class="tab-btn-sm" [class.active]="viewMode === 'edit'" (click)="viewMode = 'edit'">
            ✏️ Edit / Mic
          </button>
        </div>
        <button class="btn btn-secondary btn-sm" (click)="saveToExcel()">
          💾 Save to Excel
        </button>
      </div>

      <!-- Sync view mode -->
      <div class="lyrics-view-scroll" *ngIf="viewMode === 'sync'" #lyricsScrollArea>
        <div class="lrc-wrapper" *ngIf="isLrcFormat; else plainLyricsView">
          <div 
            *ngFor="let line of lrcLines; let i = index" 
            [id]="'lrc-line-' + i"
            class="lrc-line"
            [class.active]="i === activeLineIndex"
            (click)="seekToLine(line.time)">
            {{ line.text }}
          </div>
        </div>
        
        <ng-template #plainLyricsView>
          <div class="plain-lyrics-display">
            <p *ngFor="let line of plainLines">{{ line }}</p>
            <div class="lrc-helper-alert" *ngIf="plainLines.length > 0">
              💡 Tip: Paste lyrics in LRC format (e.g. <code>[00:15] Lyic line</code>) to enable auto-scrolling sync!
            </div>
          </div>
        </ng-template>

        <div class="empty-lyrics-prompt" *ngIf="plainLines.length === 0 && lrcLines.length === 0">
          No lyrics available for this video yet. Switch to "Edit / Mic" mode to add some!
        </div>
      </div>

      <!-- Edit/Dictation mode -->
      <div class="lyrics-content" *ngIf="viewMode === 'edit'">
        <div class="dictation-panel">
          <button class="btn btn-secondary btn-sm" (click)="toggleDictation()" [class.active-mic]="isListening">
            {{ isListening ? '⏹️ Stop Dictation' : '🎙️ Mic Dictation (Beta)' }}
          </button>
          <p class="helper-text text-muted" style="margin-top:4px">
            Listen and speak to transcribe. Format with timestamps like <code>[00:10] line</code> for sync mode.
          </p>
        </div>

        <textarea 
          class="lyrics-textarea" 
          [(ngModel)]="currentLyrics" 
          (ngModelChange)="onLyricsChange()"
          placeholder="[00:00] Intro&#10;[00:10] Lyrics line 1&#10;[00:15] Lyrics line 2..."></textarea>
      </div>
    </div>

    <div *ngIf="!video" class="empty-state">
      <h3>Select a video</h3>
      <p>Select a video from the library to load lyrics.</p>
    </div>
  `,
  styles: [`
    .lyrics-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
      padding: 0.75rem;
      overflow: hidden;
      background: var(--surface-card);
    }
    
    .panel-actions-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      gap: 8px;
    }

    .mode-selector {
      display: flex;
      background: var(--bg-primary);
      border-radius: var(--radius-sm);
      padding: 2px;
      border: 1px solid var(--border-color);
    }
    .tab-btn-sm {
      background: none;
      border: none;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 4px;
    }
    .tab-btn-sm.active {
      background: var(--bg-secondary);
      color: var(--accent-primary);
      box-shadow: var(--shadow-sm);
    }
    
    .lyrics-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
    }
    
    .dictation-panel {
      background: var(--bg-primary);
      padding: 0.5rem;
      border-radius: var(--radius-md);
      border: 1px dashed var(--border-color-strong);
    }
    .active-mic {
      background: rgba(239, 68, 68, 0.1) !important;
      color: #ef4444 !important;
      border-color: #ef4444 !important;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    
    .lyrics-textarea { 
      flex: 1; 
      width: 100%; 
      resize: none; 
      padding: 0.5rem; 
      border: 1px solid var(--border-color-strong); 
      border-radius: var(--radius-md); 
      background: var(--bg-primary); 
      color: var(--text-primary); 
      font-family: monospace;
      font-size: 0.82rem;
      line-height: 1.5;
      outline: none;
    }
    .lyrics-textarea:focus {
      border-color: var(--accent-primary);
    }
    
    /* Lyrics sync scroll view */
    .lyrics-view-scroll {
      flex: 1;
      overflow-y: auto;
      padding-right: 4px;
      scroll-behavior: smooth;
      display: flex;
      flex-direction: column;
    }
    
    .lrc-wrapper {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 1.5rem 0.5rem;
    }

    .lrc-line {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all 0.35s ease;
      line-height: 1.4;
      user-select: none;
    }
    .lrc-line:hover {
      color: var(--text-primary);
    }
    .lrc-line.active {
      color: var(--accent-primary);
      font-size: 1.4rem;
      text-shadow: 0 0 15px rgba(99, 102, 241, 0.25);
      transform: scale(1.02);
      transform-origin: left center;
    }

    .plain-lyrics-display {
      font-size: 0.95rem;
      line-height: 1.6;
      color: var(--text-primary);
      padding: 1rem 0.5rem;
      white-space: pre-wrap;
    }

    .lrc-helper-alert {
      margin-top: 24px;
      background: var(--accent-surface);
      border: 1px solid var(--accent-primary);
      color: var(--accent-primary);
      padding: 8px;
      border-radius: var(--radius-md);
      font-size: 0.78rem;
    }
    .lrc-helper-alert code {
      background: rgba(0,0,0,0.05);
      padding: 2px 4px;
      border-radius: 4px;
    }

    .empty-lyrics-prompt {
      padding: 2rem;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 0.88rem;
    }
    
    .btn {
      cursor: pointer;
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      font-weight: 600;
    }
    .btn-secondary {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    .btn-secondary:hover {
      background: var(--accent-surface);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }
    
    .text-muted {
      font-size: 0.72rem;
      color: var(--text-tertiary);
    }
    .empty-state {
      text-align: center;
      color: var(--text-tertiary);
      padding: 2rem;
    }
    .empty-state h3 {
      font-size: 1rem;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
  `]
})
export class LyricsPanelComponent implements OnInit, OnDestroy {
  state = inject(YouTubeStateService);
  excelServ = inject(YouTubeExcelService);

  video: YouTubeVideoData | null = null;
  currentLyrics = '';
  
  viewMode: 'sync' | 'edit' = 'sync';
  
  // LRC parsing results
  isLrcFormat = false;
  lrcLines: LrcLine[] = [];
  plainLines: string[] = [];

  activeLineIndex = -1;

  isListening = false;
  private recognition: any;
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.state.currentVideo$
      .pipe(takeUntil(this.destroy$))
      .subscribe((v: YouTubeVideoData | null) => {
        this.video = v;
        this.currentLyrics = v ? v.lyrics : '';
        this.parseLyrics();
        this.activeLineIndex = -1;
        if (this.isListening) this.toggleDictation(); // stop listening on video switch
      });

    // Listen to real-time playback current time updates to scroll lyrics
    this.state.playerState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ps => {
        if (this.isLrcFormat && this.lrcLines.length > 0) {
          this.updateSyncScroll(ps.currentTime);
        }
      });

    this.setupSpeechRecognition();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.isListening && this.recognition) {
      this.recognition.stop();
    }
  }

  onLyricsChange() {
    if (this.video) {
      this.state.updateVideoLyrics(this.video.id, this.currentLyrics);
      this.parseLyrics();
    }
  }

  private parseLyrics() {
    this.lrcLines = [];
    this.plainLines = [];
    this.isLrcFormat = false;

    if (!this.currentLyrics) return;

    const rawLines = this.currentLyrics.split('\n');
    const timeRegex = /\\[(\\d{2}):(\\d{2})(?:\\.(\\d{2,3}))?\\]/; // matches [mm:ss] or [mm:ss.xx]

    let parsedLrc: LrcLine[] = [];

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      const match = line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3], 10) / (match[3].length === 2 ? 100 : 1000) : 0;
        const time = min * 60 + sec + ms;
        const text = match[4].trim();
        parsedLrc.push({ time, text });
      } else {
        this.plainLines.push(line);
      }
    }

    if (parsedLrc.length > 0) {
      this.isLrcFormat = true;
      // Sort lines in order of timestamp
      this.lrcLines = parsedLrc.sort((a, b) => a.time - b.time);
    }
  }

  private updateSyncScroll(currentTime: number) {
    let index = -1;
    for (let i = 0; i < this.lrcLines.length; i++) {
      if (currentTime >= this.lrcLines[i].time) {
        index = i;
      } else {
        break;
      }
    }

    if (index !== this.activeLineIndex && index !== -1) {
      this.activeLineIndex = index;
      this.scrollActiveLineIntoView(index);
    }
  }

  private scrollActiveLineIntoView(index: number) {
    setTimeout(() => {
      const element = document.getElementById(`lrc-line-${index}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }

  seekToLine(seconds: number) {
    this.state.sendCommand('seek', seconds);
  }

  saveToExcel() {
    this.excelServ.exportData(this.state.videos);
    alert('Exported all videos back to Excel database successfully!');
  }

  // Dictation Speech To Text logic
  private setupSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          // Add stamp based on current player state
          let stamp = '';
          this.state.playerState$.pipe(takeUntil(this.destroy$)).subscribe(ps => {
            const time = ps.currentTime;
            const min = Math.floor(time / 60).toString().padStart(2, '0');
            const sec = Math.floor(time % 60).toString().padStart(2, '0');
            stamp = `[${min}:${sec}] `;
          }).unsubscribe();

          this.currentLyrics += (this.currentLyrics ? '\n' : '') + stamp + finalTranscript.trim();
          this.onLyricsChange();
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try { this.recognition.start(); } catch(e){}
        }
      };
    }
  }

  toggleDictation() {
    if (!this.recognition) {
      alert("Speech Recognition API is not supported in your browser.");
      return;
    }
    this.isListening = !this.isListening;
    if (this.isListening) {
      this.recognition.start();
    } else {
      this.recognition.stop();
    }
  }
}
