import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationTreeComponent } from './components/navigation-tree.component';
import { VideoPlayerComponent } from './components/video-player.component';
import { LyricsPanelComponent } from './components/lyrics-panel.component';
import { DataTableComponent } from './components/data-table.component';

@Component({
  selector: 'app-youtube-manager',
  standalone: true,
  imports: [CommonModule, NavigationTreeComponent, VideoPlayerComponent, LyricsPanelComponent, DataTableComponent],
  template: `
    <div class="yt-manager-layout">
      <!-- Left Panel: Tree & Filters -->
      <aside class="panel left-panel" [class.collapsed]="!leftExpanded">
        <div class="panel-header">
          <h2 *ngIf="leftExpanded">Library</h2>
          <button class="toggle-btn" (click)="leftExpanded = !leftExpanded">
            {{ leftExpanded ? '◀' : '▶' }}
          </button>
        </div>
        <div class="panel-content p-0" *ngIf="leftExpanded">
          <app-navigation-tree></app-navigation-tree>
        </div>
      </aside>

      <!-- Center Panel: YouTube Player or Database -->
      <main class="panel center-panel">
        <div class="view-toggle-bar">
          <button class="view-btn" [class.active]="currentView === 'player'" (click)="currentView = 'player'">🎬 Player View</button>
          <button class="view-btn" [class.active]="currentView === 'db'" (click)="currentView = 'db'">📋 Excel Database View</button>
        </div>
        
        <div class="view-content">
          <div class="player-wrapper-container" [hidden]="currentView !== 'player'">
            <app-video-player></app-video-player>
          </div>
          <div class="db-wrapper" *ngIf="currentView === 'db'">
             <app-data-table></app-data-table>
          </div>
        </div>
      </main>

      <!-- Right Panel: Lyrics -->
      <aside class="panel right-panel" [class.collapsed]="!rightExpanded">
        <div class="panel-header">
          <button class="toggle-btn" (click)="rightExpanded = !rightExpanded">
            {{ rightExpanded ? '▶' : '◀' }}
          </button>
          <h2 *ngIf="rightExpanded" style="margin-left: 8px;">Details & Lyrics</h2>
        </div>
        <div class="panel-content p-0" *ngIf="rightExpanded">
          <app-lyrics-panel></app-lyrics-panel>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .yt-manager-layout {
      display: flex;
      height: calc(100vh - 60px); 
      background: var(--bg-primary);
      overflow: hidden;
    }
    .panel {
      display: flex;
      flex-direction: column;
      transition: width 0.3s ease;
      position: relative;
    }
    .left-panel {
      width: 300px;
      border-right: 1px solid var(--border-color);
      background: var(--surface-card);
    }
    .left-panel.collapsed { width: 50px; }
    
    .right-panel {
      width: 350px;
      border-left: 1px solid var(--border-color);
      background: var(--surface-card);
    }
    .right-panel.collapsed { width: 50px; }
    
    .center-panel {
      flex: 1;
      background: #000; /* Black for theater feel */
      min-width: 300px;
      display: flex;
      flex-direction: column;
    }
    .view-toggle-bar { display: flex; justify-content: center; gap: 8px; padding: 12px; background: #0a0a0a; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .view-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #aaa; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
    .view-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .view-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); color: #fff; font-weight: 600; box-shadow: 0 0 12px rgba(239,68,68,0.4); }
    
    .view-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    .player-wrapper-container { flex: 1; display: flex; flex-direction: column; }
    .db-wrapper { flex: 1; padding: 24px; overflow-y: auto; background: var(--bg-primary); }

    .panel-header {
      height: 50px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      background: rgba(0, 0, 0, 0.02);
      border-bottom: 1px solid var(--border-color);
      justify-content: space-between;
    }
    .left-panel.collapsed .panel-header { justify-content: center; padding: 0; }
    .right-panel.collapsed .panel-header { justify-content: center; padding: 0; }
    
    .panel-header h2 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
    }
    
    .toggle-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 1.1rem;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
    }
    .toggle-btn:hover {
      background: rgba(0,0,0,0.05);
      color: var(--accent-primary);
    }
    
    .panel-content {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    }
    .panel-content.p-0 {
      padding: 0;
    }
    .placeholder-text {
      color: var(--text-tertiary);
      font-size: 0.9rem;
      text-align: center;
    }
  `]
})
export class YouTubeManagerComponent {
  leftExpanded = true;
  rightExpanded = true;
  currentView: 'player' | 'db' = 'player';
}
