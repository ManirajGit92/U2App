import { Injectable, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { FirebaseAuthService } from './firebase-auth.service';
import { FirestoreService } from './firestore.service';
import { Subscription } from 'rxjs';

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncEntry {
  subscription?: Subscription;
  lastSyncedAt?: Date;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class FirebaseSyncService implements OnDestroy {
  private authService = inject(FirebaseAuthService);
  private firestoreService = inject(FirestoreService);

  /** Per-module sync state: key = appName */
  private syncRegistry = new Map<string, SyncEntry>();

  /** Global sync state signal. */
  readonly syncState = signal<SyncState>('offline');

  /** True while any sync operation is in progress. */
  readonly isSyncing = computed(() => this.syncState() === 'syncing');

  /** Error message if last sync failed. */
  readonly syncError = signal<string | null>(null);

  /** Track the current user UID to detect sign-in / sign-out. */
  private currentUid: string | null = null;

  /** Listeners to notify when auth state changes. */
  private authChangeCallbacks: Array<(uid: string | null) => void> = [];

  constructor() {
    // React to auth state changes
    effect(() => {
      const user = this.authService.user();
      const uid = user?.uid ?? null;

      if (uid !== this.currentUid) {
        this.currentUid = uid;
        this.syncState.set(uid ? 'idle' : 'offline');

        // Notify registered callbacks
        for (const cb of this.authChangeCallbacks) {
          try {
            cb(uid);
          } catch (e) {
            console.error('FirebaseSyncService: callback error', e);
          }
        }

        if (!uid) {
          this.teardownAllSubscriptions();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.teardownAllSubscriptions();
    this.authChangeCallbacks = [];
  }

  // ──────────────────────── Auth Helpers ───────────────────────

  /** Get the current user's UID, or null. */
  getUid(): string | null {
    return this.authService.user()?.uid ?? null;
  }

  /** Register a callback invoked when auth state changes. */
  onAuthChange(callback: (uid: string | null) => void): void {
    this.authChangeCallbacks.push(callback);
    // Fire immediately with current state
    callback(this.getUid());
  }

  // ─────────────────── Save User Profile ──────────────────────

  async saveUserProfile(): Promise<void> {
    const profile = this.authService.getUserProfile();
    if (!profile) return;

    try {
      const path = this.firestoreService.getUserProfilePath(profile.uid);
      await this.firestoreService.setDocument(path, {
        displayName: profile.displayName,
        email: profile.email,
        photoURL: profile.photoURL,
        provider: profile.provider,
        lastLogin: new Date().toISOString(),
      });
    } catch (e) {
      console.error('FirebaseSyncService: failed to save profile', e);
    }
  }

  // ──────────────────── Collection Sync ───────────────────────

  /**
   * Push an array of items to a Firestore collection under the user's
   * app namespace. This replaces the entire collection.
   */
  async pushToFirestore(
    appName: string,
    collectionName: string,
    items: Record<string, unknown>[]
  ): Promise<void> {
    const uid = this.getUid();
    if (!uid) return;

    this.syncState.set('syncing');
    this.syncError.set(null);

    try {
      const path = this.firestoreService.getUserCollectionPath(uid, appName, collectionName);
      await this.firestoreService.replaceCollection(path, items);

      this.updateRegistryEntry(appName, { lastSyncedAt: new Date(), error: undefined });
      this.syncState.set('idle');
    } catch (e) {
      const msg = (e as Error).message ?? 'Sync failed';
      this.syncError.set(msg);
      this.updateRegistryEntry(appName, { error: msg });
      this.syncState.set('error');
      console.error(`FirebaseSyncService: pushToFirestore(${appName}/${collectionName}) failed`, e);
    }
  }

  /**
   * Fetch all items from a Firestore collection under the user's
   * app namespace (one-time read).
   */
  async pullFromFirestore<T>(appName: string, collectionName: string): Promise<T[]> {
    const uid = this.getUid();
    if (!uid) return [];

    this.syncState.set('syncing');
    this.syncError.set(null);

    try {
      const path = this.firestoreService.getUserCollectionPath(uid, appName, collectionName);
      const items = await this.firestoreService.getCollection<T>(path);
      this.syncState.set('idle');
      return items;
    } catch (e) {
      const msg = (e as Error).message ?? 'Failed to load data';
      this.syncError.set(msg);
      this.syncState.set('error');
      console.error(`FirebaseSyncService: pullFromFirestore(${appName}/${collectionName}) failed`, e);
      return [];
    }
  }

  /**
   * Push a single document (e.g. app-level metadata or settings).
   */
  async pushDocumentToFirestore(
    appName: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const uid = this.getUid();
    if (!uid) return;

    try {
      const path = this.firestoreService.getUserAppPath(uid, appName);
      await this.firestoreService.setDocument(path, data);
    } catch (e) {
      console.error(`FirebaseSyncService: pushDocumentToFirestore(${appName}) failed`, e);
    }
  }

  // ──────────────────── Helpers ───────────────────────────────

  private updateRegistryEntry(appName: string, partial: Partial<SyncEntry>): void {
    const existing = this.syncRegistry.get(appName) ?? {};
    this.syncRegistry.set(appName, { ...existing, ...partial });
  }

  private teardownAllSubscriptions(): void {
    for (const [, entry] of this.syncRegistry) {
      entry.subscription?.unsubscribe();
    }
    this.syncRegistry.clear();
  }
}
