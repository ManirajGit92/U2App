import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeVideoData, CustomFieldInstance } from '../models/youtube.models';

@Component({
  selector: 'app-video-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="cancel.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ isEdit ? 'Edit Video Entry' : 'Add New Video Entry' }}</h2>
          <button class="close-btn" (click)="cancel.emit()">✕</button>
        </div>

        <div class="modal-body">
          <form #videoForm="ngForm">
            <!-- Tabs -->
            <div class="form-tabs">
              <button type="button" class="tab-btn" [class.active]="activeTab === 'basic'" (click)="activeTab = 'basic'">
                📝 Basic Info
              </button>
              <button type="button" class="tab-btn" [class.active]="activeTab === 'metadata'" (click)="activeTab = 'metadata'">
                🏷️ Casting & Metadata
              </button>
              <button type="button" class="tab-btn" [class.active]="activeTab === 'custom'" (click)="activeTab = 'custom'">
                ⚙️ Custom Fields ({{ state.customFieldDefs.length }})
              </button>
            </div>

            <!-- Tab Content: Basic Details -->
            <div class="tab-content" *ngIf="activeTab === 'basic'">
              <div class="form-row">
                <div class="form-group col-12">
                  <label for="youtubeUrl">YouTube Video URL <span class="required">*</span></label>
                  <input 
                    id="youtubeUrl" 
                    type="text" 
                    name="youtubeUrl" 
                    [(ngModel)]="formData.youtubeUrl" 
                    (ngModelChange)="onUrlChange()" 
                    placeholder="https://www.youtube.com/watch?v=..." 
                    required>
                </div>
              </div>

              <!-- Live Preview Thumbnail -->
              <div class="preview-box" *ngIf="videoIdPreview">
                <img [src]="'https://img.youtube.com/vi/' + videoIdPreview + '/mqdefault.jpg'" alt="Live YouTube Preview">
                <div class="preview-info">
                  <span class="badge badge-active">Valid URL</span>
                  <span class="preview-id">ID: {{ videoIdPreview }}</span>
                </div>
              </div>

              <div class="form-row grid-2">
                <div class="form-group">
                  <label for="videoName">Entry Name <span class="required">*</span></label>
                  <input 
                    id="videoName" 
                    type="text" 
                    name="videoName" 
                    [(ngModel)]="formData.videoName" 
                    placeholder="General display name" 
                    required>
                </div>

                <div class="form-group">
                  <label for="songName">Song Name</label>
                  <input 
                    id="songName" 
                    type="text" 
                    name="songName" 
                    [(ngModel)]="formData.songName" 
                    placeholder="e.g. Arabic Kuthu">
                </div>
              </div>

              <div class="form-row grid-2">
                <div class="form-group">
                  <label for="category">Category <span class="required">*</span></label>
                  <div class="select-with-add">
                    <select id="category" name="category" [(ngModel)]="formData.category" required>
                      <option *ngFor="let cat of state.categories" [value]="cat">{{ cat }}</option>
                    </select>
                    <button type="button" class="btn-icon-add" (click)="promptAddCategory()">➕</button>
                  </div>
                </div>

                <div class="form-group">
                  <label for="subcategory">Subcategory</label>
                  <input 
                    id="subcategory" 
                    type="text" 
                    name="subcategory" 
                    [(ngModel)]="formData.subcategory" 
                    placeholder="e.g. Melody, Instrumental">
                </div>
              </div>

              <div class="form-row grid-2">
                <div class="form-group">
                  <label for="sliceTimings">Slice Timings (e.g. 10-20, 50-60)</label>
                  <input 
                    id="sliceTimings" 
                    type="text" 
                    name="sliceTimings" 
                    [(ngModel)]="sliceTimingsStr" 
                    placeholder="Comma separated intervals">
                </div>

                <div class="form-group">
                  <label for="loopCount">Loop Count</label>
                  <input 
                    id="loopCount" 
                    type="number" 
                    name="loopCount" 
                    [(ngModel)]="formData.loopCount" 
                    min="0" 
                    placeholder="Times to repeat slices">
                </div>
              </div>

              <div class="form-group col-12" style="margin-top: 12px;">
                <label for="tags">Tags (Comma separated)</label>
                <input 
                  id="tags" 
                  type="text" 
                  name="tags" 
                  [(ngModel)]="tagsStr" 
                  placeholder="focus, instrumental, chill">
              </div>
            </div>

            <!-- Tab Content: Casting & Metadata -->
            <div class="tab-content" *ngIf="activeTab === 'metadata'">
              <div class="form-row grid-2">
                <div class="form-group">
                  <label for="singerName">Singer Name</label>
                  <input id="singerName" type="text" name="singerName" [(ngModel)]="formData.singerName" placeholder="e.g. Sid Sriram">
                </div>

                <div class="form-group">
                  <label for="musicianName">Musician / Composer</label>
                  <input id="musicianName" type="text" name="musicianName" [(ngModel)]="formData.musicianName" placeholder="e.g. A.R. Rahman">
                </div>
              </div>

              <div class="form-row grid-2">
                <div class="form-group">
                  <label for="songType">Song Type</label>
                  <select id="songType" name="songType" [(ngModel)]="formData.songType">
                    <option value="">-- Select Type --</option>
                    <option *ngFor="let type of songTypes" [value]="type">{{ type }}</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="releaseYear">Release Year</label>
                  <input id="releaseYear" type="number" name="releaseYear" [(ngModel)]="formData.releaseYear" placeholder="e.g. 2022">
                </div>
              </div>

              <div class="form-row grid-2">
                <div class="form-group">
                  <label for="actor">Actor</label>
                  <input id="actor" type="text" name="actor" [(ngModel)]="formData.actor" placeholder="e.g. Vijay">
                </div>

                <div class="form-group">
                  <label for="actress">Actress</label>
                  <input id="actress" type="text" name="actress" [(ngModel)]="formData.actress" placeholder="e.g. Pooja Hegde">
                </div>
              </div>

              <div class="form-row grid-2">
                <div class="form-group">
                  <label for="movieName">Movie Name</label>
                  <input id="movieName" type="text" name="movieName" [(ngModel)]="formData.movieName" placeholder="e.g. Beast">
                </div>

                <div class="form-group">
                  <label for="directorName">Director Name</label>
                  <input id="directorName" type="text" name="directorName" [(ngModel)]="formData.directorName" placeholder="e.g. Nelson">
                </div>
              </div>

              <div class="form-group col-12" style="margin-top: 12px;">
                <label for="songWriter">Song Writer / Lyricist</label>
                <input id="songWriter" type="text" name="songWriter" [(ngModel)]="formData.songWriter" placeholder="e.g. Sivakarthikeyan">
              </div>

              <div class="form-group col-12" style="margin-top: 12px;">
                <label for="lyrics">Lyrics (LRC timestamps supported)</label>
                <textarea 
                  id="lyrics" 
                  name="lyrics" 
                  [(ngModel)]="formData.lyrics" 
                  rows="4" 
                  class="lyrics-text-area"
                  placeholder="Paste lyrics or synchronized [00:10] lyrics line-by-line here..."></textarea>
              </div>
            </div>

            <!-- Tab Content: Custom Fields -->
            <div class="tab-content" *ngIf="activeTab === 'custom'">
              <div class="custom-fields-wrapper" *ngIf="state.customFieldDefs.length > 0; else noCustomDefs">
                <div class="form-group" *ngFor="let def of state.customFieldDefs" style="margin-bottom: 12px;">
                  <label [for]="def.id">{{ def.label }}</label>
                  
                  <!-- Dropdown Input -->
                  <select 
                    *ngIf="def.type === 'dropdown'" 
                    [id]="def.id" 
                    [name]="def.id"
                    [(ngModel)]="customFieldsMap[def.id]">
                    <option value="">-- Select Option --</option>
                    <option *ngFor="let opt of def.dropdownOptions" [value]="opt">{{ opt }}</option>
                  </select>

                  <!-- Textbox Input -->
                  <input 
                    *ngIf="def.type === 'text'" 
                    [id]="def.id" 
                    [name]="def.id" 
                    type="text" 
                    [(ngModel)]="customFieldsMap[def.id]" 
                    placeholder="Enter value...">
                </div>
              </div>

              <ng-template #noCustomDefs>
                <div class="empty-custom-defs">
                  <p>No custom dynamic fields defined yet.</p>
                  <p class="small-info">Use the "Manage Custom Fields" dashboard in the navigation tree to create them.</p>
                </div>
              </ng-template>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="cancel.emit()">Cancel</button>
          <button 
            type="button" 
            class="btn btn-primary" 
            [disabled]="!videoForm.form.valid || !videoIdPreview" 
            (click)="save()">
            💾 Save Video
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2100;
      animation: fadeIn 0.2s ease-out;
    }

    .modal-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      width: 90%;
      max-width: 650px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .modal-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0,0,0,0.02);
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.2rem;
      color: var(--text-primary);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.25rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
    }
    .close-btn:hover {
      background: rgba(239,68,68,0.1);
      color: #ef4444;
    }

    .modal-body {
      padding: 1rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 1rem;
      gap: 4px;
    }

    .tab-btn {
      flex: 1;
      padding: 8px 0.5rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn:hover {
      color: var(--text-primary);
      background: rgba(0,0,0,0.02);
    }
    .tab-btn.active {
      color: var(--accent-primary);
      border-bottom-color: var(--accent-primary);
    }

    .tab-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: fadeIn 0.2s ease-out;
    }

    .form-row {
      display: flex;
      width: 100%;
      gap: 12px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .col-12 {
      width: 100%;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .form-group input, 
    .form-group select, 
    .form-group textarea {
      background: var(--bg-primary);
      border: 1px solid var(--border-color-strong);
      color: var(--text-primary);
      padding: 8px;
      border-radius: var(--radius-sm);
      outline: none;
      font-size: 0.88rem;
      transition: border-color 0.2s;
    }
    .form-group input:focus, 
    .form-group select:focus, 
    .form-group textarea:focus {
      border-color: var(--accent-primary);
    }

    .required {
      color: #ef4444;
      margin-left: 2px;
    }

    .select-with-add {
      display: flex;
      gap: 4px;
    }
    .select-with-add select {
      flex: 1;
    }
    .btn-icon-add {
      background: var(--bg-primary);
      border: 1px solid var(--border-color-strong);
      border-radius: var(--radius-sm);
      cursor: pointer;
      padding: 0 8px;
    }
    .btn-icon-add:hover {
      background: var(--accent-surface);
      border-color: var(--accent-primary);
    }

    .lyrics-text-area {
      font-family: inherit;
      resize: vertical;
      line-height: 1.5;
    }

    .preview-box {
      display: flex;
      gap: 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 0.5rem;
      align-items: center;
    }
    .preview-box img {
      width: 120px;
      height: 68px;
      object-fit: cover;
      border-radius: var(--radius-sm);
    }
    .preview-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .preview-id {
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .empty-custom-defs {
      padding: 2rem;
      text-align: center;
      color: var(--text-tertiary);
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-md);
    }
    .small-info {
      font-size: 0.75rem;
      margin-top: 4px;
    }

    .modal-footer {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      background: rgba(0,0,0,0.02);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class VideoFormComponent implements OnInit {
  state = inject(YouTubeStateService);

  @Input() videoToEdit: YouTubeVideoData | null = null;
  @Output() saveVideo = new EventEmitter<YouTubeVideoData>();
  @Output() cancel = new EventEmitter<void>();

  isEdit = false;
  activeTab: 'basic' | 'metadata' | 'custom' = 'basic';

  formData: YouTubeVideoData = this.getEmptyForm();
  sliceTimingsStr = '';
  tagsStr = '';
  customFieldsMap: { [fieldId: string]: string } = {};

  videoIdPreview = '';

  songTypes = [
    'Melody',
    'Sad',
    'Love',
    'Motivational',
    'Energetic',
    'Devotional',
    'Classical',
    'Romantic',
    'Folk',
    'Item',
    'Peppy'
  ];

  ngOnInit() {
    if (this.videoToEdit) {
      this.isEdit = true;
      this.formData = { ...this.videoToEdit };
      
      // format slice timings back to string
      if (this.formData.sliceTimings) {
        this.sliceTimingsStr = this.formData.sliceTimings.map(s => `${s.start}-${s.end}`).join(', ');
      }
      
      // format tags back to string
      if (this.formData.tags) {
        this.tagsStr = this.formData.tags.join(', ');
      }

      // Populate custom fields map
      this.formData.customFields?.forEach(cf => {
        this.customFieldsMap[cf.fieldId] = cf.value;
      });

      this.onUrlChange();
    } else {
      this.isEdit = false;
      this.formData = this.getEmptyForm();
    }
  }

  private getEmptyForm(): YouTubeVideoData {
    return {
      id: '',
      videoName: '',
      youtubeUrl: '',
      youtubeVideoId: '',
      category: this.state.categories[0] || 'Uncategorized',
      subcategory: '',
      tags: [],
      lyrics: '',
      sliceTimings: [],
      loopCount: 0,
      songName: '',
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
  }

  onUrlChange() {
    if (this.formData.youtubeUrl) {
      this.videoIdPreview = this.extractId(this.formData.youtubeUrl);
    } else {
      this.videoIdPreview = '';
    }
  }

  promptAddCategory() {
    const cat = prompt('Enter new category name:');
    if (cat && cat.trim()) {
      this.state.addCategory(cat);
      this.formData.category = cat.trim();
    }
  }

  save() {
    this.formData.youtubeVideoId = this.videoIdPreview;
    
    // Parse tags
    this.formData.tags = this.tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Parse slice timings
    this.formData.sliceTimings = [];
    if (this.sliceTimingsStr.trim()) {
      const parts = this.sliceTimingsStr.split(',').map(p => p.trim());
      for (const p of parts) {
        if (p.includes('-')) {
          const timing = p.split('-');
          const start = parseFloat(timing[0]);
          const end = parseFloat(timing[1]);
          if (!isNaN(start) && !isNaN(end) && start < end) {
            this.formData.sliceTimings.push({ start, end });
          }
        }
      }
    }

    // Map custom fields
    this.formData.customFields = Object.keys(this.customFieldsMap)
      .map(key => ({ fieldId: key, value: this.customFieldsMap[key] }))
      .filter(cf => cf.value !== '');

    this.saveVideo.emit(this.formData);
  }

  private extractId(url: string): string {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  }
}
