import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavPreferencesService {
  private readonly orderKey = 'u2app.navOrder';
  private readonly visibilityKey = 'u2app.navVisibility';
  private readonly defaultToolOrder = [
    'standup-note',
    'work-tracker',
    'unit-test-tracker',
    'compare',
    'html-viewer',
    'estimator',
  ];

  order$ = new BehaviorSubject<string[]>(this.loadStoredOrder());
  visibility$ = new BehaviorSubject<Record<string, boolean>>(this.loadStoredVisibility());

  setOrder(order: string[]): void {
    this.order$.next([...order]);
    localStorage.setItem(this.orderKey, JSON.stringify(order));
  }

  setVisibility(visibility: Record<string, boolean>): void {
    this.visibility$.next({ ...visibility });
    localStorage.setItem(this.visibilityKey, JSON.stringify(visibility));
  }

  compareToolOrder(idA: string, idB: string, storedOrder: string[] = this.order$.value): number {
    const indexA = this.navIndex(idA, storedOrder);
    const indexB = this.navIndex(idB, storedOrder);
    return indexA - indexB;
  }

  private navIndex(id: string, storedOrder: string[]): number {
    const savedIndex = storedOrder.indexOf(id);
    if (savedIndex >= 0) {
      return savedIndex;
    }

    const defaultIndex = this.defaultToolOrder.indexOf(id);
    if (defaultIndex >= 0) {
      return defaultIndex;
    }

    return this.defaultToolOrder.length;
  }

  private loadStoredOrder(): string[] {
    try {
      const stored = localStorage.getItem(this.orderKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private loadStoredVisibility(): Record<string, boolean> {
    try {
      const stored = localStorage.getItem(this.visibilityKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
}
