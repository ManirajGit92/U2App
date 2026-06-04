import { Component, input } from '@angular/core';
import type { SyncState } from '../../../core/services/firebase-sync.service';

@Component({
  selector: 'app-sync-status',
  standalone: true,
  template: `
    <div class="sync-status" [class]="'sync-' + state()" [title]="tooltip()">
      @switch (state()) {
        @case ('syncing') {
          <div class="sync-icon spinning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 0 1-9 9m0 0a9 9 0 0 1-9-9m9 9V3m0 0a9 9 0 0 1 9 9m-9-9a9 9 0 0 0-9 9"/>
            </svg>
          </div>
        }
        @case ('idle') {
          <div class="sync-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12A10 10 0 1 1 12 2"/>
              <path d="M22 2 12 12"/>
            </svg>
          </div>
        }
        @case ('error') {
          <div class="sync-icon error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        }
        @case ('offline') {
          <div class="sync-icon offline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .sync-status {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      transition: all var(--transition-fast);
      cursor: default;
    }

    .sync-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
    }

    .sync-idle .sync-icon { color: #34d399; }
    .sync-syncing .sync-icon { color: var(--accent-primary); }
    .sync-error .sync-icon { color: #f87171; }
    .sync-offline .sync-icon { color: var(--text-tertiary); }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class SyncStatusComponent {
  state = input<SyncState>('offline');
  tooltip = input<string>('');
}
