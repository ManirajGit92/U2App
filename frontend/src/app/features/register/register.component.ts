import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      <div class="auth-card glass-card">
        <h1>Create an account</h1>
        <p>Create your U2 Tools account to save data securely and manage access.</p>

        @if (errorMessage) {
          <div class="auth-alert error">{{ errorMessage }}</div>
        }

        <form class="auth-form" (ngSubmit)="register()">
          <div class="field-row">
            <label for="firstName">First Name</label>
            <input id="firstName" name="firstName" type="text" [(ngModel)]="firstName" required />
          </div>

          <div class="field-row">
            <label for="lastName">Last Name</label>
            <input id="lastName" name="lastName" type="text" [(ngModel)]="lastName" required />
          </div>

          <div class="field-row">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" [(ngModel)]="username" required />
          </div>

          <div class="field-row">
            <label for="email">Email address</label>
            <input id="email" name="email" type="email" [(ngModel)]="email" required />
          </div>

          <div class="field-row password-row">
            <label for="password">Password</label>
            <input
              id="password"
              name="password"
              [type]="showPassword ? 'text' : 'password'"
              [(ngModel)]="password"
              minlength="8"
              required
            />
            <button type="button" class="toggle-password" (click)="showPassword = !showPassword">
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>

          <div class="field-row">
            <label for="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              [type]="showPassword ? 'text' : 'password'"
              [(ngModel)]="confirmPassword"
              minlength="8"
              required
            />
          </div>

          <button class="btn btn-primary" type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'Creating account…' : 'Register' }}
          </button>
        </form>

        <p class="auth-footer">Already have an account? <a routerLink="/login">Sign in</a></p>
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
        width: min(480px, 100%);
        padding: 1.25rem;
        text-align: left;
      }
      .auth-card h1 {
        font-size: 1.8rem;
        margin-bottom: 0.25rem;
      }
      .auth-card p {
        margin-bottom: 1rem;
        color: var(--text-secondary);
      }
      .auth-form {
        display: grid;
        gap: 1rem;
      }
      .field-row {
        display: grid;
        gap: 0.5rem;
      }
      label {
        font-size: 0.9rem;
        font-weight: 700;
      }
      input {
        width: 100%;
        padding: 0.8rem 0.9rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .password-row {
        position: relative;
      }
      .toggle-password {
        position: absolute;
        top: 36px;
        right: 0.8rem;
        border: none;
        background: transparent;
        color: var(--accent-primary);
        cursor: pointer;
        font-weight: 700;
      }
      .auth-alert {
        padding: 0.85rem 1rem;
        border-radius: var(--radius-md);
        color: #fd5757;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
      }
      .btn {
        width: 100%;
      }
      .auth-footer {
        margin-top: 1rem;
        font-size: 0.9rem;
        text-align: center;
      }
    `,
  ],
})
export class RegisterComponent {
  private authService = inject(FirebaseAuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private toast = inject(ToastService);

  firstName = '';
  lastName = '';
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  isSubmitting = false;
  errorMessage: string | null = null;

  async register(): Promise<void> {
    this.errorMessage = null;
    const email = this.email.trim();
    const username = this.username.trim();
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();

    if (!firstName || !lastName || !email || !username || !this.password || !this.confirmPassword) {
      this.errorMessage = 'All fields are required.';
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isSubmitting = true;

    try {
      await this.authService.registerWithEmail({
        firstName,
        lastName,
        username,
        email,
        password: this.password,
      });

      this.toast.show('Success', 'Registration complete. You are now signed in.', 'success');
      await this.router.navigate(['/']);
    } catch (error: unknown) {
      this.errorMessage = (error as Error).message || 'Registration failed. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
