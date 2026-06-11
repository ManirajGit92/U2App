import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import {
  Auth,
  User,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  Unsubscribe,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from '@angular/fire/auth';
import { FirestoreService } from './firestore.service';
import { UserService, AppUser } from './user.service';

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
  private firestoreService = inject(FirestoreService);
  private userService = inject(UserService);
  private unsubscribeAuth: Unsubscribe;

  readonly user = signal<User | null>(null);
  readonly userDoc = signal<AppUser | null>(null);
  readonly isReady = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isAuthenticated = computed(() => !!this.user());
  readonly isAdmin = computed(() => {
    const email = this.user()?.email;
    return this.userService.isAdminEmail(email) || this.userDoc()?.isAdmin === true;
  });
  readonly hasFirestoreAccess = computed(
    () => this.userDoc()?.firestoreAccess === true && this.userDoc()?.active === true,
  );
  readonly isActive = computed(
    () => this.userDoc()?.active === true && this.userDoc()?.accountStatus === 'Active',
  );

  constructor() {
    this.unsubscribeAuth = onAuthStateChanged(
      this.auth,
      (firebaseUser) => {
        this.user.set(firebaseUser);
        this.isReady.set(true);

        if (firebaseUser) {
          this.loadUserDocument(firebaseUser.uid).catch((error) => {
            console.error('FirebaseAuthService: failed to load user document', error);
          });
        } else {
          this.userDoc.set(null);
        }
      },
      (error) => {
        console.error('FirebaseAuthService: Auth state error', error);
        this.isReady.set(true);
      },
    );

    this.handleRedirectResult();
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth();
  }

  async registerWithEmail(options: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
  }): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        options.email,
        options.password,
      );

      await this.ensureUserDocument(userCredential.user, {
        firstName: options.firstName,
        lastName: options.lastName,
        username: options.username,
      });
    } catch (error: unknown) {
      this.errorMessage.set(this.humaniseError(error));
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error: unknown) {
      this.errorMessage.set(this.humaniseError(error));
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    this.errorMessage.set(null);
    await sendPasswordResetEmail(this.auth, email);
  }

  async signInWithGoogle(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      try {
        await signInWithPopup(this.auth, provider);
      } catch (popupError: unknown) {
        const popupCode = (popupError as { code?: string })?.code;
        const popupMessage = (popupError as Error)?.message ?? '';
        const shouldFallbackToRedirect =
          popupCode !== 'auth/popup-closed-by-user' &&
          (popupCode === 'auth/popup-blocked' ||
            popupCode === 'auth/cancelled-popup-request' ||
            popupMessage.includes('Cross-Origin-Opener-Policy') ||
            popupMessage.includes('window.closed'));

        if (shouldFallbackToRedirect) {
          console.warn(
            'FirebaseAuthService: Popup auth failed, falling back to redirect.',
            popupError,
          );
          await signInWithRedirect(this.auth, provider);
          return;
        }
        throw popupError;
      }
    } catch (error: unknown) {
      console.error('FirebaseAuthService: Google sign-in failed', error);
      this.errorMessage.set(this.humaniseError(error));
      throw error;
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
      await signInWithRedirect(this.auth, provider);
    } catch (error: unknown) {
      console.error('FirebaseAuthService: Microsoft sign-in redirect failed', error);
      this.errorMessage.set(this.humaniseError(error));
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async signOutUser(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await signOut(this.auth);
      this.user.set(null);
      this.userDoc.set(null);
    } catch (error: unknown) {
      this.errorMessage.set(this.humaniseError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async ensureUserDocument(
    user: User,
    extra?: {
      firstName?: string;
      lastName?: string;
      username?: string;
    },
  ): Promise<void> {
    const path = this.firestoreService.getUserProfilePath(user.uid);
    const existingUser = await this.firestoreService.getDocument<AppUser>(path);
    const email = user.email ?? '';
    const provider = user.providerData?.[0]?.providerId ?? 'password';
    const profile: AppUser = {
      uid: user.uid,
      email,
      displayName:
        (user.displayName ?? `${extra?.firstName ?? ''} ${extra?.lastName ?? ''}`.trim()) || null,
      photoURL: user.photoURL ?? null,
      provider,
      username: extra?.username ?? existingUser?.username ?? email.split('@')[0],
      firstName: extra?.firstName ?? existingUser?.firstName ?? null,
      lastName: extra?.lastName ?? existingUser?.lastName ?? null,
      active: existingUser?.active ?? true,
      firestoreAccess: existingUser?.firestoreAccess ?? true,
      accountStatus: existingUser?.accountStatus ?? 'Active',
      isAdmin: existingUser?.isAdmin ?? this.userService.isAdminEmail(email),
      createdAt: existingUser?.createdAt ?? new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    await this.firestoreService.setDocument(path, profile);
    this.userDoc.set(profile);
  }

  async loadUserDocument(uid: string): Promise<void> {
    const profile = await this.firestoreService.getDocument<AppUser>(
      this.firestoreService.getUserProfilePath(uid),
    );
    this.userDoc.set(profile);
  }

  private async handleRedirectResult(): Promise<void> {
    try {
      const credential = await getRedirectResult(this.auth);
      if (credential && credential.user) {
        console.log('FirebaseAuthService: Redirect sign-in returned user', credential.user.uid);
        await this.ensureUserDocument(credential.user);
      }
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== 'auth/no-auth-event') {
        console.error('FirebaseAuthService: redirect sign-in error', error);
        this.errorMessage.set(this.humaniseError(error));
      }
    }
  }

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
      case 'auth/email-already-in-use':
        return 'This email is already registered. Try signing in or use another email.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/wrong-password':
        return 'The email or password is incorrect.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 8 characters.';
      default:
        return (error as Error)?.message ?? 'An unexpected error occurred.';
    }
  }
}
