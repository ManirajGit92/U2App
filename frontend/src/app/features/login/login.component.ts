import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);
  private router = inject(Router);

  async handleGoogleSignIn(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
    } catch {
      // error is surfaced through authService.errorMessage
    }
  }

  email = '';
  password = '';

  async signInWithEmail(): Promise<void> {
    if (!this.email.trim() || !this.password.trim()) {
      return;
    }

    try {
      await this.authService.signInWithEmail(this.email.trim(), this.password);
      if (this.authService.isAuthenticated()) {
        await this.syncService.saveUserProfile();
        this.router.navigate(['/']);
      }
    } catch {
      // error is shown by authService.errorMessage
    }
  }

  async handleMicrosoftSignIn(): Promise<void> {
    try {
      await this.authService.signInWithMicrosoft();
    } catch {
      // error is surfaced through authService.errorMessage
    }
  }

  skipLogin(): void {
    this.router.navigate(['/']);
  }
}
