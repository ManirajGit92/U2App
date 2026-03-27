import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContentCreatorService, ContentEntry, VoiceSettings } from './content-creator.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-content-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="creator-container" [class.preview-mode]="isPreviewActive()">
      <!-- Header -->
      <header class="creator-header glass-card">
        <div class="header-left">
          <span class="logo-icon">🎬</span>
          <h1>Content Creator</h1>
        </div>
        <div class="header-actions">
           <button class="btn btn-secondary" (click)="fileInput.click()">
            📥 Import Excel
          </button>
          <input type="file" #fileInput hidden (change)="onUpload($event)" accept=".xlsx, .xls">
          <button class="btn btn-secondary" (click)="service.exportToExcel()">
            📤 Export Excel
          </button>
          <button class="btn btn-primary" (click)="toggleFullPreview()" [disabled]="entries().length === 0">
            {{ isPreviewActive() ? '⏹ Stop Preview' : '▶ Full Preview' }}
          </button>
          <button class="btn btn-accent" (click)="exportVideo()" [disabled]="entries().length === 0 || isExporting()">
             {{ isExporting() ? '⏳ Exporting...' : '🎥 Export Video (MP4)' }}
          </button>
        </div>
      </header>

      <div class="main-layout">
        <!-- Sidebar: Editor & Settings -->
        <aside class="sidebar glass-card" *ngIf="!isPreviewActive()">
          <div class="sidebar-tabs">
            <button [class.active]="activeTab === 'entries'" (click)="activeTab = 'entries'">Entries ({{ entries().length }})</button>
            <button [class.active]="activeTab === 'settings'" (click)="activeTab = 'settings'">Settings</button>
          </div>

          <div class="tab-content">
            <!-- Entries List -->
            <div *ngIf="activeTab === 'entries'" class="entries-list">
              <div class="entry-card glass-card" *ngFor="let entry of entries(); let i = index">
                 <div class="entry-header">
                    <span>#{{ i + 1 }}</span>
                    <button class="icon-btn delete" (click)="removeEntry(i)">🗑️</button>
                 </div>
                 <div class="entry-fields">
                    <input type="text" [(ngModel)]="entry.imageUrl" placeholder="Image URL">
                    <textarea [(ngModel)]="entry.voiceContent" placeholder="Voice Content"></textarea>
                    <div class="field-row">
                       <input type="number" [(ngModel)]="entry.duration" placeholder="Duration (ms)">
                       <select [(ngModel)]="entry.animation">
                          <option value="fade">Fade</option>
                          <option value="slide-left">Slide Left</option>
                          <option value="slide-right">Slide Right</option>
                          <option value="zoom-in">Zoom In</option>
                          <option value="zoom-out">Zoom Out</option>
                       </select>
                    </div>
                 </div>
              </div>
              <button class="btn btn-outline full-width" (click)="addEntry()">+ Add New Slide</button>
            </div>

            <!-- Settings -->
            <div *ngIf="activeTab === 'settings'" class="settings-panel">
               <div class="setting-group">
                  <label>Voice (TTS)</label>
                  <select [(ngModel)]="currentVoiceURI" (change)="updateVoice()">
                    <option *ngFor="let v of voices" [value]="v.voiceURI">{{ v.name }} ({{ v.lang }})</option>
                  </select>
               </div>
               <div class="setting-group">
                  <label>Pitch: {{ voiceSettings().pitch }}</label>
                  <input type="range" min="0" max="2" step="0.1" [(ngModel)]="voiceSettings().pitch" (change)="updateVoice()">
               </div>
                <div class="setting-group">
                  <label>Speed: {{ voiceSettings().rate }}</label>
                  <input type="range" min="0.1" max="10" step="0.1" [(ngModel)]="voiceSettings().rate" (change)="updateVoice()">
               </div>
               <div class="setting-group">
                  <label>Subtitle Style</label>
                  <div class="subtitle-controls">
                     <input type="color" [(ngModel)]="subtitleColor" title="Font Color">
                     <input type="number" [(ngModel)]="subtitleSize" min="12" max="100" title="Font Size">
                     <select [(ngModel)]="subtitleFont">
                        <option value="'Inter', sans-serif">Inter</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Outfit', sans-serif">Outfit</option>
                        <option value="system-ui">System</option>
                     </select>
                  </div>
                  <div class="toggle-row">
                    <label>Enable Subtitles</label>
                    <input type="checkbox" [(ngModel)]="showSubtitles">
                  </div>
               </div>
            </div>
          </div>
        </aside>

        <!-- Main Display / Preview Area -->
        <main class="preview-area" [class.full]="isPreviewActive()">
          <div class="player-container glass-card" #playerContainer>
             <div class="slide-view" [class.active]="isPlaying()">
                @if (currentEntry()) {
                  <div class="slide-image" 
                       [style.backgroundImage]="'url(' + currentEntry()?.imageUrl + ')'"
                       [class]="currentEntry()?.animation"></div>
                  <div class="subtitles" *ngIf="showSubtitles" [style.color]="subtitleColor" [style.fontSize.px]="subtitleSize" [style.fontFamily]="subtitleFont">
                     <p>
                        @for (word of currentWords(); track $index) {
                           <span [class.highlighted]="$index === currentWordIndex()">{{ word }} </span>
                        }
                     </p>
                  </div>
                } @else {
                  <div class="empty-preview">
                    <span class="icon">📽️</span>
                    <p>Start preview or upload Excel to see the magic</p>
                  </div>
                }
             </div>
             
             <!-- Player Controls Overlay -->
             <div class="player-controls" *ngIf="isPlaying() || isPreviewActive()">
                <button class="icon-btn" (click)="togglePlay()">{{ isPlaying() ? '⏸' : '▶' }}</button>
                <div class="progress-bar">
                   <div class="progress-fill" [style.width.%]="progress()"></div>
                </div>
                <button class="icon-btn" (click)="exitPreview()" *ngIf="isPreviewActive()">❌</button>
             </div>

             <!-- Capturing Canvas (Hidden for Video Export) -->
             <canvas #captureCanvas width="1280" height="720" style="display:none"></canvas>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .creator-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-primary);
      color: var(--text-primary);
      overflow: hidden;
    }

    .creator-header {
      height: 70px;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      border-bottom: 1px solid var(--border-color);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo-icon { font-size: 1.8rem; }
    .header-left h1 { font-size: 1.4rem; margin: 0; font-weight: 800; }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .main-layout {
      flex: 1;
      display: flex;
      padding: 1rem;
      gap: 1rem;
      overflow: hidden;
    }

    .sidebar {
      width: 350px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-tabs button {
      flex: 1;
      padding: 1rem;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .sidebar-tabs button.active {
      color: var(--accent-primary);
      border-bottom: 2px solid var(--accent-primary);
    }

    .tab-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    .entries-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .entry-card {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .entry-header {
      display: flex;
      justify-content: space-between;
      color: var(--text-tertiary);
      font-size: 0.8rem;
    }

    .entry-fields {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .entry-fields input, .entry-fields textarea, .entry-fields select {
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .preview-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
    }

    .preview-area.full {
      position: fixed;
      inset: 0;
      z-index: 1000;
      border-radius: 0;
    }

    .player-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .slide-view {
      width: 100%;
      height: 100%;
      position: relative;
      background-size: cover;
      background-position: center;
      transition: all 0.5s ease;
    }

    .slide-image {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
    }

    /* Animations */
    .fade { animation: fadeIn 1s forwards; }
    .zoom-in { animation: zoomIn 10s forwards; }
    .zoom-out { animation: zoomOut 10s forwards; }
    .slide-left { animation: slideLeft 1s forwards; }
    .slide-right { animation: slideRight 1s forwards; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes zoomIn { from { transform: scale(1); } to { transform: scale(1.2); } }
    @keyframes zoomOut { from { transform: scale(1.2); } to { transform: scale(1); } }
    @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }

    .subtitles {
      position: absolute;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      width: 80%;
      background: rgba(0,0,0,0.5);
      padding: 1rem;
      border-radius: 8px;
    }

    .subtitles p { margin: 0; }
    .highlighted { color: #facc15; font-weight: 800; text-shadow: 0 0 10px rgba(250,204,21,0.5); }

    .player-controls {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      padding: 0.75rem 1.5rem;
      border-radius: 50px;
    }

    .progress-bar {
      flex: 1;
      height: 6px;
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--accent-primary);
      transition: width 0.1s linear;
    }

    .empty-preview {
      text-align: center;
      color: var(--text-tertiary);
    }
    .empty-preview .icon { font-size: 4rem; margin-bottom: 1rem; display: block; }

    .setting-group { margin-bottom: 1.5rem; }
    .setting-group label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600; }
    .setting-group input[type="range"], .setting-group select { width: 100%; }

    .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; }

    .subtitle-controls { display: flex; gap: 0.5rem; align-items: center; }
    .subtitle-controls input[type="color"] { width: 40px; height: 30px; padding: 0; border: none; }
    .subtitle-controls input[type="number"] { width: 60px; }

    .btn-accent { background: var(--accent-gradient); color: white; border: none; }
    .btn-accent:hover { opacity: 0.9; transform: translateY(-1px); }

    .full-width { width: 100%; }
  `]
})
export class ContentCreatorComponent implements OnInit, OnDestroy {
  service = inject(ContentCreatorService);
  
  entries = signal<ContentEntry[]>([]);
  voiceSettings = signal<VoiceSettings>({ pitch: 1, rate: 1, volume: 1 });
  
  activeTab: 'entries' | 'settings' = 'entries';
  isPreviewActive = signal(false);
  isPlaying = signal(false);
  isExporting = signal(false);
  
  currentEntry = signal<ContentEntry | null>(null);
  currentIndex = 0;
  progress = signal(0);
  
  // Subtitles
  showSubtitles = true;
  subtitleColor = '#ffffff';
  subtitleSize = 24;
  subtitleFont = "'Inter', sans-serif";
  currentWords = signal<string[]>([]);
  currentWordIndex = signal(-1);

  // TTS Voices
  voices: SpeechSynthesisVoice[] = [];
  currentVoiceURI = '';

  private subs = new Subscription();
  private playTimer: any;

  ngOnInit() {
    this.subs.add(this.service.entries$.subscribe(e => this.entries.set(e)));
    this.subs.add(this.service.voiceSettings$.subscribe(s => this.voiceSettings.set(s)));

    // Load voices
    this.loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    this.service.stopSpeaking();
    if (this.playTimer) clearTimeout(this.playTimer);
  }

  loadVoices() {
    this.voices = window.speechSynthesis.getVoices();
    if (this.voices.length > 0 && !this.currentVoiceURI) {
      this.currentVoiceURI = this.voices[0].voiceURI;
      this.updateVoice();
    }
  }

  updateVoice() {
    this.service.updateVoiceSettings({
      pitch: this.voiceSettings().pitch,
      rate: this.voiceSettings().rate,
      voiceURI: this.currentVoiceURI
    });
  }

  // --- Entries CRUD ---
  addEntry() {
    this.service.addEntry({
      imageUrl: '',
      voiceContent: '',
      duration: 5000,
      animation: 'fade'
    });
  }

  removeEntry(index: number) {
    this.service.removeEntry(index);
  }

  onUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.service.parseExcel(file);
    }
  }

  // --- Preview Logic ---
  toggleFullPreview() {
    if (this.isPreviewActive()) {
      this.exitPreview();
    } else {
      this.isPreviewActive.set(true);
      this.startPreview();
    }
  }

  startPreview() {
    this.currentIndex = 0;
    this.playNext();
  }

  exitPreview() {
    this.isPreviewActive.set(false);
    this.isPlaying.set(false);
    this.currentIndex = 0;
    this.currentEntry.set(null);
    this.service.stopSpeaking();
    if (this.playTimer) clearTimeout(this.playTimer);
  }

  togglePlay() {
    if (this.isPlaying()) {
      this.isPlaying.set(false);
      this.service.stopSpeaking();
      if (this.playTimer) clearTimeout(this.playTimer);
    } else {
      this.playNext();
    }
  }

  playNext() {
    if (this.currentIndex >= this.entries().length) {
      this.exitPreview();
      return;
    }

    const entry = this.entries()[this.currentIndex];
    this.currentEntry.set(entry);
    this.isPlaying.set(true);
    this.progress.set(0);

    // Prepare subtitles
    const words = entry.voiceContent.split(' ');
    this.currentWords.set(words);
    this.currentWordIndex.set(-1);

    if (this.playTimer) clearTimeout(this.playTimer);

    // Speak
    this.service.speak(
      entry.voiceContent,
      () => { 
        // Sync Visuals with Audio Start
        const step = 100 / (entry.duration / 100);
        let currentProgress = 0;
        const interval = setInterval(() => {
          if (!this.isPlaying() || this.currentEntry() !== entry) {
             clearInterval(interval);
             return;
          }
          currentProgress += step;
          this.progress.set(Math.min(currentProgress, 100));
          if (currentProgress >= 100) {
            clearInterval(interval);
          }
        }, 100);

        // Duration timer (starts when voice starts)
        this.playTimer = setTimeout(() => {
          if (this.isPlaying() && this.currentEntry() === entry) {
            this.currentIndex++;
            this.playNext();
          }
        }, entry.duration);
      },
      () => { /* onEnd */ },
      (event) => {
        // Find current word index based on charIndex
        const charIndex = event.charIndex;
        const textBefore = entry.voiceContent.substring(0, charIndex);
        const wordsBefore = textBefore.trim().split(/\s+/).length - 1;
        this.currentWordIndex.set(wordsBefore);
      }
    );
  }

  // --- Export Logic ---
  @ViewChild('captureCanvas') captureCanvas!: ElementRef<HTMLCanvasElement>;

  async exportVideo() {
    this.isExporting.set(true);
    const canvas = this.captureCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
        const stream = canvas.captureStream(30);
        
        // Priority for MP4 as requested by user
        let mimeType = 'video/mp4;codecs=avc1';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp9';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
        }
        
        console.log('Using MIME Type for export:', mimeType);
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Content_Creation.${extension}`;
          a.click();
          this.isExporting.set(false);
          alert(`Video export complete! Saved as ${extension.toUpperCase()}`);
        };

        recorder.start();
        
        // Play through each slide and render to canvas
        for (let i = 0; i < this.entries().length; i++) {
            if (!this.isExporting()) break;
            const entry = this.entries()[i];
            this.currentEntry.set(entry);
            
            // Load image
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = entry.imageUrl;
            
            try {
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error(`Failed to load image: ${entry.imageUrl}`));
                    // Timeout for image loading
                    setTimeout(() => reject(new Error('Image load timeout')), 10000);
                });
            } catch (err) {
                console.error(err);
                // Continue with next slide or blank
            }

            const startTime = Date.now();
            while (Date.now() - startTime < entry.duration) {
                if (!this.isExporting()) break;
                
                // Render frame
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                } else {
                    ctx.fillStyle = '#111';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
                // Render Subtitles
                if (this.showSubtitles) {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(0, canvas.height - 150, canvas.width, 120);
                    
                    ctx.fillStyle = this.subtitleColor;
                    ctx.font = `bold ${this.subtitleSize * 2}px ${this.subtitleFont}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Simple word wrap or truncated text
                    const maxWidth = canvas.width * 0.8;
                    ctx.fillText(entry.voiceContent, canvas.width / 2, canvas.height - 90, maxWidth);
                }
                
                await new Promise(r => requestAnimationFrame(r));
            }
        }

        recorder.stop();
    } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed. See console for details.');
        this.isExporting.set(false);
    }
  }
}
