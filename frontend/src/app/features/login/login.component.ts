import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  template: `
    <section class="login-page">
      <div class="login-bg"></div>

      <div class="login-card glass-card">
        <!-- Header -->
        <div class="login-header">
          <div class="login-icon">🔐</div>
          <h1 class="login-title">Welcome to <span class="gradient-text">U2 Tools</span></h1>
          <p class="login-subtitle">
            Sign in to sync your data across devices with cloud storage
          </p>
        </div>

        <!-- Error Message -->
        @if (authService.errorMessage()) {
          <div class="login-error animate-fade-in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{{ authService.errorMessage() }}</span>
            <button class="error-dismiss" (click)="authService.clearError()">✕</button>
          </div>
        }

        <!-- Loading State -->
        @if (authService.isLoading()) {
          <div class="login-loading">
            <div class="spinner"></div>
            <span>Signing you in…</span>
          </div>
        }

        <!-- Sign-In Buttons -->
        @if (!authService.isLoading()) {
          <div class="login-buttons">
            <button
              class="login-btn google-btn"
              (click)="handleGoogleSignIn()"
              [disabled]="authService.isLoading()"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            <button
              class="login-btn microsoft-btn"
              (click)="handleMicrosoftSignIn()"
              [disabled]="authService.isLoading()"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
              </svg>
              Sign in with Microsoft
            </button>
          </div>

          <div class="login-divider">
            <span>or</span>
          </div>

          <button class="login-btn skip-btn" (click)="skipLogin()">
            Continue without signing in
          </button>
        }

        <!-- Footer -->
        <p class="login-footer">
          Your data stays private. We only access your name, email, and profile picture.
        </p>
      </div>
    </section>
  `,
  styles: [`
    .login-page {
      position: relative;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      overflow: hidden;
    }

    .login-bg {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 20% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 70%, rgba(168, 85, 247, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
      z-index: 0;
    }

    .login-card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 460px;
      padding: 0.5rem 0.5rem;
      text-align: center;
      animation: fadeInUp 0.6s ease-out;
    }

    .login-header {
      margin-bottom: 0.5rem;
    }

    .login-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }

    .login-title {
      font-size: 1.8rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 0.5rem;
    }

    .gradient-text {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .login-subtitle {
      font-size: 0.95rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* Error */
    .login-error {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0.5rem 0.5rem;
      margin-bottom: 0.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      color: #f87171;
      font-size: 0.88rem;
      text-align: left;
    }

    .error-dismiss {
      margin-left: auto;
      background: none;
      border: none;
      color: #f87171;
      cursor: pointer;
      font-size: 1rem;
      padding: 0 4px;
    }

    /* Loading */
    .login-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 0.5rem 0;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--accent-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Buttons */
    .login-buttons {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 0.5rem;
    }

    .login-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 0.5rem 0.5rem;
      font-family: var(--font-family);
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      border: 1px solid transparent;
    }

    .login-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .google-btn {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-color: var(--border-color-strong);
    }

    .google-btn:hover:not(:disabled) {
      background: var(--accent-surface);
      border-color: var(--accent-primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
    }

    .microsoft-btn {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-color: var(--border-color-strong);
    }

    .microsoft-btn:hover:not(:disabled) {
      background: var(--accent-surface);
      border-color: var(--accent-primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
    }

    .skip-btn {
      background: none;
      color: var(--text-secondary);
      border-color: var(--border-color);
      font-weight: 500;
    }

    .skip-btn:hover:not(:disabled) {
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }

    /* Divider */
    .login-divider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 0.5rem;
      color: var(--text-tertiary);
      font-size: 0.82rem;
    }

    .login-divider::before,
    .login-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border-color);
    }

    /* Footer */
    .login-footer {
      margin-top: 0.5rem;
      font-size: 0.78rem;
      color: var(--text-tertiary);
      line-height: 1.5;
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 0.5rem 0.5rem;
      }
      .login-title {
        font-size: 1.4rem;
      }
    }
  `],
})
export class LoginComponent {
  authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);
  private router = inject(Router);

  async handleGoogleSignIn(): Promise<void> {
    await this.authService.signInWithGoogle();
    if (this.authService.isAuthenticated()) {
      await this.syncService.saveUserProfile();
      this.router.navigate(['/']);
    }
  }

  async handleMicrosoftSignIn(): Promise<void> {
    await this.authService.signInWithMicrosoft();
    if (this.authService.isAuthenticated()) {
      await this.syncService.saveUserProfile();
      this.router.navigate(['/']);
    }
  }

  skipLogin(): void {
    this.router.navigate(['/']);
  }
}
