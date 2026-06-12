import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService, SyncState } from '../../core/services/firebase-sync.service';
import { SyncStatusComponent } from '../../shared/components/sync-status/sync-status.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';
import { LifeTrackerService } from '../life-tracker/life-tracker.service';
import { WorkTrackerService } from '../work-tracker/work-tracker.service';
import { BillingStateService } from '../free-billing/services/billing-state.service';
import { ExcelMapperService } from '../excel-mapper/excel-mapper.service';
import { StandupNoteService } from '../standup-note/standup-note.service';
import { UnitTestService } from '../unit-test-tracker/unit-test.service';
import { HomeCarouselService, CarouselSlide, SlideStat } from '../../core/services/home-carousel.service';

interface SyncModule {
  key: string;
  label: string;
  icon: string;
  collections: string[];
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [SyncStatusComponent, LoadingOverlayComponent, FormsModule],
  template: `
    <app-loading-overlay [show]="isBusySyncing()" message="Syncing your data…" />

    <section class="profile-page">
      <div class="profile-bg"></div>

      <div class="profile-content container">
        <!-- User Card -->
        <div class="user-card glass-card">
          <div class="user-card-header">
            <img
              class="user-photo"
              [src]="authService.user()?.photoURL || 'https://ui-avatars.com/api/?name=U&background=6366f1&color=fff&size=120'"
              alt="Profile photo"
            />
            <div class="user-details">
              <h1 class="user-name">{{ authService.user()?.displayName || 'User' }}</h1>
              <p class="user-email">{{ authService.user()?.email }}</p>
              <span class="user-provider badge">
                {{ getProviderLabel() }}
              </span>
            </div>
          </div>
          <div class="user-actions">
            <button class="btn btn-secondary btn-sm" (click)="handleSignOut()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </div>

        <!-- Cloud Sync Section -->
        <div class="sync-section">
          <div class="section-header-row">
            <h2 class="section-title">☁️ Cloud Sync</h2>
            <app-sync-status
              [state]="syncService.syncState()"
              [tooltip]="getSyncTooltip()"
            />
          </div>
          <p class="section-subtitle">
            Manage cloud synchronization for your app modules. Data is stored under your
            account in Firebase Firestore.
          </p>

          @if (syncService.syncError()) {
            <div class="sync-error-banner">
              <span>⚠️ {{ syncService.syncError() }}</span>
            </div>
          }

          <div class="modules-grid">
            @for (mod of modules; track mod.key) {
              <div class="module-card glass-card">
                <div class="module-header">
                  <span class="module-icon">{{ mod.icon }}</span>
                  <div>
                    <h3 class="module-name">{{ mod.label }}</h3>
                    <p class="module-collections">{{ mod.collections.length }} collection(s)</p>
                  </div>
                </div>
                <div class="module-actions">
                  <button
                    class="btn btn-primary btn-sm"
                    (click)="syncModule(mod)"
                    [disabled]="isBusySyncing()"
                  >
                    🔄 Sync Now
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Sync All -->
        <div class="sync-all-row">
          <button
            class="btn btn-primary"
            (click)="syncAll()"
            [disabled]="isBusySyncing()"
          >
            ☁️ Sync All Modules to Cloud
          </button>
        </div>

        <!-- Home Carousel Management Section -->
        <div class="carousel-section">
          <div class="section-header-row">
            <h2 class="section-title">🎠 Home Carousel Management</h2>
          </div>
          <p class="section-subtitle">
            Manage the carousel slides displayed on the Home Screen Hero section. You can add, edit, reorder, and enable/disable slides.
          </p>

          <div class="carousel-actions-row">
            <button class="btn btn-primary btn-sm" (click)="openAddSlideForm()">
              ➕ Add New Slide
            </button>
          </div>

          <div class="slides-list glass-card">
            @if (slides.length === 0) {
              <div class="no-slides">
                <p>No slides configured. Default slide is active.</p>
              </div>
            } @else {
              <div class="slides-table-wrapper">
                <table class="slides-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Badge</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (slide of slides; track slide.id; let idx = $index) {
                      <tr>
                        <td style="text-align: center; font-weight: bold;">{{ slide.displayOrder }}</td>
                        <td><span class="slide-badge-preview">{{ slide.badgeText || 'None' }}</span></td>
                        <td class="slide-title-preview" [innerHTML]="slide.title"></td>
                        <td>
                          <span class="badge" [class.badge-active]="slide.isActive" [class.badge-inactive]="!slide.isActive" (click)="toggleSlideStatus(slide)">
                            {{ slide.isActive ? 'Active' : 'Inactive' }}
                          </span>
                        </td>
                        <td>
                          <div class="slide-row-actions">
                            <button class="btn btn-secondary btn-xs" (click)="openEditSlideForm(slide)">Edit</button>
                            <button class="btn btn-danger btn-xs text-white" (click)="deleteSlide(slide.id)">Delete</button>
                            <button class="btn btn-secondary btn-xs" [disabled]="idx === 0" (click)="moveSlide(idx, 'up')">▲</button>
                            <button class="btn btn-secondary btn-xs" [disabled]="idx === slides.length - 1" (click)="moveSlide(idx, 'down')">▼</button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>

        <!-- Add/Edit Slide Modal -->
        @if (isFormOpen && editingSlide) {
          <div class="modal-overlay">
            <div class="modal-content glass-card">
              <div class="modal-header">
                <h3>{{ isEditing ? 'Edit Slide' : 'Add New Slide' }}</h3>
                <button class="btn-close" (click)="isFormOpen = false">×</button>
              </div>
              <div class="modal-body">
                <!-- Live Preview Section -->
                <div class="live-slide-preview-container">
                  <h5>Live Slide Preview</h5>
                  <div class="mini-slide" 
                       [style.background-image]="editingSlide.bgImage ? 'url(' + editingSlide.bgImage + ')' : 'none'"
                       [style.background-color]="editingSlide.bgImage ? 'transparent' : 'var(--bg-secondary)'">
                    
                    <!-- Overlay layer -->
                    @if (editingSlide.overlayType !== 'none') {
                      <div class="mini-slide-overlay" 
                           [style.background-color]="editingSlide.overlayType === 'dark' ? 'rgba(15, 23, 42, ' + (editingSlide.overlayOpacity ?? 75) / 100 + ')' : 'rgba(255, 255, 255, ' + (editingSlide.overlayOpacity ?? 75) / 100 + ')'">
                      </div>
                    }
                    
                    <!-- Content layer -->
                    <div class="mini-slide-content" [style.color]="editingSlide.overlayType === 'light' ? '#0f0f1a' : '#e8e8f0'">
                      @if (editingSlide.badgeText) {
                        <span class="mini-slide-badge">{{ editingSlide.badgeText }}</span>
                      }
                      <h4 class="mini-slide-title" [innerHTML]="editingSlide.title || 'All Your Developer Tools In One Place'"></h4>
                      <p class="mini-slide-desc">{{ editingSlide.description || 'Slide description preview text.' }}</p>
                      <div class="mini-slide-buttons">
                        @if (editingSlide.primaryBtnText) {
                          <span class="mini-btn mini-btn-primary">{{ editingSlide.primaryBtnText }}</span>
                        }
                        @if (editingSlide.secondaryBtnText) {
                          <span class="mini-btn mini-btn-secondary">{{ editingSlide.secondaryBtnText }}</span>
                        }
                      </div>
                      
                      @if (editingSlide.statistics && editingSlide.statistics.length > 0) {
                        <div class="mini-slide-stats">
                          @for (stat of editingSlide.statistics; track $index) {
                            <div class="mini-stat">
                              <span class="mini-stat-num">{{ stat.number }}</span>
                              <span class="mini-stat-label">{{ stat.label }}</span>
                            </div>
                          }
                        </div>
                      }
                    </div>

                    <!-- Autoplay progress preview bar -->
                    <div class="mini-slide-progress-bar-container">
                      <div class="mini-slide-progress-bar" [style.animation]="'fillProgress ' + (editingSlide.duration || 6) + 's linear infinite'"></div>
                    </div>
                  </div>
                  <div class="duration-preview-info">
                    <span>⏱️ Slide Duration: <strong>{{ editingSlide.duration || 6 }} seconds</strong> before transitioning.</span>
                  </div>
                </div>

                <div class="form-grid">
                  <div class="form-group full-width">
                    <label>Background Image URL (Leave blank to use theme default gradient)</label>
                    <input type="text" [(ngModel)]="editingSlide.bgImage" placeholder="https://images.unsplash.com/photo-..." class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Display Order</label>
                    <input type="number" [(ngModel)]="editingSlide.displayOrder" class="form-input" min="1" />
                  </div>

                  <div class="form-group">
                    <label>Active Status</label>
                    <div class="toggle-container">
                      <input type="checkbox" id="isActiveToggle" [(ngModel)]="editingSlide.isActive" class="toggle-checkbox" />
                      <label for="isActiveToggle" class="toggle-label"></label>
                      <span class="toggle-text">{{ editingSlide.isActive ? 'Active' : 'Inactive' }}</span>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Overlay Type</label>
                    <select [(ngModel)]="editingSlide.overlayType" class="form-input">
                      <option value="none">None (Clear Image)</option>
                      <option value="dark">Dark Shade</option>
                      <option value="light">Light Shade</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Overlay Opacity ({{ editingSlide.overlayOpacity ?? 75 }}%)</label>
                    <input type="range" [(ngModel)]="editingSlide.overlayOpacity" min="0" max="100" class="form-input range-slider" [disabled]="editingSlide.overlayType === 'none'" />
                  </div>

                  <div class="form-group">
                    <label>Slide Duration (Seconds)</label>
                    <input type="number" [(ngModel)]="editingSlide.duration" min="1" max="60" class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Badge Text</label>
                    <input type="text" [(ngModel)]="editingSlide.badgeText" placeholder="e.g. ⚡ New Feature" class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Title (HTML Allowed, e.g. &lt;span class="gradient-text"&gt;Text&lt;/span&gt;)</label>
                    <input type="text" [(ngModel)]="editingSlide.title" placeholder="All Your Developer Tools In One Place" class="form-input" />
                  </div>

                  <div class="form-group full-width">
                    <label>Description</label>
                    <textarea [(ngModel)]="editingSlide.description" placeholder="A brief description of this slide..." class="form-input" rows="3"></textarea>
                  </div>

                  <div class="form-group">
                    <label>Primary Button Text</label>
                    <input type="text" [(ngModel)]="editingSlide.primaryBtnText" placeholder="Get Started" class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Primary Button Route/URL</label>
                    <input type="text" [(ngModel)]="editingSlide.primaryBtnRoute" placeholder="/excel-mapper or https://..." class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Secondary Button Text</label>
                    <input type="text" [(ngModel)]="editingSlide.secondaryBtnText" placeholder="Explore Tools" class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Secondary Button Route/URL</label>
                    <input type="text" [(ngModel)]="editingSlide.secondaryBtnRoute" placeholder="#tools or https://..." class="form-input" />
                  </div>
                </div>

                <div class="stats-management">
                  <div class="stats-header">
                    <h4>Statistics Section (Optional, Max 3)</h4>
                    <button class="btn btn-secondary btn-sm" [disabled]="editingSlide.statistics && editingSlide.statistics.length >= 3" (click)="addStat()">Add Stat</button>
                  </div>
                  <div class="stats-list">
                    @for (stat of editingSlide.statistics; track $index; let sIdx = $index) {
                      <div class="stat-row">
                        <input type="text" [(ngModel)]="stat.number" placeholder="20+" class="form-input stat-num-input" />
                        <input type="text" [(ngModel)]="stat.label" placeholder="Tools" class="form-input stat-label-input" />
                        <button class="btn btn-danger btn-sm text-white" (click)="removeStat(sIdx)">Remove</button>
                      </div>
                    }
                    @if (!editingSlide.statistics || editingSlide.statistics.length === 0) {
                      <p class="no-stats-text">No statistics added. This section will be hidden on the slide.</p>
                    }
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="isFormOpen = false">Cancel</button>
                <button class="btn btn-primary" (click)="saveSlide()">Save Slide</button>
              </div>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .profile-page {
      position: relative;
      min-height: 100vh;
      padding: 0.5rem 0.5rem 0.5rem;
    }

    .profile-bg {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.06) 0%, transparent 50%);
      z-index: 0;
    }

    .profile-content {
      position: relative;
      z-index: 1;
      max-width: 800px;
    }

    /* User Card */
    .user-card {
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      animation: fadeInUp 0.5s ease-out;
    }

    .user-card-header {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 0.5rem;
    }

    .user-photo {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 3px solid var(--accent-primary);
      object-fit: cover;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .user-name {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    .user-email {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .user-provider {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--accent-surface);
      color: var(--accent-primary);
      border-radius: 50px;
      width: fit-content;
    }

    .user-actions {
      display: flex;
      gap: 12px;
    }

    /* Sync Section */
    .sync-section {
      margin-bottom: 0.5rem;
      animation: fadeInUp 0.5s ease-out 0.1s both;
    }

    .section-header-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .section-title {
      font-size: 1.4rem;
      font-weight: 700;
    }

    .section-subtitle {
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
      line-height: 1.6;
    }

    .sync-error-banner {
      padding: 0.5rem 0.5rem;
      margin-bottom: 0.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      color: #f87171;
      font-size: 0.88rem;
    }

    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .module-card {
      padding: 0.5rem 0.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .module-header {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .module-icon {
      font-size: 1.6rem;
    }

    .module-name {
      font-size: 1rem;
      font-weight: 600;
    }

    .module-collections {
      font-size: 0.78rem;
      color: var(--text-tertiary);
    }

    .module-actions {
      flex-shrink: 0;
    }

    .sync-all-row {
      text-align: center;
      margin-top: 0.5rem;
      animation: fadeInUp 0.5s ease-out 0.2s both;
    }

    @media (max-width: 640px) {
      .user-card-header {
        flex-direction: column;
        text-align: center;
      }
      .user-actions {
        justify-content: center;
      }
      .modules-grid {
        grid-template-columns: 1fr;
      }
      .module-card {
        flex-direction: column;
        text-align: center;
      }
    }

    /* Carousel Management Section */
    .carousel-section {
      margin-top: 2rem;
      margin-bottom: 2rem;
      animation: fadeInUp 0.5s ease-out 0.2s both;
    }

    .carousel-actions-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1rem;
    }

    .slides-list {
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .no-slides {
      padding: 2.5rem;
      text-align: center;
      color: var(--text-secondary);
    }

    .slides-table-wrapper {
      overflow-x: auto;
    }

    .slides-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .slides-table th, .slides-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.9rem;
    }

    .slides-table th {
      color: var(--text-tertiary);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }

    .slide-badge-preview {
      background: var(--accent-surface);
      color: var(--accent-primary);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      white-space: nowrap;
    }

    .slide-title-preview {
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge-inactive {
      background: rgba(148, 148, 184, 0.15);
      color: var(--text-secondary);
    }

    .badge-active, .badge-inactive {
      cursor: pointer;
      user-select: none;
    }

    .slide-row-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .btn-xs {
      padding: 4px 8px;
      font-size: 0.75rem;
      border-radius: 6px;
    }

    .btn-danger {
      background: var(--danger);
      color: #fff;
    }
    .btn-danger:hover {
      background: #dc2626;
      transform: translateY(-1px);
    }

    .text-white {
      color: #fff !important;
    }

    /* Modal Overlay */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 15, 26, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      animation: fadeIn 0.25s ease-out;
    }

    .modal-content {
      width: 100%;
      max-width: 650px;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color-strong);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg), var(--shadow-glow);
      display: flex;
      flex-direction: column;
      animation: slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-header h3 {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .btn-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: color 0.2s;
    }
    .btn-close:hover {
      color: var(--text-primary);
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
    }

    .modal-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    /* Form Grid */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group.full-width {
      grid-column: span 2;
    }

    .form-group label {
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .form-input {
      background: var(--bg-input);
      border: 1px solid var(--border-color-strong);
      color: var(--text-primary);
      padding: 10px 12px;
      border-radius: var(--radius-md);
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      border-color: var(--accent-primary);
    }

    textarea.form-input {
      resize: vertical;
    }

    .image-preview {
      margin-top: 8px;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--border-color);
      max-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.2);
    }

    .image-preview img {
      max-height: 100%;
      object-fit: contain;
    }

    /* Toggle Switch */
    .toggle-container {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 40px;
    }

    .toggle-checkbox {
      display: none;
    }

    .toggle-label {
      width: 44px;
      height: 22px;
      background: var(--text-tertiary);
      border-radius: 50px;
      position: relative;
      cursor: pointer;
      transition: background 0.3s;
    }

    .toggle-label::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      top: 2px;
      left: 2px;
      transition: transform 0.3s;
    }

    .toggle-checkbox:checked + .toggle-label {
      background: var(--success);
    }

    .toggle-checkbox:checked + .toggle-label::after {
      transform: translateX(22px);
    }

    .toggle-text {
      font-size: 0.88rem;
      font-weight: 600;
    }

    /* Stats Management */
    .stats-management {
      margin-top: 20px;
      border-top: 1px solid var(--border-color);
      padding-top: 16px;
    }

    .stats-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .stats-header h4 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .stats-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stat-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .stat-num-input {
      flex: 1;
    }

    .stat-label-input {
      flex: 2;
    }

    .no-stats-text {
      font-size: 0.8rem;
      color: var(--text-tertiary);
      font-style: italic;
    }

    /* Live Slide Preview styles */
    .live-slide-preview-container {
      margin-top: 0.5rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .live-slide-preview-container h5 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 10px;
    }

    .mini-slide {
      position: relative;
      width: 100%;
      min-height: 200px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color-strong);
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 16px;
    }

    .mini-slide-overlay {
      position: absolute;
      inset: 0;
      z-index: 1;
      transition: background-color 0.2s;
    }

    .mini-slide-content {
      position: relative;
      z-index: 2;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      max-width: 90%;
    }

    .mini-slide-badge {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--accent-primary);
      background: var(--accent-surface);
      border: 1px solid var(--accent-primary);
      padding: 2px 6px;
      border-radius: 20px;
    }

    .mini-slide-title {
      font-size: 1.15rem;
      font-weight: 800;
      line-height: 1.2;
    }

    .mini-slide-desc {
      font-size: 0.72rem;
      opacity: 0.8;
      line-height: 1.4;
    }

    .mini-slide-buttons {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }

    .mini-btn {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .mini-btn-primary {
      background: var(--accent-gradient);
      color: #fff;
    }

    .mini-btn-secondary {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }

    .mini-slide-stats {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 6px;
    }

    .mini-stat {
      text-align: center;
    }

    .mini-stat-num {
      display: block;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .mini-stat-label {
      font-size: 0.6rem;
      opacity: 0.6;
      text-transform: uppercase;
    }

    .mini-slide-progress-bar-container {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      z-index: 3;
    }

    .mini-slide-progress-bar {
      height: 100%;
      background: var(--accent-primary);
      width: 0%;
    }

    @keyframes fillProgress {
      from { width: 0%; }
      to { width: 100%; }
    }

    .duration-preview-info {
      margin-top: 8px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-align: center;
    }

    /* Range slider styles */
    .range-slider {
      padding: 4px 0 !important;
      cursor: pointer;
    }
  `],
})
export class ProfileComponent {
  authService = inject(FirebaseAuthService);
  syncService = inject(FirebaseSyncService);
  private router = inject(Router);

  private lifeTrackerService = inject(LifeTrackerService);
  private workTrackerService = inject(WorkTrackerService);
  private billingService = inject(BillingStateService);
  private excelMapperService = inject(ExcelMapperService);
  private standupNoteService = inject(StandupNoteService);
  private unitTestService = inject(UnitTestService);
  private homeCarouselService = inject(HomeCarouselService);

  isBusySyncing = signal(false);

  slides: CarouselSlide[] = [];
  editingSlide: CarouselSlide | null = null;
  isFormOpen = false;
  isEditing = false;

  modules: SyncModule[] = [
    {
      key: 'life-tracker',
      label: 'Life Tracker',
      icon: '🌱',
      collections: ['routines', 'expenses', 'diet', 'fitness', 'mentalHealth', 'relationships', 'investments'],
    },
    {
      key: 'work-tracker',
      label: 'Work Tracker',
      icon: '📈',
      collections: ['developerTasks', 'releaseTracks', 'hourlyUpdates'],
    },
    {
      key: 'free-billing',
      label: 'Free Billing',
      icon: '💳',
      collections: ['products', 'customers', 'purchases', 'invoices'],
    },
    {
      key: 'excel-mapper',
      label: 'Excel Mapper',
      icon: '🧭',
      collections: ['templates', 'audit'],
    },
    {
      key: 'standup-note',
      label: 'Standup Note',
      icon: '📝',
      collections: ['employees', 'standupNotes', 'projects', 'reminders', 'checklistGroups', 'feedbacks'],
    },
    {
      key: 'unit-test-tracker',
      label: 'Unit Test Tracker',
      icon: '🧪',
      collections: ['testCases', 'executions', 'bugs'],
    },
    {
      key: 'home-carousel',
      label: 'Home Carousel',
      icon: '🎠',
      collections: ['homeSlides'],
    },
  ];

  constructor() {
    this.homeCarouselService.slides$.subscribe(slides => {
      this.slides = slides;
    });
  }

  openAddSlideForm(): void {
    this.isEditing = false;
    this.editingSlide = {
      id: 'slide_' + Date.now(),
      bgImage: '',
      badgeText: '',
      title: '',
      description: '',
      primaryBtnText: '',
      primaryBtnRoute: '',
      secondaryBtnText: '',
      secondaryBtnRoute: '',
      statistics: [],
      displayOrder: this.slides.length + 1,
      isActive: true,
      overlayType: 'dark',
      overlayOpacity: 75,
      duration: 6
    };
    this.isFormOpen = true;
  }

  openEditSlideForm(slide: CarouselSlide): void {
    this.isEditing = true;
    this.editingSlide = JSON.parse(JSON.stringify(slide));
    if (!this.editingSlide!.statistics) {
      this.editingSlide!.statistics = [];
    }
    if (this.editingSlide!.overlayType === undefined) {
      this.editingSlide!.overlayType = this.editingSlide!.bgImage ? 'dark' : 'none';
    }
    if (this.editingSlide!.overlayOpacity === undefined) {
      this.editingSlide!.overlayOpacity = 75;
    }
    if (this.editingSlide!.duration === undefined) {
      this.editingSlide!.duration = 6;
    }
    this.isFormOpen = true;
  }

  addStat(): void {
    if (this.editingSlide) {
      if (!this.editingSlide.statistics) {
        this.editingSlide.statistics = [];
      }
      if (this.editingSlide.statistics.length < 3) {
        this.editingSlide.statistics.push({ number: '', label: '' });
      }
    }
  }

  removeStat(index: number): void {
    if (this.editingSlide && this.editingSlide.statistics) {
      this.editingSlide.statistics.splice(index, 1);
    }
  }

  saveSlide(): void {
    if (!this.editingSlide) return;
    
    if (!this.editingSlide.title || !this.editingSlide.description) {
      alert('Title and Description are required.');
      return;
    }

    let updatedSlides = [...this.slides];
    if (this.isEditing) {
      updatedSlides = updatedSlides.map(s => s.id === this.editingSlide!.id ? this.editingSlide! : s);
    } else {
      updatedSlides.push(this.editingSlide);
    }

    this.homeCarouselService.updateSlides(updatedSlides);
    this.isFormOpen = false;
    this.editingSlide = null;
  }

  deleteSlide(id: string): void {
    if (confirm('Are you sure you want to delete this slide?')) {
      const updatedSlides = this.slides.filter(s => s.id !== id);
      this.homeCarouselService.updateSlides(updatedSlides);
    }
  }

  toggleSlideStatus(slide: CarouselSlide): void {
    const updated = this.slides.map(s => {
      if (s.id === slide.id) {
        return { ...s, isActive: !s.isActive };
      }
      return s;
    });
    this.homeCarouselService.updateSlides(updated);
  }

  moveSlide(index: number, direction: 'up' | 'down'): void {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === this.slides.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedSlides = [...this.slides];

    const temp = updatedSlides[index];
    updatedSlides[index] = updatedSlides[targetIndex];
    updatedSlides[targetIndex] = temp;

    updatedSlides.forEach((slide, i) => {
      slide.displayOrder = i + 1;
    });

    this.homeCarouselService.updateSlides(updatedSlides);
  }

  getProviderLabel(): string {
    const provider = this.authService.getUserProfile()?.provider ?? '';
    if (provider.includes('google')) return '🔵 Google';
    if (provider.includes('microsoft')) return '🟦 Microsoft';
    return provider;
  }

  getSyncTooltip(): string {
    switch (this.syncService.syncState()) {
      case 'idle': return 'All data synced';
      case 'syncing': return 'Syncing…';
      case 'error': return 'Sync error: ' + (this.syncService.syncError() ?? 'Unknown');
      case 'offline': return 'Not signed in';
    }
  }

  async syncModule(mod: SyncModule): Promise<void> {
    this.isBusySyncing.set(true);
    try {
      switch (mod.key) {
        case 'life-tracker':
          await this.lifeTrackerService.syncAllToFirestore();
          break;
        case 'work-tracker':
          await this.workTrackerService.syncAllToFirestore();
          break;
        case 'free-billing':
          await this.billingService.syncAllToFirestore();
          break;
        case 'excel-mapper':
          await this.excelMapperService.syncAllToFirestore();
          break;
        case 'standup-note':
          await this.standupNoteService.syncAllToFirestore();
          break;
        case 'unit-test-tracker':
          await this.unitTestService.syncAllToFirestore();
          break;
        case 'home-carousel':
          await this.homeCarouselService.syncAllToFirestore();
          break;
      }
      await this.syncService.pushDocumentToFirestore(mod.key, {
        lastSyncedAt: new Date().toISOString(),
        moduleName: mod.label,
      });
    } catch (e) {
      console.error(`Sync failed for ${mod.label}`, e);
    } finally {
      this.isBusySyncing.set(false);
    }
  }

  async syncAll(): Promise<void> {
    this.isBusySyncing.set(true);
    try {
      for (const mod of this.modules) {
        await this.syncModule(mod);
      }
    } catch (e) {
      console.error('Sync all failed', e);
    } finally {
      this.isBusySyncing.set(false);
    }
  }

  async handleSignOut(): Promise<void> {
    await this.authService.signOutUser();
    this.router.navigate(['/']);
  }
}
