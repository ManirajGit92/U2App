import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeExcelService } from '../services/yt-excel.service';
import { YouTubeVideoData } from '../models/youtube.models';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-lyrics-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lyrics-container">
      <div class="actions-header">
        <button class="btn btn-primary btn-sm" (click)="saveToExcel()" [disabled]="!video">💾 Save Data to Excel</button>
      </div>

      <div class="lyrics-content" *ngIf="video">
        <h3>{{ video.videoName }}</h3>
        
        <div class="dictation-panel">
          <button class="btn btn-secondary btn-sm" (click)="toggleDictation()" [class.active-mic]="isListening">
            {{ isListening ? '⏹️ Stop Dictation' : '🎙️ Mic Dictation (Beta)' }}
          </button>
          <p class="helper-text text-muted" style="margin-top:4px">
            Listen to the video and speak into the mic to transcribe lyrics. (CORS blocks direct iframe audio extraction).
          </p>
        </div>

        <textarea 
          class="lyrics-textarea" 
          [(ngModel)]="currentLyrics" 
          (ngModelChange)="onLyricsChange()"
          placeholder="Video lyrics or notes here..."></textarea>
      </div>

      <div *ngIf="!video" class="empty-state">
        Select a video to view or edit lyrics.
      </div>
    </div>
  `,
  styles: [`
    .lyrics-container { display: flex; flex-direction: column; gap: 16px; height: 100%; }
    .actions-header { border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
    .lyrics-content { flex: 1; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
    .lyrics-content h3 { margin: 0; font-size: 1rem; color: var(--text-primary); }
    
    .dictation-panel { background: rgba(0,0,0,0.02); padding: 12px; border-radius: var(--radius-sm); border: 1px dashed var(--border-color); }
    .active-mic { background: rgba(239, 68, 68, 0.1) !important; color: #ef4444 !important; border-color: #ef4444 !important; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
    
    .lyrics-textarea { 
      flex: 1; 
      width: 100%; 
      resize: none; 
      padding: 12px; 
      border: 1px solid var(--border-color); 
      border-radius: var(--radius-sm); 
      background: var(--bg-primary); 
      color: var(--text-primary); 
      font-family: inherit;
      line-height: 1.6;
    }
    
    .btn { cursor: pointer; padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid transparent; }
    .btn-primary { background: var(--accent-primary); color: #fff; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); }
    
    .text-muted { font-size: 0.75rem; color: var(--text-tertiary); }
    .empty-state { text-align: center; color: var(--text-tertiary); padding: 32px 0; font-size: 0.9rem; }
  `]
})
export class LyricsPanelComponent implements OnInit, OnDestroy {
  video: YouTubeVideoData | null = null;
  currentLyrics = '';
  
  isListening = false;
  private recognition: any;
  private destroy$ = new Subject<void>();

  constructor(
    private state: YouTubeStateService,
    private excelServ: YouTubeExcelService
  ) {}

  ngOnInit() {
    this.state.currentVideo$.pipe(takeUntil(this.destroy$)).subscribe((v: YouTubeVideoData | null) => {
      this.video = v;
      this.currentLyrics = v ? v.lyrics : '';
      if (this.isListening) this.toggleDictation(); // stop on video change
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
    }
  }

  saveToExcel() {
    const allVideos = this.state.videos;
    this.excelServ.exportData(allVideos);
    alert('Exported all videos back to Excel database successfully!');
  }

  // --- Dictation (Speech To Text) logic ---
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
          this.currentLyrics += (this.currentLyrics ? '\n' : '') + finalTranscript.trim();
          this.onLyricsChange();
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        // Auto-restart if still flagged as listening (continuous simulation if mic drops)
        if (this.isListening) {
          try { this.recognition.start(); } catch(e){}
        }
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
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
