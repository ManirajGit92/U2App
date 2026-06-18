import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationTreeComponent } from './components/navigation-tree.component';
import { VideoPlayerComponent } from './components/video-player.component';
import { LyricsPanelComponent } from './components/lyrics-panel.component';
import { DataTableComponent } from './components/data-table.component';
import { PlayerBarComponent } from './components/player-bar.component';
import { VideoFormComponent } from './components/video-form.component';
import { CustomFieldsManagerComponent } from './components/custom-fields-manager.component';
import { YouTubeStateService } from './services/yt-state.service';
import { YouTubeVideoData } from './models/youtube.models';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-youtube-manager',
  standalone: true,
  imports: [
    CommonModule, 
    NavigationTreeComponent, 
    VideoPlayerComponent, 
    LyricsPanelComponent, 
    DataTableComponent,
    PlayerBarComponent,
    VideoFormComponent,
    CustomFieldsManagerComponent
  ],
  template: `
    <div class="yt-manager-root" [class.has-player-bar]="state.showPlayerBar && activeVideo">
      
      <!-- Mobile Header -->
      <header class="mobile-header" *ngIf="isMobile">
        <button class="hamburger-btn" (click)="leftExpanded = !leftExpanded">☰</button>
        <h1>YouTube Manager</h1>
        <button class="hamburger-btn" (click)="rightExpanded = !rightExpanded">🎵</button>
      </header>

      <div class="yt-manager-layout">
        
        <!-- Backdrop for mobile drawer -->
        <div class="drawer-backdrop" *ngIf="isMobile && leftExpanded" (click)="leftExpanded = false"></div>
        <div class="drawer-backdrop right" *ngIf="isMobile && rightExpanded" (click)="rightExpanded = false"></div>

        <!-- Left Panel: Tree & Filters -->
        <aside 
          class="panel left-panel" 
          [class.collapsed]="!leftExpanded && !isMobile"
          [class.mobile-open]="leftExpanded && isMobile">
          
          <div class="panel-header" *ngIf="!isMobile">
            <h2 *ngIf="leftExpanded">Library & Filters</h2>
            <button class="toggle-btn" (click)="leftExpanded = !leftExpanded">
              {{ leftExpanded ? '◀' : '▶' }}
            </button>
          </div>
          
          <div class="panel-content p-0" *ngIf="leftExpanded || isMobile">
            <app-navigation-tree
              (openAddForm)="triggerAddForm()"
              (openEditForm)="triggerEditForm($event)"
              (openCustomFields)="showCustomFieldsManager = true">
            </app-navigation-tree>
          </div>
        </aside>

        <!-- Center Panel: YouTube Player or Database -->
        <main class="panel center-panel">
          <div class="view-toggle-bar">
            <button class="view-btn" [class.active]="currentView === 'player'" (click)="currentView = 'player'">
              🎬 Player View
            </button>
            <button class="view-btn" [class.active]="currentView === 'db'" (click)="currentView = 'db'">
              📋 Excel Database View
            </button>
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

        <!-- Right Panel: Lyrics & Casting details -->
        <aside 
          class="panel right-panel" 
          [class.collapsed]="!rightExpanded && !isMobile"
          [class.mobile-open]="rightExpanded && isMobile">
          
          <div class="panel-header" *ngIf="!isMobile">
            <button class="toggle-btn" (click)="rightExpanded = !rightExpanded">
              {{ rightExpanded ? '▶' : '◀' }}
            </button>
            <h2 *ngIf="rightExpanded" style="margin-left: 8px;">Lyrics</h2>
          </div>
          
          <div class="panel-content p-0" *ngIf="rightExpanded || isMobile">
            <app-lyrics-panel></app-lyrics-panel>
          </div>
        </aside>
      </div>

      <!-- Bottom Player Control Bar -->
      <app-player-bar></app-player-bar>

      <!-- Add/Edit Video Popup Modal -->
      <app-video-form
        *ngIf="showAddEditForm"
        [videoToEdit]="videoToEdit"
        (saveVideo)="onSaveVideo($event)"
        (cancel)="closeAddEditForm()">
      </app-video-form>

      <!-- Custom Fields Manager Modal -->
      <app-custom-fields-manager
        *ngIf="showCustomFieldsManager"
        (close)="showCustomFieldsManager = false">
      </app-custom-fields-manager>

    </div>
  `,
  styles: [`
    .yt-manager-root {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 60px);
      overflow: hidden;
      position: relative;
    }
    
    .yt-manager-root.has-player-bar {
      /* Reserve space for fixed bottom player bar */
      padding-bottom: 74px;
    }

    .mobile-header {
      height: 50px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 1rem;
      z-index: 1100;
    }
    .mobile-header h1 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .hamburger-btn {
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 1.4rem;
      cursor: pointer;
    }

    .yt-manager-layout {
      display: flex;
      flex: 1;
      height: 100%;
      background: var(--bg-primary);
      overflow: hidden;
      position: relative;
    }

    .panel {
      display: flex;
      flex-direction: column;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      height: 100%;
    }

    /* Left panel styling */
    .left-panel {
      width: 320px;
      border-right: 1px solid var(--border-color);
      background: var(--surface-card);
    }
    .left-panel.collapsed { 
      width: 50px;
    }
    .left-panel.collapsed .panel-header {
      justify-content: center;
      padding: 0;
    }

    /* Right panel styling */
    .right-panel {
      width: 340px;
      border-left: 1px solid var(--border-color);
      background: var(--surface-card);
    }
    .right-panel.collapsed { 
      width: 50px; 
    }
    .right-panel.collapsed .panel-header {
      justify-content: center;
      padding: 0;
    }

    /* Center panel theater feel */
    .center-panel {
      flex: 1;
      background: #000;
      min-width: 300px;
      display: flex;
      flex-direction: column;
    }

    .view-toggle-bar {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 0.5rem;
      background: #0a0a0a;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .view-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      color: #999;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.82rem;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.25s ease;
    }
    .view-btn:hover {
      background: rgba(255,255,255,0.06);
      color: #fff;
    }
    .view-btn.active {
      background: var(--accent-gradient);
      border-color: transparent;
      color: #fff;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(99,102,241,0.25);
    }

    .view-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .player-wrapper-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .db-wrapper {
      flex: 1;
      padding: 0.75rem;
      overflow-y: auto;
      background: var(--bg-primary);
    }

    .panel-header {
      height: 46px;
      display: flex;
      align-items: center;
      padding: 0 0.5rem;
      background: rgba(0, 0, 0, 0.01);
      border-bottom: 1px solid var(--border-color);
      justify-content: space-between;
    }

    .panel-header h2 {
      margin: 0;
      font-size: 0.92rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .toggle-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.9rem;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
    }
    .toggle-btn:hover {
      background: var(--accent-surface);
      color: var(--accent-primary);
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
    }
    .panel-content.p-0 {
      padding: 0;
    }

    /* Mobile drawer overlay styling */
    .drawer-backdrop {
      display: none;
    }

    @media (max-width: 768px) {
      .yt-manager-root {
        height: 100vh;
      }
      .yt-manager-layout {
        position: relative;
      }
      .panel {
        width: 0px;
        overflow: hidden;
      }
      
      /* Active drawer panels on mobile */
      .left-panel.mobile-open {
        position: fixed;
        left: 0;
        top: 50px;
        bottom: 0;
        width: 290px !important;
        z-index: 1200;
        background: var(--bg-secondary);
        box-shadow: 4px 0 15px rgba(0,0,0,0.25);
        display: flex;
        animation: slideInLeft 0.3s ease-out;
      }
      
      .right-panel.mobile-open {
        position: fixed;
        right: 0;
        top: 50px;
        bottom: 0;
        width: 300px !important;
        z-index: 1200;
        background: var(--bg-secondary);
        box-shadow: -4px 0 15px rgba(0,0,0,0.25);
        display: flex;
        animation: slideInRight 0.3s ease-out;
      }

      .drawer-backdrop {
        display: block;
        position: fixed;
        top: 50px;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 1150;
      }

      @keyframes slideInLeft {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
    }
  `]
})
export class YouTubeManagerComponent implements OnInit, OnDestroy {
  state = inject(YouTubeStateService);

  leftExpanded = true;
  rightExpanded = true;
  currentView: 'player' | 'db' = 'player';
  
  isMobile = false;
  isTablet = false;

  // Add / Edit Modal states
  showAddEditForm = false;
  videoToEdit: YouTubeVideoData | null = null;

  // Custom Fields Manager Modal state
  showCustomFieldsManager = false;

  activeVideo: YouTubeVideoData | null = null;
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.checkLayout();
    
    // Subscribe to active video
    this.state.currentVideo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(v => {
        this.activeVideo = v;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkLayout();
  }

  private checkLayout() {
    const width = window.innerWidth;
    this.isMobile = width < 768;
    this.isTablet = width >= 768 && width <= 1024;

    // Set responsive defaults
    if (this.isMobile) {
      this.leftExpanded = false;
      this.rightExpanded = false;
    } else if (this.isTablet) {
      this.leftExpanded = false; // Collapse sidebar in tablet to leave space
      this.rightExpanded = true;
    } else {
      this.leftExpanded = true;
      this.rightExpanded = true;
    }
  }

  triggerAddForm() {
    this.videoToEdit = null;
    this.showAddEditForm = true;
  }

  triggerEditForm(video: YouTubeVideoData) {
    this.videoToEdit = video;
    this.showAddEditForm = true;
  }

  closeAddEditForm() {
    this.showAddEditForm = false;
    this.videoToEdit = null;
  }

  onSaveVideo(video: YouTubeVideoData) {
    if (this.videoToEdit) {
      // Edit mode
      this.state.updateVideo(video.id, video);
    } else {
      // Add mode
      video.id = 'YT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      this.state.addVideo(video);
    }
    this.closeAddEditForm();
  }
}
