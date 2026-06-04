import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    @if (show()) {
      <div class="loading-overlay" [class.inline]="inline()">
        <div class="loading-spinner"></div>
        @if (message()) {
          <p class="loading-message">{{ message() }}</p>
        }
      </div>
    }
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      animation: fadeIn 0.2s ease-out;
    }

    .loading-overlay.inline {
      position: relative;
      inset: unset;
      min-height: 120px;
      background: transparent;
      backdrop-filter: none;
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      border-top-color: var(--accent-primary);
      border-right-color: rgba(139, 92, 246, 0.6);
      animation: spin 0.8s linear infinite;
    }

    .inline .loading-spinner {
      width: 36px;
      height: 36px;
      border-color: var(--border-color);
      border-top-color: var(--accent-primary);
      border-right-color: rgba(139, 92, 246, 0.6);
    }

    .loading-message {
      font-size: 0.92rem;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 500;
    }

    .inline .loading-message {
      color: var(--text-secondary);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class LoadingOverlayComponent {
  show = input(false);
  message = input('');
  inline = input(false);
}
