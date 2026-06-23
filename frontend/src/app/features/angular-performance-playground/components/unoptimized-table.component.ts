import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Observable, Subscription } from 'rxjs';
import { HeavyCalcPipe } from '../pipes/heavy-calc.pipe';

@Component({
  selector: 'app-unoptimized-table',
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
        <!-- Case 1: Virtual Scroll Enabled (Even if change detection is default) -->
        <ng-container *ngIf="optimizations.virtualScrolling">
          <cdk-virtual-scroll-viewport itemSize="42" class="viewport">
            <div *cdkVirtualFor="let row of displayRows; let i = index; trackBy: trackByFn" class="table-row playground-table-row">
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
  changeDetection: ChangeDetectionStrategy.Default
})
export class UnoptimizedTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input() columns: string[] = [];
  @Input() data: any[] = [];
  @Input() data$!: Observable<any[]>;
  @Input() optimizations: any = {};

  displayRows: any[] = [];
  private dataSubscription?: Subscription;

  // Track subscription leakage statically
  public static leakedSubscriptions = 0;

  ngOnInit() {
    this.setupDataStream();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] || changes['data$'] || changes['optimizations']) {
      this.setupDataStream();
    }
  }

  setupDataStream() {
    // If not optimized for unsubscribe, we do not clean up the old subscription, we let it leak!
    if (this.optimizations.unsubscribeObservables) {
      if (this.dataSubscription) {
        this.dataSubscription.unsubscribe();
        this.dataSubscription = undefined;
      }
    }

    if (this.optimizations.asyncPipe) {
      if (this.data$) {
        // Track new subscription
        UnoptimizedTableComponent.leakedSubscriptions++;
        this.dataSubscription = this.data$.subscribe(rows => {
          this.displayRows = rows;
        });
      } else {
        this.displayRows = this.data;
      }
    } else {
      this.displayRows = this.data;
    }
  }

  trackByFn(index: number, item: any): any {
    if (this.optimizations.trackBy) {
      return item.id || item.rowId || index;
    } else {
      // Force recreation of DOM on every change detection cycle
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
    if (this.optimizations.unsubscribeObservables) {
      if (this.dataSubscription) {
        this.dataSubscription.unsubscribe();
        UnoptimizedTableComponent.leakedSubscriptions = Math.max(0, UnoptimizedTableComponent.leakedSubscriptions - 1);
      }
    } else {
      // Intentionally leak: Subscription is never unsubscribed!
      // This is a direct showcase of subscription memory leakage in Angular.
    }
  }
}
