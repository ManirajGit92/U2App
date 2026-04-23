import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeExcelService } from '../services/yt-excel.service';
import { YouTubeVideoData } from '../models/youtube.models';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-navigation-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="nav-tree-container">
      <div class="tree-controls">
        <button class="btn btn-sm btn-secondary" (click)="downloadTemplate()">📥 Template</button>
        <button class="btn btn-sm btn-primary" (click)="fileInput.click()">📤 Upload Data</button>
        <input type="file" #fileInput [hidden]="true" accept=".xlsx, .xls" (change)="onUpload($event)">
      </div>

      <div class="filter-section">
        <label>Filter by Tags</label>
        <div class="tags-container" *ngIf="allAvailableTags.length > 0">
          <button 
            *ngFor="let tag of allAvailableTags" 
            class="tag-pill" 
            [class.selected]="selectedTags.includes(tag)" 
            (click)="toggleTag(tag)">
            {{ tag }}
          </button>
        </div>
        <p class="helper-text" *ngIf="allAvailableTags.length === 0">No tags available.</p>
        <button class="btn btn-text" *ngIf="selectedTags.length > 0" (click)="clearTags()" style="margin-top: 4px; text-align: left;">Clear Filters</button>
      </div>

      <div class="tree-view">
        <div class="tree-actions">
          <button class="btn btn-text" (click)="setAllExpanded(true)">Expand All</button>
          <button class="btn btn-text" (click)="setAllExpanded(false)">Collapse All</button>
        </div>

        <!-- Tree Rendering -->
        <ul class="tree-list">
          <li *ngFor="let cat of treeData | keyvalue">
            <div class="tree-item category" (click)="toggleNode(cat.key)">
              <span class="tree-icon">{{ expandedNodes[cat.key] ? '📂' : '📁' }}</span>
              <span class="tree-label">{{ cat.key }}</span>
            </div>
            
            <ul class="tree-list sub" *ngIf="expandedNodes[cat.key]">
              <li *ngFor="let sub of cat.value | keyvalue">
                <div class="tree-item subcategory" (click)="toggleNode(cat.key + '_' + sub.key)">
                  <span class="tree-icon">{{ expandedNodes[cat.key + '_' + sub.key] ? '📂' : '📁' }}</span>
                  <span class="tree-label">{{ sub.key }}</span>
                </div>

                <ul class="tree-list video" *ngIf="expandedNodes[cat.key + '_' + sub.key]">
                  <li *ngFor="let vid of sub.value">
                    <div class="tree-item video-item" 
                         [class.active]="currentVideoId === vid.id"
                         (click)="playVideo(vid)">
                      <span class="tree-icon text-primary">▶</span>
                      <span class="tree-label">{{ vid.videoName }} 
                        <span class="badge" *ngIf="vid.sliceTimings.length">{{ vid.sliceTimings.length }} Slice(s)</span>
                      </span>
                    </div>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
          
          <li *ngIf="(treeData | keyvalue).length === 0">
            <p class="empty-state">No videos found. Upload data first!</p>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .nav-tree-container { display: flex; flex-direction: column; gap: 16px; height: 100%; }
    .tree-controls { display: flex; gap: 8px; justify-content: space-between; }
    .btn-sm { flex: 1; padding: 6px 10px; font-size: 0.85rem; }
    .btn-text { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.8rem; padding: 0; }
    .btn-text:hover { color: var(--accent-primary); text-decoration: underline; }
    
    .filter-section { display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; }
    .filter-section label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; display: block; }
    
    .tags-container { display: flex; flex-wrap: wrap; gap: 6px; max-height: 120px; overflow-y: auto; padding-right: 4px; }
    .tag-pill { 
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary);
      border-radius: 12px; padding: 4px 10px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;
    }
    .tag-pill:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
    .tag-pill.selected { 
      background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.2));
      border-color: rgba(239,68,68,0.4); color: #fff; font-weight: 600;
    }

    .tree-view { flex: 1; overflow-y: auto; padding-right: 8px; }
    .tree-actions { display: flex; justify-content: space-between; margin-bottom: 12px; }
    
    .tree-list { list-style: none; padding-left: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .tree-list.sub { padding-left: 16px; margin-top: 4px; border-left: 1px dashed var(--border-color); }
    .tree-list.video { padding-left: 20px; margin-top: 2px; }
    
    .tree-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.2s; user-select: none; }
    .tree-item:hover { background: rgba(0,0,0,0.03); }
    .tree-item.active { background: rgba(var(--accent-primary-rgb), 0.1); font-weight: 600; }
    
    .tree-icon { font-size: 1rem; width: 20px; text-align: center; }
    .tree-label { font-size: 0.9rem; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .category .tree-label { font-weight: 700; color: var(--text-primary); }
    .subcategory .tree-label { font-weight: 500; color: var(--text-secondary); }
    .video-item .tree-label { font-size: 0.85rem; }
    
    .text-primary { color: var(--accent-primary); }
    .badge { background: var(--accent-primary); color: #fff; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 4px; font-weight: 500;}
    
    .empty-state { color: var(--text-tertiary); font-size: 0.85rem; text-align: center; padding: 24px 0; }
  `]
})
export class NavigationTreeComponent implements OnInit, OnDestroy {
  videos: YouTubeVideoData[] = [];
  allAvailableTags: string[] = [];
  selectedTags: string[] = [];

  // Map<Category, Map<Subcategory, Video[]>>
  treeData = new Map<string, Map<string, YouTubeVideoData[]>>();
  expandedNodes: { [key: string]: boolean } = {};
  currentVideoId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private state: YouTubeStateService,
    private excelServ: YouTubeExcelService
  ) {}

  ngOnInit() {
    this.state.videos$.pipe(takeUntil(this.destroy$)).subscribe((vids: YouTubeVideoData[]) => {
      this.videos = vids;
      this.extractAllTags();
      this.rebuildTree();
    });

    this.state.currentVideo$.pipe(takeUntil(this.destroy$)).subscribe((v: YouTubeVideoData | null) => {
      this.currentVideoId = v ? v.id : null;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  downloadTemplate() {
    this.excelServ.generateTemplate();
  }

  async onUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = await this.excelServ.parseExcelFile(file);
      this.state.initializeVideos(data);
      alert('YouTube data loaded successfully!');
    } catch (e: any) {
      alert(e);
    }
  }

  toggleTag(tag: string) {
    const idx = this.selectedTags.indexOf(tag);
    if (idx === -1) {
      this.selectedTags.push(tag);
    } else {
      this.selectedTags.splice(idx, 1);
    }
    this.state.setTags(this.selectedTags);
    this.rebuildTree();
  }

  clearTags() {
    this.selectedTags = [];
    this.state.setTags(this.selectedTags);
    this.rebuildTree();
  }

  toggleNode(pathKey: string) {
    this.expandedNodes[pathKey] = !this.expandedNodes[pathKey];
  }

  setAllExpanded(state: boolean) {
    this.treeData.forEach((subMap, catKey) => {
      this.expandedNodes[catKey] = state;
      subMap.forEach((_, subKey) => {
        this.expandedNodes[catKey + '_' + subKey] = state;
      });
    });
  }

  playVideo(video: YouTubeVideoData) {
    this.state.setCurrentVideo(video);
  }

  private extractAllTags() {
    const tagSet = new Set<string>();
    this.videos.forEach(v => v.tags.forEach((t: string) => tagSet.add(t)));
    this.allAvailableTags = Array.from(tagSet).sort();
  }

  private rebuildTree() {
    this.treeData.clear();
    
    // Filter videos by tag
    let filtered = this.videos;
    if (this.selectedTags.length > 0) {
      filtered = this.videos.filter(v => 
        // Must contain AT LEAST ONE of the selected tags (OR filtering)
        // Adjust to `every` if AND filtering is desired.
        this.selectedTags.some(t => v.tags.includes(t))
      );
    }

    filtered.forEach(v => {
      if (!this.treeData.has(v.category)) {
        this.treeData.set(v.category, new Map<string, YouTubeVideoData[]>());
      }
      const subMap = this.treeData.get(v.category)!;
      
      if (!subMap.has(v.subcategory)) {
        subMap.set(v.subcategory, []);
      }
      subMap.get(v.subcategory)!.push(v);
    });

    // Auto-expand all if tree rebuilt (or maintain state)
    if (Object.keys(this.expandedNodes).length === 0) {
      this.setAllExpanded(true);
    }
  }
}
