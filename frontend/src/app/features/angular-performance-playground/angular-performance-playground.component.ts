import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  effect,
  ChangeDetectorRef,
  DoCheck,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, BehaviorSubject, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as XLSX from 'xlsx';

import { AngularPerformancePlaygroundService } from './angular-performance-playground.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { OptimizedTableComponent } from './components/optimized-table.component';
import { UnoptimizedTableComponent } from './components/unoptimized-table.component';

export interface OptimizationFlags {
  [key: string]: boolean;
  trackBy: boolean;
  changeDetectionOnPush: boolean;
  virtualScrolling: boolean;
  asyncPipe: boolean;
  purePipes: boolean;
  lazyLoading: boolean;
  debounceUserInput: boolean;
  angularSignals: boolean;
  cacheResponses: boolean;
  avoidTemplateFunctions: boolean;
  unsubscribeObservables: boolean;
}

@Component({
  selector: 'app-angular-performance-playground',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, FormsModule, OptimizedTableComponent, UnoptimizedTableComponent],
  templateUrl: './angular-performance-playground.component.html',
  styleUrl: './angular-performance-playground.component.scss',
})
export class AngularPerformancePlaygroundComponent implements OnInit, OnDestroy, DoCheck {
  public playgroundService = inject(AngularPerformancePlaygroundService);
  public syncService = inject(FirebaseSyncService);
  public authService = inject(FirebaseAuthService);
  private cdr = inject(ChangeDetectorRef);

  // ── Layout ──────────────────────────────────────────────────
  leftPanelExpanded = true;
  rightPanelExpanded = true;

  // ── File info ────────────────────────────────────────────────
  fileName = '';
  fileSize = 0;
  sheetNames: string[] = [];
  parsedSheets: { [sheetName: string]: any[] } = {};
  lazyArrayBuffer: ArrayBuffer | null = null;

  // ── Search & filter ──────────────────────────────────────────
  searchQueryRaw = '';
  columnFilters: { [colName: string]: string } = {};

  // ── Non-signal path state ────────────────────────────────────
  activeSheetNonSignal = '';
  searchQueryNonSignal = '';
  optimizationsNonSignal: OptimizationFlags = this.getDefaultFlags();
  columnsNonSignal: string[] = [];

  // ── Signal path state ────────────────────────────────────────
  activeSheetSignal = signal<string>('');
  searchQuerySignal = signal<string>('');
  optimizationsSignal = signal<OptimizationFlags>(this.getDefaultFlags());

  // ── Optimization list for UI ─────────────────────────────────
  optimizationList = [
    { key: 'trackBy', label: 'trackBy', desc: 'Avoids complete row re-rendering on updates' },
    {
      key: 'changeDetectionOnPush',
      label: 'ChangeDetectionStrategy.OnPush',
      desc: 'Checks view only when inputs update',
    },
    {
      key: 'virtualScrolling',
      label: 'Virtual Scrolling',
      desc: 'Renders only visible rows to protect DOM size',
    },
    {
      key: 'asyncPipe',
      label: 'Async Pipe',
      desc: 'Auto-manages change detection triggers',
    },
    { key: 'purePipes', label: 'Pure Pipes', desc: 'Caches calculation outputs per inputs' },
    {
      key: 'lazyLoading',
      label: 'Lazy Loading',
      desc: 'Defers sheet parsing until clicked',
    },
    {
      key: 'debounceUserInput',
      label: 'Debounce User Input',
      desc: 'Throttles search/filtering operations',
    },
    {
      key: 'angularSignals',
      label: 'Angular Signals',
      desc: 'Fine-grained state reactivity',
    },
    {
      key: 'cacheResponses',
      label: 'Cache Responses',
      desc: 'Locally caches database/filter queries',
    },
    {
      key: 'avoidTemplateFunctions',
      label: 'Avoid Template Functions',
      desc: 'Binds properties directly instead of functions',
    },
    {
      key: 'unsubscribeObservables',
      label: 'Unsubscribe Observables',
      desc: 'Frees active observers to prevent leaks',
    },
  ];

  // ── Debounce ─────────────────────────────────────────────────
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // ── Table stream ─────────────────────────────────────────────
  public tableRowsSubject = new BehaviorSubject<any[]>([]);
  public tableRows$: Observable<any[]> = this.tableRowsSubject.asObservable();

  // ── Metrics ──────────────────────────────────────────────────
  renderedRowsCount = 0;
  domNodeCount = 0;
  fps = 60;
  memoryLimit = 0;
  memoryTotal = 0;
  memoryUsed = 0;
  leakedSubscriptionsCount = 0;
  changeDetectionCyclesCount = 0;

  private fpsFrameId?: number;
  private lastFpsTimestamp = performance.now();
  private fpsFrameCount = 0;

  constructor() {
    // ── FIX: react to signal changes only when a sheet is actually loaded ──
    effect(() => {
      const sheet = this.activeSheetSignal();
      const query = this.searchQuerySignal();
      // Only run filtering if angularSignals is ON and a sheet has been selected
      if (this.optimizationsSignal().angularSignals && sheet) {
        this._doFilter();
      }
    });
  }

  ngOnInit() {
    this.startFpsLoop();
    this.setupSearchStream();
    this.playgroundService.resetMetrics();
  }

  ngDoCheck() {
    this.changeDetectionCyclesCount++;
    this.updateLiveMetrics();
  }

  ngOnDestroy() {
    if (this.fpsFrameId) cancelAnimationFrame(this.fpsFrameId);
    if (this.searchSub) this.searchSub.unsubscribe();
  }

  // ── Accessors ────────────────────────────────────────────────

  get currentOptimizations(): OptimizationFlags {
    return this.optimizationsSignal().angularSignals
      ? this.optimizationsSignal()
      : this.optimizationsNonSignal;
  }

  get currentActiveSheet(): string {
    return this.currentOptimizations.angularSignals
      ? this.activeSheetSignal()
      : this.activeSheetNonSignal;
  }

  get activeRows(): any[] {
    const active = this.currentActiveSheet;
    return active ? (this.parsedSheets[active] ?? []) : [];
  }

  get activeColumns(): string[] {
    const rows = this.activeRows;
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter((k) => k !== '_computed_val');
  }

  // ── Optimization toggles ─────────────────────────────────────

  getDefaultFlags(): OptimizationFlags {
    return {
      trackBy: true,
      changeDetectionOnPush: true,
      virtualScrolling: true,
      asyncPipe: true,
      purePipes: true,
      lazyLoading: true,
      debounceUserInput: true,
      angularSignals: true,
      cacheResponses: true,
      avoidTemplateFunctions: true,
      unsubscribeObservables: true,
    };
  }

  toggleAll(value: boolean) {
    const newFlags = { ...this.getDefaultFlags() };
    (Object.keys(newFlags) as (keyof OptimizationFlags)[]).forEach((k) => {
      newFlags[k] = value;
    });
    this.optimizationsSignal.set(newFlags);
    this.optimizationsNonSignal = { ...newFlags };
    this._triggerFilter();
  }

  toggleOptimization(key: string) {
    const current = this.optimizationsSignal();
    const updated: OptimizationFlags = { ...current, [key]: !current[key] };
    this.optimizationsSignal.set(updated);
    this.optimizationsNonSignal = { ...updated };
    this._triggerFilter();
  }

  // ── File loading ─────────────────────────────────────────────

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.fileName = file.name;
    this.fileSize = file.size;

    // Reset
    this.parsedSheets = {};
    this.lazyArrayBuffer = null;
    this.columnFilters = {};
    this.searchQueryRaw = '';
    this.searchQuerySignal.set('');
    this.searchQueryNonSignal = '';
    this.playgroundService.resetMetrics();
    UnoptimizedTableComponent.leakedSubscriptions = 0;
    this.tableRowsSubject.next([]); // clear stale data immediately

    try {
      const isLazy = this.currentOptimizations.lazyLoading;

      if (isLazy) {
        const metadata = await this.playgroundService.parseExcelLazily(file);
        this.sheetNames = metadata.sheetNames;
        this.lazyArrayBuffer = metadata.arrayBuffer;

        const firstSheet = metadata.activeSheet;
        if (firstSheet) {
          this.parsedSheets[firstSheet] = this.playgroundService.parseSingleSheet(
            this.lazyArrayBuffer!,
            firstSheet,
          );
          this.setSheet(firstSheet);
        }
      } else {
        const eagerData = await this.playgroundService.parseExcelEagerly(file);
        this.sheetNames = eagerData.sheetNames;
        this.parsedSheets = eagerData.sheets;
        this.setSheet(eagerData.activeSheet);
      }
    } catch (err) {
      console.error('Playground: Error parsing Excel file', err);
    } finally {
      input.value = '';
    }
  }

  setSheet(sheetName: string) {
    // Lazy-parse the sheet if needed
    if (
      this.currentOptimizations.lazyLoading &&
      !this.parsedSheets[sheetName] &&
      this.lazyArrayBuffer
    ) {
      this.parsedSheets[sheetName] = this.playgroundService.parseSingleSheet(
        this.lazyArrayBuffer,
        sheetName,
      );
    }

    // ── FIX: always push the data immediately regardless of signal path ──
    if (this.currentOptimizations.angularSignals) {
      this.activeSheetSignal.set(sheetName);
      // effect() will trigger _doFilter() because `sheet` changed
    } else {
      this.activeSheetNonSignal = sheetName;
      this.columnsNonSignal = this._colsFor(sheetName);
      this._doFilter();
    }
  }

  // ── Column filters ────────────────────────────────────────────

  getDistinctValues(colName: string): string[] {
    const rows = this.activeRows;
    const vals = new Set<string>();
    for (let i = 0; i < Math.min(rows.length, 2000); i++) {
      const cell = String(rows[i][colName] ?? '').trim();
      if (cell) vals.add(cell);
    }
    return Array.from(vals).slice(0, 50);
  }

  setColumnFilter(col: string, val: string) {
    this.columnFilters = { ...this.columnFilters, [col]: val };
    this._triggerFilter();
  }

  // ── Search ────────────────────────────────────────────────────

  onSearchInput(event: any) {
    const val: string = event.target.value;
    this.searchQueryRaw = val;

    if (this.currentOptimizations.debounceUserInput) {
      this.searchSubject.next(val);
    } else {
      this._setSearchQuery(val);
    }
  }

  setupSearchStream() {
    this.searchSub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((val) => this._setSearchQuery(val));
  }

  private _setSearchQuery(val: string) {
    if (this.currentOptimizations.angularSignals) {
      this.searchQuerySignal.set(val);
    } else {
      this.searchQueryNonSignal = val;
      this._doFilter();
    }
  }

  // ── Internal filtering ────────────────────────────────────────

  /** Trigger filter via the appropriate path */
  private _triggerFilter() {
    if (this.currentOptimizations.angularSignals) {
      // Touch the signal to re-run effect
      this.activeSheetSignal.set(this.activeSheetSignal());
    } else {
      this._doFilter();
    }
  }

  /** Core filter function – runs in both signal and non-signal paths */
  private _doFilter() {
    const sheet = this.currentOptimizations.angularSignals
      ? this.activeSheetSignal()
      : this.activeSheetNonSignal;

    const rawRows = sheet ? (this.parsedSheets[sheet] ?? []) : [];
    const cols = rawRows.length > 0 ? Object.keys(rawRows[0]).filter((k) => k !== '_computed_val') : [];
    const query = this.currentOptimizations.angularSignals
      ? this.searchQuerySignal()
      : this.searchQueryNonSignal;
    const useCache = this.currentOptimizations.cacheResponses;

    let filtered = this.playgroundService.searchRows(rawRows, query, this.columnFilters, useCache);

    if (this.currentOptimizations.avoidTemplateFunctions) {
      filtered = this._preCompute(filtered, cols);
    }

    // Always sync non-signal columns
    this.columnsNonSignal = cols;

    this.tableRowsSubject.next(filtered);
    this.cdr.markForCheck();
  }

  private _colsFor(sheetName: string): string[] {
    const rows = this.parsedSheets[sheetName] ?? [];
    return rows.length > 0 ? Object.keys(rows[0]).filter((k) => k !== '_computed_val') : [];
  }

  private _preCompute(rows: any[], columns: string[]): any[] {
    if (!rows.length || !columns.length) return rows;
    const col0 = columns[0];
    return rows.map((r) => {
      const val = r[col0];
      const num = typeof val === 'number' ? val : parseFloat(String(val ?? '')) || 0;
      let result = 0;
      for (let i = 0; i < 1500; i++) result += Math.sin(num + i) * Math.cos(num - i);
      r._computed_val = result.toFixed(2);
      return r;
    });
  }

  // ── Firebase actions ──────────────────────────────────────────

  async pushDataToFirebase() {
    if (this.activeRows.length === 0) return;
    try {
      await this.playgroundService.saveToFirebase(this.activeRows);
      alert('Active sheet data (first 1000 rows) pushed to Firebase!');
    } catch (e) {
      alert('Error pushing to Firestore: ' + (e as Error).message);
    }
  }

  async clearFirebaseData() {
    try {
      await this.playgroundService.clearFirebase();
      alert('Firebase Playground collection cleared.');
    } catch (e) {
      alert('Error clearing Firestore: ' + (e as Error).message);
    }
  }

  // ── Export ────────────────────────────────────────────────────

  exportCurrentData() {
    const items = this.tableRowsSubject.value;
    if (items.length === 0) {
      alert('No data to export.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, this.currentActiveSheet || 'Data');
    XLSX.writeFile(wb, `${this.currentActiveSheet || 'Playground'}_Export.xlsx`);
  }

  // ── Metrics ───────────────────────────────────────────────────

  startFpsLoop() {
    const tick = () => {
      this.fpsFrameCount++;
      const now = performance.now();
      if (now >= this.lastFpsTimestamp + 1000) {
        this.fps = Math.round((this.fpsFrameCount * 1000) / (now - this.lastFpsTimestamp));
        this.fpsFrameCount = 0;
        this.lastFpsTimestamp = now;
      }
      this.fpsFrameId = requestAnimationFrame(tick);
    };
    this.fpsFrameId = requestAnimationFrame(tick);
  }

  updateLiveMetrics() {
    this.renderedRowsCount = document.querySelectorAll('.playground-table-row').length;
    this.domNodeCount = document.getElementsByTagName('*').length;

    const mem = (performance as any).memory;
    if (mem) {
      this.memoryLimit = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
      this.memoryTotal = Math.round(mem.totalJSHeapSize / (1024 * 1024));
      this.memoryUsed = Math.round(mem.usedJSHeapSize / (1024 * 1024));
    }

    this.leakedSubscriptionsCount = UnoptimizedTableComponent.leakedSubscriptions;
  }
}
