import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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

interface SyncModule {
  key: string;
  label: string;
  icon: string;
  collections: string[];
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [SyncStatusComponent, LoadingOverlayComponent],
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

  isBusySyncing = signal(false);

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
  ];

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
