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

  private readonly storageKey = 'u2app.homeSlides';
  private slidesSubject = new BehaviorSubject<CarouselSlide[]>(this.loadLocalSlides());
  slides$ = this.slidesSubject.asObservable();

  constructor() {
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.loadFromFirestore();
      }
    });
  }

  get slides(): CarouselSlide[] {
    return this.slidesSubject.value;
  }

  updateSlides(slides: CarouselSlide[]) {
    const sorted = [...slides].sort((a, b) => a.displayOrder - b.displayOrder);
    this.slidesSubject.next(sorted);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(sorted));
    } catch (e) {
      console.error('Failed to save slides to localStorage', e);
    }
    this.syncToFirestore();
  }

  private loadLocalSlides(): CarouselSlide[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
    if (!this.authService.isAuthenticated()) return;
    try {
      const remoteSlides = await this.syncService.pullFromFirestore<CarouselSlide>(
        'home-carousel',
        'homeSlides'
      );
      if (remoteSlides && remoteSlides.length > 0) {
        const sorted = remoteSlides.sort((a, b) => a.displayOrder - b.displayOrder);
        this.slidesSubject.next(sorted);
        localStorage.setItem(this.storageKey, JSON.stringify(sorted));
      }
    } catch (e) {
      console.error('Failed to pull slides from Firestore', e);
    }
  }

  async syncAllToFirestore(): Promise<void> {
    await this.syncToFirestore();
  }
}
