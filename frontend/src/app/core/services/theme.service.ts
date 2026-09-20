import { Injectable, signal, computed, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';

export type Theme = 'dark' | 'light';
export type AppTheme = 'default' | 'jarvis';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private firestoreService = inject(FirestoreService);

  // ── Light / Dark toggle (unchanged) ──────────────────────────────
  private readonly STORAGE_KEY = 'u2app-theme';
  readonly theme = signal<Theme>(this.getInitialTheme());

  // ── App Theme (default / jarvis) ─────────────────────────────────
  private readonly APP_THEME_KEY = 'u2app-app-theme';
  readonly appTheme = signal<AppTheme>(this.getInitialAppTheme());

  /** True when J.A.R.V.I.S. theme is active */
  readonly isJarvis = computed(() => this.appTheme() === 'jarvis');

  constructor() {
    this.applyTheme(this.theme());
    this.applyAppTheme(this.appTheme());
  }

  // ── Light / Dark toggle ──────────────────────────────────────────

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.applyTheme(next);
    localStorage.setItem(this.STORAGE_KEY, next);
  }

  private getInitialTheme(): Theme {
    const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: Theme): void {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
  }

  // ── App Theme ────────────────────────────────────────────────────

  /** Apply a new app theme immediately, persist locally, and optionally sync. */
  setAppTheme(theme: AppTheme): void {
    this.appTheme.set(theme);
    this.applyAppTheme(theme);
    localStorage.setItem(this.APP_THEME_KEY, theme);
  }

  private getInitialAppTheme(): AppTheme {
    const stored = localStorage.getItem(this.APP_THEME_KEY) as AppTheme | null;
    if (stored === 'default' || stored === 'jarvis') return stored;
    return 'default';
  }

  private applyAppTheme(theme: AppTheme): void {
    document.body.classList.remove('theme-jarvis');
    if (theme === 'jarvis') {
      document.body.classList.add('theme-jarvis');
    }
  }

  // ── Firestore Sync ───────────────────────────────────────────────

  /**
   * Push the current app-theme preference to Firestore (under the user profile doc).
   * Silently ignores failures so the UI is never blocked.
   */
  async syncThemeToFirestore(uid: string): Promise<void> {
    if (!uid) return;
    try {
      const path = this.firestoreService.getUserProfilePath(uid);
      await this.firestoreService.setDocument(path, { appTheme: this.appTheme() });
    } catch (e) {
      console.warn('ThemeService: failed to sync theme to Firestore', e);
    }
  }

  /**
   * Load the app-theme preference from Firestore and apply it.
   * Falls back to the locally stored value if the read fails or the field is absent.
   */
  async loadThemeFromFirestore(uid: string): Promise<void> {
    if (!uid) return;
    try {
      const path = this.firestoreService.getUserProfilePath(uid);
      const doc = await this.firestoreService.getDocument<{ appTheme?: AppTheme }>(path);
      if (doc?.appTheme === 'jarvis' || doc?.appTheme === 'default') {
        this.setAppTheme(doc.appTheme);
      }
    } catch (e) {
      console.warn('ThemeService: failed to load theme from Firestore, using localStorage', e);
    }
  }
}
