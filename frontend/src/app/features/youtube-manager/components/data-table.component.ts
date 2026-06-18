import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
        <div class="header-left">
          <h2>Excel Database Registry</h2>
          <span class="record-cnt">Total Entries: {{ videos.length }}</span>
        </div>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Song / Video Name</th>
              <th>Movie</th>
              <th>Category</th>
              <th>Singer / Composer</th>
              <th>Song Type</th>
              <th>Casting</th>
              <th>Release</th>
              <th>Bookmarks</th>
              <th>Slices</th>
              <th *ngFor="let def of state.customFieldDefs">{{ def.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let vid of videos" (click)="playVideo(vid)" class="clickable-row">
              <td class="name-col">
                <div class="song-meta">
                  <span class="song-title">{{ vid.songName || vid.videoName }}</span>
                  <a [href]="vid.youtubeUrl" target="_blank" (click)="$event.stopPropagation()" class="yt-link">🎬 Link</a>
                </div>
              </td>
              <td>{{ vid.movieName || 'N/A' }}</td>
              <td>
                <span class="cat-pill">{{ vid.category }}</span>
                <span class="subcat-label" *ngIf="vid.subcategory">{{ vid.subcategory }}</span>
              </td>
              <td>
                <div class="artist-block">
                  <span class="main-artist" *ngIf="vid.singerName">🎙️ {{ vid.singerName }}</span>
                  <span class="sub-artist" *ngIf="vid.musicianName">🎵 {{ vid.musicianName }}</span>
                </div>
              </td>
              <td>
                <span class="type-pill" *ngIf="vid.songType">{{ vid.songType }}</span>
              </td>
              <td class="casting-col">
                <span *ngIf="vid.actor">Actor: {{ vid.actor }}</span>
                <span *ngIf="vid.actress">Actress: {{ vid.actress }}</span>
              </td>
              <td>{{ vid.releaseYear || 'N/A' }}</td>
              <td>
                <span class="badge badge-bookmark" *ngIf="vid.bookmarks && vid.bookmarks.length > 0">
                  🔖 {{ vid.bookmarks.length }}
                </span>
              </td>
              <td>
                <span class="badge badge-slice" *ngIf="vid.sliceTimings.length > 0">
                  ✂️ {{ vid.sliceTimings.length }}
                </span>
              </td>
              <!-- Render dynamic custom field columns -->
              <td *ngFor="let def of state.customFieldDefs">
                {{ getCustomFieldValue(vid, def.id) }}
              </td>
            </tr>
            <tr *ngIf="videos.length === 0">
              <td [attr.colspan]="9 + state.customFieldDefs.length" class="empty-state">
                No videos systematically loaded into the database yet. Use "Upload Data" template!
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .table-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      background: rgba(0,0,0,0.02);
    }
    .header-left h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .record-cnt {
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    
    .table-responsive {
      flex: 1;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.82rem;
    }
    th, td {
      padding: 0.75rem 0.75rem;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
      vertical-align: middle;
    }
    th {
      position: sticky;
      top: 0;
      background: var(--bg-secondary);
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      font-size: 0.72rem;
      letter-spacing: 0.05em;
      z-index: 10;
      border-bottom: 2px solid var(--border-color);
    }
    
    .clickable-row {
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .clickable-row:hover {
      background: var(--bg-primary);
    }
    
    .name-col {
      font-weight: 600;
    }
    .song-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .song-title {
      color: var(--text-primary);
      font-size: 0.85rem;
    }
    .yt-link {
      font-size: 0.72rem;
      color: var(--accent-primary);
      text-decoration: none;
      width: fit-content;
    }
    .yt-link:hover {
      text-decoration: underline;
    }
    
    .cat-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.68rem;
      background: rgba(99, 102, 241, 0.12);
      color: var(--accent-primary);
    }
    .subcat-label {
      display: block;
      font-size: 0.7rem;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    
    .artist-block {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .main-artist {
      font-weight: 500;
      color: var(--text-primary);
    }
    .sub-artist {
      font-size: 0.72rem;
      color: var(--text-secondary);
    }
    
    .type-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
      font-size: 0.68rem;
      font-weight: 600;
    }

    .casting-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.74rem;
      color: var(--text-secondary);
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .badge-bookmark {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning);
    }
    .badge-slice {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
    }
    
    .empty-state {
      text-align: center;
      color: var(--text-tertiary);
      padding: 1.5rem !important;
    }
  `]
})
export class DataTableComponent implements OnInit, OnDestroy {
  state = inject(YouTubeStateService);

  videos: YouTubeVideoData[] = [];
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.state.videos$
      .pipe(takeUntil(this.destroy$))
      .subscribe((vids: YouTubeVideoData[]) => {
        this.videos = vids;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  playVideo(video: YouTubeVideoData) {
    this.state.setCurrentVideo(video);
  }

  getCustomFieldValue(vid: YouTubeVideoData, fieldId: string): string {
    const val = vid.customFields?.find(cf => cf.fieldId === fieldId);
    return val ? val.value : '—';
  }
}
