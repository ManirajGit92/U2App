import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YouTubeStateService } from '../services/yt-state.service';
import { YouTubeVideoData } from '../models/youtube.models';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-container">
      <div class="table-header">
        <h2>Database Overview</h2>
        <span class="record-cnt">Total Records: {{ videos.length }}</span>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Video Name</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Tags</th>
              <th>Loop</th>
              <th>Slices</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let vid of videos">
              <td class="id-col">{{ vid.id }}</td>
              <td class="name-col"><a [href]="vid.youtubeUrl" target="_blank">{{ vid.videoName }}</a></td>
              <td><span class="cat-pill">{{ vid.category }}</span></td>
              <td>{{ vid.subcategory }}</td>
              <td>
                <div class="tag-list">
                  <span class="min-tag" *ngFor="let t of vid.tags">{{ t }}</span>
                </div>
              </td>
              <td>{{ vid.loopCount }}</td>
              <td>{{ vid.sliceTimings.length }} defined</td>
            </tr>
            <tr *ngIf="videos.length === 0">
              <td colspan="7" class="empty-state">No videos systematically loaded into the database yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .table-container { display: flex; flex-direction: column; height: 100%; border-radius: var(--radius-md); overflow: hidden; background: var(--surface-card); border: 1px solid var(--border-color); }
    .table-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.02); }
    .table-header h2 { margin: 0; font-size: 1.1rem; color: var(--text-primary); }
    .record-cnt { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
    
    .table-responsive { flex: 1; overflow: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
    th, td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    th { position: sticky; top: 0; background: var(--surface-card); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; z-index: 10; border-bottom: 2px solid var(--border-color); }
    
    tbody tr:hover { background: rgba(255,255,255,0.03); }
    
    .id-col { font-family: monospace; color: var(--text-tertiary); font-size: 0.75rem; }
    .name-col a { color: var(--accent-primary); text-decoration: none; font-weight: 500; }
    .name-col a:hover { text-decoration: underline; }
    
    .cat-pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 0.7rem; background: rgba(52,211,153,0.15); color: #10b981; }
    
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .min-tag { background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; color: var(--text-secondary); }
    
    .empty-state { text-align: center; color: var(--text-tertiary); padding: 32px !important; }
  `]
})
export class DataTableComponent implements OnInit, OnDestroy {
  videos: YouTubeVideoData[] = [];
  private destroy$ = new Subject<void>();

  constructor(private state: YouTubeStateService) {}

  ngOnInit() {
    this.state.videos$.pipe(takeUntil(this.destroy$)).subscribe((vids: YouTubeVideoData[]) => {
      this.videos = vids;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
