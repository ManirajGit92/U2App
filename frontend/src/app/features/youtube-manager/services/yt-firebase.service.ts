import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, Subscription, combineLatest } from 'rxjs';
import { debounceTime, skip, takeUntil } from 'rxjs/operators';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirestoreService } from '../../../core/services/firestore.service';
import { YouTubeStateService } from './yt-state.service';
import { YouTubeVideoData, CustomFieldDefinition } from '../models/youtube.models';

@Injectable({
  providedIn: 'root'
})
export class YouTubeFirebaseService {
  private authService = inject(FirebaseAuthService);
  private firestoreService = inject(FirestoreService);
  private state = inject(YouTubeStateService);

  private autoSyncSub: Subscription | null = null;
  private destroy$ = new Subject<void>();
  
  // Track if we are currently loading/restoring to avoid write loops
  private isRestoring = false;

  // Signal or boolean for automatic sync enabled
  private autoSyncEnabled = true;

  constructor() {
    // Listen to authentication changes
    toObservable(this.authService.user)
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          // Automatically restore data on sign in
          this.restoreFromCloud().then(() => {
            if (this.autoSyncEnabled) {
              this.startAutoSync();
            }
          });
        } else {
          this.stopAutoSync();
        }
      });

    // Load auto sync preference from localStorage
    const savedPref = localStorage.getItem('youtube-manager-auto-sync');
    if (savedPref !== null) {
      this.autoSyncEnabled = JSON.parse(savedPref);
    }
  }

  isLoggedIn(): boolean {
    return !!this.authService.user();
  }

  getAutoSyncEnabled(): boolean {
    return this.autoSyncEnabled;
  }

  setAutoSyncEnabled(enabled: boolean) {
    this.autoSyncEnabled = enabled;
    localStorage.setItem('youtube-manager-auto-sync', JSON.stringify(enabled));
    if (enabled && this.isLoggedIn()) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  async syncToCloud(): Promise<void> {
    const user = this.authService.user();
    if (!user) throw new Error('User not authenticated.');

    const uid = user.uid;
    const appName = 'youtube-manager';

    try {
      // 1. Sync videos (replace collection)
      const videosPath = this.firestoreService.getUserCollectionPath(uid, appName, 'videos');
      const videosData = this.state.videos.map(v => ({ ...v }));
      await this.firestoreService.replaceCollection(videosPath, videosData);

      // 2. Sync metadata/settings (categories, customFieldDefs)
      const metadataPath = this.firestoreService.getUserAppPath(uid, appName);
      const metadata = {
        categories: this.state.categories,
        customFieldDefs: this.state.customFieldDefs,
        lastSyncedAt: new Date().toISOString()
      };
      await this.firestoreService.setDocument(metadataPath, metadata);
    } catch (error) {
      console.error('YouTube sync to cloud failed:', error);
      throw error;
    }
  }

  async restoreFromCloud(): Promise<void> {
    const user = this.authService.user();
    if (!user) return;

    this.isRestoring = true;
    const uid = user.uid;
    const appName = 'youtube-manager';

    try {
      // 1. Pull metadata (settings)
      const metadataPath = this.firestoreService.getUserAppPath(uid, appName);
      const metadata = await this.firestoreService.getDocument<any>(metadataPath);
      
      if (metadata) {
        if (Array.isArray(metadata.categories)) {
          // Initialize categories in state
          // First clear old and add new
          metadata.categories.forEach((cat: string) => this.state.addCategory(cat));
        }
        if (Array.isArray(metadata.customFieldDefs)) {
          // Sync field definitions
          metadata.customFieldDefs.forEach((def: CustomFieldDefinition) => {
            if (!this.state.customFieldDefs.find(d => d.id === def.id)) {
              this.state.addCustomFieldDef(def);
            }
          });
        }
      }

      // 2. Pull videos collection
      const videosPath = this.firestoreService.getUserCollectionPath(uid, appName, 'videos');
      const cloudVideos = await this.firestoreService.getCollection<YouTubeVideoData>(videosPath);

      if (cloudVideos && cloudVideos.length > 0) {
        // Strip the Firestore auto-added id if it conflicts or keep YouTubeVideoData id
        const sanitizedVids = cloudVideos.map((cv: any) => {
          // If firestore added its own id field but the model uses cv.id as YT-xxx, ensure we keep the correct one
          const { id, ...rest } = cv;
          // In FirestoreService getCollection, it maps id as document ID.
          // Since our video objects have their own IDs, they might be stored inside the document or mapped as document ID.
          // Let's ensure id is set correctly
          return {
            ...rest,
            id: rest.id || id
          } as YouTubeVideoData;
        });

        // Initialize state with cloud videos
        this.state.initializeVideos(sanitizedVids);
      }
    } catch (error) {
      console.error('YouTube restore from cloud failed:', error);
    } finally {
      this.isRestoring = false;
    }
  }

  private startAutoSync() {
    this.stopAutoSync();

    // Skip the first emission to avoid syncing back the initial load/restore values immediately
    this.autoSyncSub = combineLatest([
      this.state.videos$,
      this.state.categories$,
      this.state.customFieldDefs$
    ]).pipe(
      skip(1),
      debounceTime(2000), // 2 seconds debounce to prevent spamming Firestore
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (!this.isRestoring && this.isLoggedIn()) {
        this.syncToCloud().catch(err => console.error('Auto sync failed:', err));
      }
    });
  }

  private stopAutoSync() {
    if (this.autoSyncSub) {
      this.autoSyncSub.unsubscribe();
      this.autoSyncSub = null;
    }
  }
}
