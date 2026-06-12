import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseAuthService } from './firebase-auth.service';
import { FirebaseSyncService } from './firebase-sync.service';

export interface SlideStat {
  number: string;
  label: string;
}

export interface CarouselSlide {
  id: string;
  bgImage?: string;
  badgeText: string;
  title: string;
  description: string;
  primaryBtnText: string;
  primaryBtnRoute: string;
  secondaryBtnText: string;
  secondaryBtnRoute: string;
  statistics?: SlideStat[];
  displayOrder: number;
  isActive: boolean;
  overlayType?: 'none' | 'dark' | 'light';
  overlayOpacity?: number;
  duration?: number;
}

export const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    id: 'default-slide-1',
    bgImage: '',
    badgeText: '⚡ Multi-Purpose Toolkit',
    title: 'All Your <span class="gradient-text">Developer Tools</span><br />In One Place',
    description: 'Compare text, process images, create content, and more — powerful utilities designed for developers and creators.',
    primaryBtnText: 'Get Started',
    primaryBtnRoute: '/excel-mapper',
    secondaryBtnText: 'Explore Tools',
    secondaryBtnRoute: '#tools',
    statistics: [
      { number: '20+', label: 'Tools' },
      { number: 'Free', label: 'To Use' },
      { number: 'Fast', label: '& Secure' }
    ],
    displayOrder: 1,
    isActive: true,
    overlayType: 'none',
    overlayOpacity: 75,
    duration: 6
  }
];

@Injectable({ providedIn: 'root' })
export class HomeCarouselService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  private getStorageKey(uid?: string | null): string {
    const activeUid = uid || this.authService.user()?.uid;
    return activeUid ? `u2app.homeSlides.${activeUid}` : 'u2app.homeSlides';
  }

  private slidesSubject = new BehaviorSubject<CarouselSlide[]>([]);
  slides$ = this.slidesSubject.asObservable();

  constructor() {
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        // User signed in (or switched): load local cache first, then fetch from Firestore
        const local = this.loadLocalSlides(uid);
        this.slidesSubject.next(local);
        this.loadFromFirestore();
      } else {
        // User signed out: revert to DEFAULT_SLIDES
        this.slidesSubject.next([...DEFAULT_SLIDES]);
      }
    });
  }

  get slides(): CarouselSlide[] {
    return this.slidesSubject.value;
  }

  updateSlides(slides: CarouselSlide[]) {
    const sorted = [...slides].sort((a, b) => a.displayOrder - b.displayOrder);
    this.slidesSubject.next(sorted);
    
    const uid = this.authService.user()?.uid;
    const key = this.getStorageKey(uid);
    try {
      localStorage.setItem(key, JSON.stringify(sorted));
    } catch (e) {
      console.error('Failed to save slides to localStorage', e);
    }
    this.syncToFirestore();
  }

  private loadLocalSlides(uid?: string | null): CarouselSlide[] {
    try {
      const key = this.getStorageKey(uid);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.sort((a, b) => a.displayOrder - b.displayOrder);
        }
      }
    } catch (e) {
      console.error('Error loading local slides', e);
    }
    return [...DEFAULT_SLIDES];
  }

  private async syncToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      await this.syncService.pushToFirestore(
        'home-carousel',
        'homeSlides',
        this.slides as unknown as Record<string, unknown>[]
      );
    } catch (e) {
      console.error('Failed to sync slides to Firestore', e);
    }
  }

  async loadFromFirestore(): Promise<void> {
    const uid = this.authService.user()?.uid;
    if (!uid) return;
    try {
      const remoteSlides = await this.syncService.pullFromFirestore<CarouselSlide>(
        'home-carousel',
        'homeSlides'
      );
      if (remoteSlides && remoteSlides.length > 0) {
        const sorted = remoteSlides.sort((a, b) => a.displayOrder - b.displayOrder);
        this.slidesSubject.next(sorted);
        localStorage.setItem(this.getStorageKey(uid), JSON.stringify(sorted));
      } else if (this.syncService.syncState() !== 'error') {
        // No remote slides found (meaning either a new user or they cleared all slides)
        // Set the slides to empty and save it so they fall back to DEFAULT_SLIDES
        this.slidesSubject.next([]);
        localStorage.setItem(this.getStorageKey(uid), JSON.stringify([]));
      }
    } catch (e) {
      console.error('Failed to pull slides from Firestore', e);
    }
  }

  async syncAllToFirestore(): Promise<void> {
    await this.syncToFirestore();
  }
}
