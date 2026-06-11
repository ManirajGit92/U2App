import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      <div class="auth-card glass-card">
        <h1>Forgot Password</h1>
        <p>Enter the email address you used to sign in and we will send password reset instructions.</p>

        @if (message) {
          <div class="auth-alert success">{{ message }}</div>
        }

        @if (errorMessage) {
          <div class="auth-alert error">{{ errorMessage }}</div>
        }

        <form class="auth-form" (ngSubmit)="sendReset()">
          <div class="field-row">
            <label for="email">Email address</label>
            <input id="email" name="email" type="email" [(ngModel)]="email" required />
          </div>

          <button class="btn btn-primary" type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>

        <p class="auth-footer">
          Remembered your password? <a routerLink="/login">Sign in</a>
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .auth-card {
        width: min(460px, 100%);
        padding: 1.25rem;
        text-align: left;
      }
      .auth-form {
        display: grid;
        gap: 1rem;
      }
      .field-row {
        display: grid;
        gap: 0.5rem;
      }
      input {
        width: 100%;
        padding: 0.8rem 0.9rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .auth-alert {
        padding: 0.85rem 1rem;
        border-radius: var(--radius-md);
        margin-bottom: 1rem;
      }
      .auth-alert.success {
        color: #166534;
        background: rgba(134, 239, 172, 0.18);
        border: 1px solid rgba(34, 197, 94, 0.25);
      }
      .auth-alert.error {
        color: #b91c1c;
        background: rgba(248, 113, 113, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.25);
      }
      .auth-footer {
        margin-top: 1rem;
        font-size: 0.9rem;
        text-align: center;
      }
    `,
  ],
})
export class ForgotPasswordComponent {
  private authService = inject(FirebaseAuthService);
  private toast = inject(ToastService);

  email = '';
  isSubmitting = false;
  errorMessage: string | null = null;
  message: string | null = null;

  async sendReset(): Promise<void> {
    this.errorMessage = null;
    this.message = null;

    if (!this.email.trim()) {
      this.errorMessage = 'Please enter your registered email address.';
      return;
    }

    this.isSubmitting = true;
    try {
      await this.authService.sendPasswordReset(this.email.trim());
      this.message = 'Password reset email sent. Check your inbox for instructions.';
      this.toast.show('Email sent', 'Check your inbox for password reset instructions.', 'success');
    } catch (error: unknown) {
      this.errorMessage = (error as Error).message || 'Unable to send password reset email.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
