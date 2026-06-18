import { Component, EventEmitter, OnInit, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeExcelService } from '../services/yt-excel.service';
import { YouTubeFirebaseService } from '../services/yt-firebase.service';
import { YouTubeVideoData } from '../models/youtube.models';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-navigation-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="nav-tree-container">
      <!-- Actions Bar -->
      <div class="actions-group">
        <button class="btn btn-sm btn-primary" (click)="openAddForm.emit()">
          ➕ Add Video
        </button>
        <button class="btn btn-sm btn-secondary" (click)="openCustomFields.emit()">
          ⚙️ Custom Fields
        </button>
      </div>

      <!-- Cloud Sync (Firebase) Status -->
      <div class="cloud-sync-status" *ngIf="firebase.isLoggedIn()">
        <div class="cloud-status-info">
          <span class="pulse-green">●</span>
          <span>Synced with Cloud</span>
        </div>
        <div class="sync-actions">
          <button class="btn-text-sm" (click)="manualSync()" [disabled]="isSyncing">
            {{ isSyncing ? 'Syncing...' : '🔄 Sync Now' }}
          </button>
          <label class="toggle-container-sm">
            <input type="checkbox" [ngModel]="firebase.getAutoSyncEnabled()" (ngModelChange)="toggleAutoSync($event)">
            <span class="slider-sm"></span>
            Auto
          </label>
        </div>
      </div>

      <!-- Filters & Sort -->
      <div class="filter-panel">
        <h3>Library Filters</h3>
        
        <!-- Filter Flow Step 1: Category Selection -->
        <div class="filter-group">
          <label>Filter Category</label>
          <select [ngModel]="state.filterCategory" (ngModelChange)="onFilterCategoryChange($event)">
            <option value="">-- No Filter --</option>
            <option value="category">Category</option>
            <option value="subcategory">Subcategory</option>
            <option value="songType">Song Type</option>
            <option value="singerName">Singer Name</option>
            <option value="musicianName">Musician / Composer</option>
            <option value="actor">Actor</option>
            <option value="actress">Actress</option>
            <option value="movieName">Movie Name</option>
            <option value="songWriter">Lyricist</option>
            <option value="releaseYear">Release Year</option>
            <option value="tags">Tags</option>
            
            <!-- Custom Dynamic Field categories -->
            <optgroup label="Custom Fields" *ngIf="state.customFieldDefs.length > 0">
              <option *ngFor="let def of state.customFieldDefs" [value]="def.id">
                {{ def.label }}
              </option>
            </optgroup>
          </select>
        </div>

        <!-- Filter Flow Step 2: Custom Checklist Dropdown -->
        <div class="filter-group" *ngIf="state.filterCategory">
          <label>Filter Values</label>
          <div class="custom-dropdown-container">
            <button class="dropdown-toggle-btn" (click)="toggleChecklistDropdown($event)">
              {{ getChecklistButtonLabel() }}
              <span class="arrow">{{ showChecklistDropdown ? '▲' : '▼' }}</span>
            </button>
            
            <div class="checklist-dropdown-menu" *ngIf="showChecklistDropdown" (click)="$event.stopPropagation()">
              <div class="checklist-header">
                <button class="btn-text" (click)="selectAllFilterValues()">Select All</button>
                <button class="btn-text" (click)="clearFilterValues()">Clear All</button>
              </div>
              <div class="checklist-items">
                <label class="checklist-item" *ngFor="let val of availableFilterValues">
                  <input 
                    type="checkbox" 
                    [checked]="state.filterSelectedValues.includes(val)" 
                    (change)="toggleFilterValue(val)">
                  <span>{{ val }}</span>
                </label>
                <p class="no-options" *ngIf="availableFilterValues.length === 0">
                  No filter values found.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Sort Option Dropdown -->
        <div class="filter-group">
          <label>Sort Order</label>
          <select [ngModel]="state.sortOrder" (ngModelChange)="state.setSortOrder($event)">
            <option value="songName-asc">Song Name (A–Z)</option>
            <option value="songName-desc">Song Name (Z–A)</option>
            <option value="random">Random Order</option>
          </select>
        </div>

        <!-- Toggle Bottom Player Bar Control -->
        <div class="playerbar-toggle-row">
          <label class="switch">
            <input type="checkbox" [ngModel]="state.showPlayerBar" (ngModelChange)="state.setShowPlayerBar($event)">
            <span class="slider round"></span>
          </label>
          <span class="toggle-label">Show Playback Control Bar</span>
        </div>
      </div>

      <!-- Videos Library List -->
      <div class="video-list-section">
        <div class="section-title">
          <h3>Videos ({{ filteredVideos.length }})</h3>
          <button class="btn-text" *ngIf="state.filterCategory" (click)="clearAllFilters()">Clear Filters</button>
        </div>

        <div class="scrollable-list">
          <div 
            class="video-card-item" 
            *ngFor="let vid of filteredVideos"
            [class.active]="currentVideoId === vid.id"
            (click)="playVideo(vid)">
            
            <!-- Video Thumbnail -->
            <img 
              [src]="'https://img.youtube.com/vi/' + vid.youtubeVideoId + '/default.jpg'" 
              alt="Thumbnail" 
              class="video-thumb">

            <div class="video-meta">
              <span class="video-title">{{ vid.songName || vid.videoName }}</span>
              <span class="video-subtitle">
                {{ vid.singerName || vid.category }} {{ vid.releaseYear ? '('+vid.releaseYear+')' : '' }}
              </span>
            </div>

            <!-- Context Actions -->
            <div class="video-item-actions" (click)="$event.stopPropagation()">
              <button class="action-btn" (click)="openEditForm.emit(vid)" title="Edit entry">✏️</button>
              <button class="action-btn delete-btn" (click)="deleteVideo(vid.id)" title="Delete entry">🗑️</button>
            </div>
          </div>

          <div class="empty-state" *ngIf="filteredVideos.length === 0">
            No matching videos in library.
          </div>
        </div>
      </div>

      <!-- Excel Import/Export at bottom -->
      <div class="excel-controls">
        <button class="btn btn-secondary btn-sm" (click)="downloadTemplate()">📥 Template</button>
        <button class="btn btn-secondary btn-sm" (click)="fileInput.click()">📤 Import</button>
        <button class="btn btn-primary btn-sm" (click)="exportToExcel()">📥 Export</button>
        <input type="file" #fileInput [hidden]="true" accept=".xlsx, .xls" (change)="onUpload($event)">
      </div>
    </div>
  `,
  styles: [`
    .nav-tree-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0.75rem;
      gap: 12px;
      overflow: hidden;
      background: var(--surface-card);
    }

    .actions-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .cloud-sync-status {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid rgba(16, 185, 129, 0.15);
      padding: 6px 0.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
    }
    .cloud-status-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: var(--success);
    }
    .pulse-green {
      animation: pulseGreen 2s infinite;
    }
    @keyframes pulseGreen {
      0% { opacity: 0.3; }
      50% { opacity: 1; }
      100% { opacity: 0.3; }
    }
    .sync-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-text-sm {
      background: none;
      border: none;
      color: var(--accent-primary);
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .btn-text-sm:disabled {
      opacity: 0.5;
    }

    .toggle-container-sm {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
    }

    .filter-panel {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .filter-panel h3 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-tertiary);
      margin: 0;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-group label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .filter-group select {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color-strong);
      color: var(--text-primary);
      padding: 6px;
      border-radius: var(--radius-sm);
      outline: none;
      font-size: 0.8rem;
    }

    /* Custom Checklist Dropdown styling */
    .custom-dropdown-container {
      position: relative;
      width: 100%;
    }
    .dropdown-toggle-btn {
      width: 100%;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color-strong);
      color: var(--text-primary);
      padding: 6px;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      text-align: left;
    }
    .checklist-dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color-strong);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
      z-index: 1000;
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      max-height: 180px;
    }
    .checklist-header {
      display: flex;
      justify-content: space-between;
      padding: 4px 0.5rem;
      border-bottom: 1px solid var(--border-color);
      background: rgba(0,0,0,0.02);
    }
    .checklist-header .btn-text {
      font-size: 0.7rem;
      color: var(--accent-primary);
      cursor: pointer;
      border: none;
      background: none;
    }
    .checklist-items {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 4px;
    }
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      font-size: 0.78rem;
      cursor: pointer;
      border-radius: 4px;
      color: var(--text-primary);
    }
    .checklist-item:hover {
      background: var(--bg-primary);
    }
    .no-options {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-tertiary);
      padding: 0.5rem 0;
      margin: 0;
    }

    /* Bottom player bar toggle switch styling */
    .playerbar-toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      border-top: 1px solid var(--border-color);
      padding-top: 6px;
    }
    .toggle-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 32px;
      height: 18px;
    }
    .switch input { 
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--border-color-strong);
      transition: .4s;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 12px;
      width: 12px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
    }
    input:checked + .slider {
      background-color: var(--accent-primary);
    }
    input:checked + .slider:before {
      transform: translateX(14px);
    }
    .slider.round {
      border-radius: 34px;
    }
    .slider.round:before {
      border-radius: 50%;
    }

    .video-list-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .section-title h3 {
      font-size: 0.85rem;
      color: var(--text-primary);
      margin: 0;
    }
    .section-title .btn-text {
      font-size: 0.75rem;
      color: #ef4444;
      background: none;
      border: none;
      cursor: pointer;
    }

    .scrollable-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-right: 4px;
    }

    .video-card-item {
      display: flex;
      gap: 8px;
      padding: 6px;
      border-radius: var(--radius-md);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      cursor: pointer;
      align-items: center;
      position: relative;
      transition: all 0.2s;
    }
    .video-card-item:hover {
      background: var(--bg-secondary);
      border-color: var(--border-color-strong);
      transform: translateY(-1px);
    }
    .video-card-item.active {
      background: var(--accent-surface);
      border-color: var(--accent-primary);
    }

    .video-thumb {
      width: 50px;
      height: 38px;
      object-fit: cover;
      border-radius: 4px;
      background: #000;
    }

    .video-meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .video-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .video-subtitle {
      font-size: 0.7rem;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Actions on Hover */
    .video-item-actions {
      display: none;
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 2px;
      box-shadow: var(--shadow-sm);
      gap: 2px;
    }
    .video-card-item:hover .video-item-actions {
      display: flex;
    }
    .action-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      font-size: 0.75rem;
      border-radius: 4px;
    }
    .action-btn:hover {
      background: var(--bg-primary);
    }
    .delete-btn:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    .excel-controls {
      display: flex;
      gap: 4px;
      border-top: 1px solid var(--border-color);
      padding-top: 8px;
    }
    .excel-controls button {
      flex: 1;
      font-size: 0.75rem;
      padding: 6px 0;
    }

    /* Mobile / Small settings toggle */
    .toggle-container-sm input {
      display: none;
    }
    .slider-sm {
      width: 20px;
      height: 10px;
      background: var(--border-color-strong);
      border-radius: 10px;
      position: relative;
      display: inline-block;
      transition: 0.3s;
    }
    .slider-sm:before {
      content: '';
      width: 8px;
      height: 8px;
      background: #fff;
      border-radius: 50%;
      position: absolute;
      left: 1px;
      top: 1px;
      transition: 0.3s;
    }
    input:checked + .slider-sm {
      background: var(--success);
    }
    input:checked + .slider-sm:before {
      transform: translateX(10px);
    }

    .empty-state {
      text-align: center;
      color: var(--text-tertiary);
      font-size: 0.8rem;
      padding: 1.5rem 0;
    }
  `]
})
export class NavigationTreeComponent implements OnInit, OnDestroy {
  state = inject(YouTubeStateService);
  excel = inject(YouTubeExcelService);
  firebase = inject(YouTubeFirebaseService);

  @Output() openAddForm = new EventEmitter<void>();
  @Output() openEditForm = new EventEmitter<YouTubeVideoData>();
  @Output() openCustomFields = new EventEmitter<void>();

  filteredVideos: YouTubeVideoData[] = [];
  availableFilterValues: string[] = [];
  
  showChecklistDropdown = false;
  currentVideoId: string | null = null;
  isSyncing = false;

  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Listen to the state's filtered and sorted list
    this.state.getFilteredAndSortedVideos$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(vids => {
        this.filteredVideos = vids;
      });

    // Listen to changes in the active video to highlight it
    this.state.currentVideo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(v => {
        this.currentVideoId = v ? v.id : null;
      });

    // Re-populate checklist options when category filter changes
    this.state.filterCategory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.availableFilterValues = this.state.getAvailableFilterValues();
      });

    // Re-populate check list values when the total video array updates
    this.state.videos$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.availableFilterValues = this.state.getAvailableFilterValues();
      });

    // Close dropdown on document click
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.onDocumentClick.bind(this));
  }

  onFilterCategoryChange(cat: string) {
    this.state.setFilterCategory(cat);
    this.showChecklistDropdown = false;
  }

  toggleChecklistDropdown(event: Event) {
    event.stopPropagation();
    this.showChecklistDropdown = !this.showChecklistDropdown;
  }

  onDocumentClick() {
    this.showChecklistDropdown = false;
  }

  getChecklistButtonLabel(): string {
    const selected = this.state.filterSelectedValues;
    if (selected.length === 0) return 'All Values';
    if (selected.length === 1) return selected[0];
    return `Selected: ${selected.length}`;
  }

  toggleFilterValue(val: string) {
    const selected = [...this.state.filterSelectedValues];
    const idx = selected.indexOf(val);
    if (idx === -1) {
      selected.push(val);
    } else {
      selected.splice(idx, 1);
    }
    this.state.setFilterSelectedValues(selected);
  }

  selectAllFilterValues() {
    this.state.setFilterSelectedValues([...this.availableFilterValues]);
  }

  clearFilterValues() {
    this.state.setFilterSelectedValues([]);
  }

  clearAllFilters() {
    this.state.setFilterCategory('');
  }

  playVideo(video: YouTubeVideoData) {
    this.state.setCurrentVideo(video);
  }

  deleteVideo(id: string) {
    if (confirm('Are you sure you want to delete this video entry?')) {
      this.state.deleteVideo(id);
    }
  }

  manualSync() {
    this.isSyncing = true;
    this.firebase.syncToCloud()
      .then(() => alert('Successfully synced all library data to Cloud!'))
      .catch(err => alert('Sync failed: ' + err))
      .finally(() => this.isSyncing = false);
  }

  toggleAutoSync(enabled: boolean) {
    this.firebase.setAutoSyncEnabled(enabled);
  }

  downloadTemplate() {
    this.excel.generateTemplate();
  }

  async onUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const parsed = await this.excel.parseExcelFile(file);
      this.state.initializeVideos(parsed);
      alert(`Imported ${parsed.length} videos from Excel successfully!`);
    } catch (e: any) {
      alert(e);
    }
  }

  exportToExcel() {
    this.excel.exportData(this.state.videos);
  }
}
