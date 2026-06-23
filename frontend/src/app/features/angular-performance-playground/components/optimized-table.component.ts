import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, SimpleChanges, OnChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Observable, Subscription } from 'rxjs';
import { HeavyCalcPipe } from '../pipes/heavy-calc.pipe';

@Component({
  selector: 'app-optimized-table',
  standalone: true,
  imports: [CommonModule, ScrollingModule, HeavyCalcPipe],
  template: `
    <div class="table-container">
      <!-- Flex Header -->
      <div class="table-header">
        <div class="table-cell index-col">#</div>
        <div *ngFor="let col of columns" class="table-header-cell">{{ col }}</div>
        <div class="table-header-cell action-col">Computed Val</div>
      </div>

      <!-- Table Body -->
      <div class="table-body">
        <!-- Case 1: Virtual Scroll Enabled -->
        <ng-container *ngIf="optimizations.virtualScrolling">
          <cdk-virtual-scroll-viewport itemSize="42" class="viewport">
            <div *cdkVirtualFor="let row of displayRows; let i = index; trackBy: trackByFn" class="table-row playground-table-row">
              <div class="table-cell index-col">{{ i + 1 }}</div>
              <div *ngFor="let col of columns" class="table-cell" [title]="row[col]">{{ row[col] }}</div>
              
              <!-- Value Formatting Comparison -->
              <div class="table-cell action-col">
                <ng-container *ngIf="optimizations.purePipes">
                  <!-- Pure Pipe: Cached per unique input -->
                  <span class="badge-opt">{{ row[columns[0]] | heavyCalc }}</span>
                </ng-container>
                <ng-container *ngIf="!optimizations.purePipes && optimizations.avoidTemplateFunctions">
                  <!-- Avoid Template Functions: Pre-computed property -->
                  <span class="badge-pre">{{ row._computed_val ?? 'N/A' }}</span>
                </ng-container>
                <ng-container *ngIf="!optimizations.purePipes && !optimizations.avoidTemplateFunctions">
                  <!-- Unoptimized fallback: Call component function -->
                  <span class="badge-unopt">{{ runHeavyCalc(row[columns[0]]) }}</span>
                </ng-container>
              </div>
            </div>
          </cdk-virtual-scroll-viewport>
        </ng-container>

        <!-- Case 2: Virtual Scroll Disabled -->
        <ng-container *ngIf="!optimizations.virtualScrolling">
          <div class="non-virtual-container">
            <div *ngFor="let row of displayRows; let i = index; trackBy: trackByFn" class="table-row playground-table-row">
              <div class="table-cell index-col">{{ i + 1 }}</div>
              <div *ngFor="let col of columns" class="table-cell" [title]="row[col]">{{ row[col] }}</div>
              
              <!-- Value Formatting Comparison -->
              <div class="table-cell action-col">
                <ng-container *ngIf="optimizations.purePipes">
                  <span class="badge-opt">{{ row[columns[0]] | heavyCalc }}</span>
                </ng-container>
                <ng-container *ngIf="!optimizations.purePipes && optimizations.avoidTemplateFunctions">
                  <span class="badge-pre">{{ row._computed_val ?? 'N/A' }}</span>
                </ng-container>
                <ng-container *ngIf="!optimizations.purePipes && !optimizations.avoidTemplateFunctions">
                  <span class="badge-unopt">{{ runHeavyCalc(row[columns[0]]) }}</span>
                </ng-container>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .table-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .table-header {
      display: flex;
      background: var(--bg-tertiary);
      border-bottom: 2px solid var(--border-color-strong);
      font-weight: 600;
      color: var(--text-primary);
      flex-shrink: 0;
    }
    .table-header-cell, .table-cell {
      flex: 1;
      padding: 10px 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.88rem;
      border-right: 1px solid var(--border-color);
    }
    .index-col {
      flex: 0 0 60px;
      text-align: center;
      background: var(--bg-tertiary);
      font-weight: 500;
      color: var(--text-secondary);
    }
    .action-col {
      flex: 0 0 140px;
      text-align: center;
    }
    .table-body {
      flex: 1;
      overflow: auto;
      min-height: 250px;
    }
    .viewport {
      height: 100%;
      width: 100%;
    }
    .non-virtual-container {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .table-row {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      transition: background var(--transition-fast);
      height: 42px;
      align-items: center;
    }
    .table-row:hover {
      background: var(--accent-surface);
    }
    .badge-opt {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-pre {
      background: rgba(59, 130, 246, 0.15);
      color: var(--info);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-unopt {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OptimizedTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input() columns: string[] = [];
  @Input() data: any[] = [];
  @Input() data$!: Observable<any[]>;
  @Input() optimizations: any = {};

  displayRows: any[] = [];
  private dataSubscription?: Subscription;
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.setupDataStream();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] || changes['data$'] || changes['optimizations']) {
      this.setupDataStream();
    }
  }

  setupDataStream() {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
      this.dataSubscription = undefined;
    }

    if (this.optimizations.asyncPipe) {
      // In the optimized path with Async Pipe, the stream binding is handled in the template (or mapped cleanly)
      // Here, to keep it clean and robust, if asyncPipe is selected, we resolve it.
      if (this.data$) {
        this.dataSubscription = this.data$.subscribe(rows => {
          this.displayRows = rows;
          this.cdr.markForCheck();
        });
      } else {
        this.displayRows = this.data;
        this.cdr.markForCheck();
      }
    } else {
      // Un-async pipe optimization / Manual subscription
      this.displayRows = this.data;
      this.cdr.markForCheck();
    }
  }

  trackByFn(index: number, item: any): any {
    if (this.optimizations.trackBy) {
      // Optimized: Use unique ID or fallback to index to avoid complete DOM re-generation
      return item.id || item.rowId || index;
    } else {
      // Unoptimized: return random value or undefined, forcing Angular to recreate elements
      return undefined;
    }
  }

  runHeavyCalc(value: any): string {
    if (value === null || value === undefined) return '';
    const num = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    let result = 0;
    for (let i = 0; i < 1500; i++) {
      result += Math.sin(num + i) * Math.cos(num - i);
    }
    return result.toFixed(2);
  }

  ngOnDestroy() {
    // Unsubscribe Observables: if optimized, clean up subscriptions to avoid memory leaks
    if (this.optimizations.unsubscribeObservables) {
      if (this.dataSubscription) {
        this.dataSubscription.unsubscribe();
      }
    } else {
      // Let it leak! (Unoptimized code - intentionally leave subscription active to show memory usage delta)
    }
  }
}
