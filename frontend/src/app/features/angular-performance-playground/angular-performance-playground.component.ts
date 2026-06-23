import { Component, OnInit, OnDestroy, inject, signal, computed, effect, ChangeDetectorRef, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, BehaviorSubject, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as XLSX from 'xlsx';

import { AngularPerformancePlaygroundService, PerformancePlaygroundState } from './angular-performance-playground.service';
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
  imports: [
    CommonModule,
    FormsModule,
    OptimizedTableComponent,
    UnoptimizedTableComponent
  ],
  templateUrl: './angular-performance-playground.component.html',
  styleUrl: './angular-performance-playground.component.scss'
})
export class AngularPerformancePlaygroundComponent implements OnInit, OnDestroy, DoCheck {
  public playgroundService = inject(AngularPerformancePlaygroundService);
  public syncService = inject(FirebaseSyncService);
  public authService = inject(FirebaseAuthService);
  private cdr = inject(ChangeDetectorRef);

  // Layout states
  leftPanelExpanded = true;
  rightPanelExpanded = true;

  // Active file info
  fileName = '';
  fileSize = 0;
  sheetNames: string[] = [];
  
  // Storage for sheet data
  // Key: sheetName, Value: rows
  parsedSheets: { [sheetName: string]: any[] } = {};
  lazyArrayBuffer: ArrayBuffer | null = null;

  // Search and column filtering states
  searchQueryRaw = '';
  columnFilters: { [colName: string]: string } = {};

  // Standard non-signal reactivity variables (used when signals flag is off)
  activeSheetNonSignal = '';
  searchQueryNonSignal = '';
  optimizationsNonSignal: OptimizationFlags = this.getDefaultFlags();
  filteredRowsNonSignal: any[] = [];
  columnsNonSignal: string[] = [];

  // Signal reactivity states (used when signals flag is on)
  activeSheetSignal = signal<string>('');
  searchQuerySignal = signal<string>('');
  optimizationsSignal = signal<OptimizationFlags>(this.getDefaultFlags());
  
  // List of optimizations configured
  optimizationList = [
    { key: 'trackBy', label: 'trackBy', desc: 'Avoids complete row re-rendering on updates' },
    { key: 'changeDetectionOnPush', label: 'ChangeDetectionStrategy.OnPush', desc: 'Checks view only when inputs update' },
    { key: 'virtualScrolling', label: 'Virtual Scrolling', desc: 'Renders only visible rows to protect DOM size' },
    { key: 'asyncPipe', label: 'Async Pipe', desc: 'Auto-manages change detection triggers' },
    { key: 'purePipes', label: 'Pure Pipes', desc: 'Caches calculation outputs per inputs' },
    { key: 'lazyLoading', label: 'Lazy Loading', desc: 'Defers sheet parsing until clicked' },
    { key: 'debounceUserInput', label: 'Debounce User Input', desc: 'Throttles search/filtering operations' },
    { key: 'angularSignals', label: 'Angular Signals', desc: 'Fine-grained state reactivity' },
    { key: 'cacheResponses', label: 'Cache Responses', desc: 'Locally caches database/filter queries' },
    { key: 'avoidTemplateFunctions', label: 'Avoid Template Functions', desc: 'Binds properties directly instead of functions' },
    { key: 'unsubscribeObservables', label: 'Unsubscribe Observables', desc: 'Frees active observers to prevent leaks' }
  ];

  // Debouncing RxJS Subject
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // Observable for table rendering
  public tableRowsSubject = new BehaviorSubject<any[]>([]);
  public tableRows$: Observable<any[]> = this.tableRowsSubject.asObservable();

  // Metrics trackers
  renderedRowsCount = 0;
  domNodeCount = 0;
  fps = 60;
  memoryLimit = 0;
  memoryTotal = 0;
  memoryUsed = 0;
  leakedSubscriptionsCount = 0;

  // FPS ticker loop
  private fpsFrameId?: number;
  private lastFpsTimestamp = performance.now();
  private fpsFrameCount = 0;

  // Keep track of change detection loops
  changeDetectionCyclesCount = 0;

  constructor() {
    // Signals-based computed values: automatically resolves filtered rows when signals are updated
    effect(() => {
      if (this.currentOptimizations.angularSignals) {
        this.runSignalsFiltering();
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
    if (this.fpsFrameId) {
      cancelAnimationFrame(this.fpsFrameId);
    }
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  // Get active configurations based on Signals flag
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

  get currentSearchQuery(): string {
    return this.currentOptimizations.angularSignals 
      ? this.searchQuerySignal() 
      : this.searchQueryNonSignal;
  }

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
      unsubscribeObservables: true
    };
  }

  toggleAll(value: boolean) {
    const newFlags = this.getDefaultFlags();
    Object.keys(newFlags).forEach(k => {
      (newFlags as any)[k] = value;
    });

    if (newFlags.angularSignals) {
      this.optimizationsSignal.set(newFlags);
    }
    this.optimizationsNonSignal = newFlags;

    if (!newFlags.angularSignals) {
      this.runNonSignalsFiltering();
    }
  }

  toggleOptimization(key: string) {
    const isSignalsActive = this.currentOptimizations.angularSignals;
    
    if (isSignalsActive) {
      const current = this.optimizationsSignal();
      const updated = { ...current, [key]: !(current as any)[key] };
      this.optimizationsSignal.set(updated);
      
      // Sync non-signal flags in case user toggles signals flag off later
      this.optimizationsNonSignal = updated;
    } else {
      (this.optimizationsNonSignal as any)[key] = !(this.optimizationsNonSignal as any)[key];
      // Sync signal flags
      this.optimizationsSignal.set({ ...this.optimizationsNonSignal });
      this.runNonSignalsFiltering();
    }
  }

  // File loading handling
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.fileName = file.name;
    this.fileSize = file.size;

    // Reset components & states
    this.parsedSheets = {};
    this.lazyArrayBuffer = null;
    this.playgroundService.resetMetrics();
    UnoptimizedTableComponent.leakedSubscriptions = 0;
    this.columnFilters = {};

    try {
      const isLazy = this.currentOptimizations.lazyLoading;
      
      if (isLazy) {
        // Optimized Lazy Loading: Load sheet metadata first
        const metadata = await this.playgroundService.parseExcelLazily(file);
        this.sheetNames = metadata.sheetNames;
        this.lazyArrayBuffer = metadata.arrayBuffer;
        
        // Parse only the first sheet to start
        const firstSheet = metadata.activeSheet;
        if (firstSheet) {
          this.parsedSheets[firstSheet] = this.playgroundService.parseSingleSheet(this.lazyArrayBuffer!, firstSheet);
          this.setSheet(firstSheet);
        }
      } else {
        // Unoptimized Eager Loading: Parse everything immediately
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
    // Check if lazy parsing is needed
    if (this.currentOptimizations.lazyLoading && !this.parsedSheets[sheetName] && this.lazyArrayBuffer) {
      this.parsedSheets[sheetName] = this.playgroundService.parseSingleSheet(this.lazyArrayBuffer, sheetName);
    }

    if (this.currentOptimizations.angularSignals) {
      this.activeSheetSignal.set(sheetName);
    } else {
      this.activeSheetNonSignal = sheetName;
      this.runNonSignalsFiltering();
    }
  }

  // Pre-calculate computed formatting to avoid template function bottlenecks
  preComputeTemplateFields(rows: any[], columns: string[]): any[] {
    if (!rows.length || !columns.length) return rows;
    const col0 = columns[0];
    return rows.map(r => {
      const val = r[col0];
      if (val === null || val === undefined) {
        r._computed_val = '';
      } else {
        const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        let result = 0;
        for (let i = 0; i < 1500; i++) {
          result += Math.sin(num + i) * Math.cos(num - i);
        }
        r._computed_val = result.toFixed(2);
      }
      return r;
    });
  }

  // Retrieve active sheet rows
  get activeRows(): any[] {
    const active = this.currentActiveSheet;
    return this.parsedSheets[active] || [];
  }

  // Retrieve columns for the active sheet
  get activeColumns(): string[] {
    const rows = this.activeRows;
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter(k => k !== '_computed_val');
  }

  // Distinct values for select dropdowns
  getDistinctValues(colName: string): string[] {
    const rows = this.activeRows;
    const vals = new Set<string>();
    for (let i = 0; i < Math.min(rows.length, 1000); i++) {
      const cell = String(rows[i][colName] ?? '').trim();
      if (cell) vals.add(cell);
    }
    return Array.from(vals).slice(0, 50); // limit to 50 items for user ease of review
  }

  setColumnFilter(col: string, val: string) {
    this.columnFilters[col] = val;
    if (this.currentOptimizations.angularSignals) {
      // Signals: trigger recalculation by updating signal state dummy trigger
      this.activeSheetSignal.set(this.activeSheetSignal());
    } else {
      this.runNonSignalsFiltering();
    }
  }

  // Global search input event handler
  onSearchInput(event: any) {
    const val = event.target.value;
    this.searchQueryRaw = val;

    if (this.currentOptimizations.debounceUserInput) {
      this.searchSubject.next(val);
    } else {
      this.executeSearch(val);
    }
  }

  setupSearchStream() {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(val => {
      this.executeSearch(val);
    });
  }

  executeSearch(val: string) {
    if (this.currentOptimizations.angularSignals) {
      this.searchQuerySignal.set(val);
    } else {
      this.searchQueryNonSignal = val;
      this.runNonSignalsFiltering();
    }
  }

  // Filtering calculations
  runSignalsFiltering() {
    const rawRows = this.activeRows;
    const cols = this.activeColumns;
    const query = this.searchQuerySignal();
    const useCache = this.currentOptimizations.cacheResponses;

    let filtered = this.playgroundService.searchRows(rawRows, query, this.columnFilters, useCache);
    
    if (this.currentOptimizations.avoidTemplateFunctions) {
      filtered = this.preComputeTemplateFields(filtered, cols);
    }

    this.tableRowsSubject.next(filtered);
    this.cdr.markForCheck();
  }

  runNonSignalsFiltering() {
    const rawRows = this.activeRows;
    const cols = this.activeColumns;
    const query = this.searchQueryNonSignal;
    const useCache = this.currentOptimizations.cacheResponses;

    let filtered = this.playgroundService.searchRows(rawRows, query, this.columnFilters, useCache);
    
    if (this.optimizationsNonSignal.avoidTemplateFunctions) {
      filtered = this.preComputeTemplateFields(filtered, cols);
    }

    this.filteredRowsNonSignal = filtered;
    this.columnsNonSignal = cols;
    this.tableRowsSubject.next(filtered);
    this.cdr.detectChanges();
  }

  // Firestore Sync Button Actions
  async pushDataToFirebase() {
    if (this.activeRows.length === 0) return;
    try {
      await this.playgroundService.saveToFirebase(this.activeRows);
      alert('Active sheet data sample (first 1000 items) successfully pushed to Firebase!');
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

  // Excel Export Actions
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

  // Live Performance Metrics Gathering
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
    // 1. Rendered Rows in DOM
    this.renderedRowsCount = document.querySelectorAll('.playground-table-row').length;

    // 2. DOM node counts
    this.domNodeCount = document.getElementsByTagName('*').length;

    // 3. Memory metrics
    const mem = (performance as any).memory;
    if (mem) {
      this.memoryLimit = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
      this.memoryTotal = Math.round(mem.totalJSHeapSize / (1024 * 1024));
      this.memoryUsed = Math.round(mem.usedJSHeapSize / (1024 * 1024));
    }

    // 4. Leaked Subscriptions count
    this.leakedSubscriptionsCount = UnoptimizedTableComponent.leakedSubscriptions;
  }
}
