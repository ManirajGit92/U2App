import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import {
  Auth,
  User,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  Unsubscribe,
} from '@angular/fire/auth';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  provider: string;
}

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService implements OnDestroy {
  private auth = inject(Auth);
  private unsubscribeAuth: Unsubscribe;

  /** Current Firebase user (null when signed out). */
  readonly user = signal<User | null>(null);

  /** True once the initial auth state has been resolved. */
  readonly isReady = signal(false);

  /** True while a sign-in / sign-out operation is in progress. */
  readonly isLoading = signal(false);

  /** Last auth error message for display in the UI. */
  readonly errorMessage = signal<string | null>(null);

  /** Convenience computed: is a user currently authenticated? */
  readonly isAuthenticated = computed(() => !!this.user());

  constructor() {
    this.unsubscribeAuth = onAuthStateChanged(
      this.auth,
      (firebaseUser) => {
        this.user.set(firebaseUser);
        this.isReady.set(true);
      },
      (error) => {
        console.error('FirebaseAuthService: Auth state error', error);
        this.isReady.set(true);
      }
    );
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth();
  }

  // ──────────────────────────────── Sign-In ────────────────────────────────

  async signInWithGoogle(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      await signInWithPopup(this.auth, provider);
    } catch (error: unknown) {
      this.errorMessage.set(this.humaniseError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async signInWithMicrosoft(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const provider = new OAuthProvider('microsoft.com');
      provider.addScope('User.Read');
      await signInWithPopup(this.auth, provider);
    } catch (error: unknown) {
      this.errorMessage.set(this.humaniseError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  // ──────────────────────────────── Sign-Out ───────────────────────────────

  async signOutUser(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await signOut(this.auth);
      this.user.set(null);
    } catch (error: unknown) {
      this.errorMessage.set(this.humaniseError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  // ──────────────────────────────── Helpers ────────────────────────────────

  /** Returns a simple profile DTO from the current Firebase user. */
  getUserProfile(): UserProfile | null {
    const u = this.user();
    if (!u) return null;
    return {
      uid: u.uid,
      displayName: u.displayName,
      email: u.email,
      photoURL: u.photoURL,
      provider: u.providerData?.[0]?.providerId ?? 'unknown',
    };
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  /** Map Firebase error codes to user-friendly strings. */
  private humaniseError(error: unknown): string {
    const code = (error as { code?: string })?.code ?? '';
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed. Please try again.';
      case 'auth/cancelled-popup-request':
        return 'Another sign-in popup is already open.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with the same email. Try a different sign-in method.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorised for sign-in. Contact support.';
      default:
        return (error as Error)?.message ?? 'An unexpected error occurred.';
    }
  }
}
