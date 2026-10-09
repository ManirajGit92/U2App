import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FinanceService } from './finance.service';
import { AddTransactionDrawerComponent } from './add-transaction-drawer.component';
import { FinanceTransaction, FinancialGoal } from './finance.models';

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AddTransactionDrawerComponent],
  template: `
    <div class="finance-page-container">
      <div class="finance-main-layout">
        <!-- Main Dashboard Column -->
        <div class="dashboard-content-area">
          <!-- Subheader / Action Bar matching screenshot -->
          <header class="finance-header">
            <div class="header-titles">
              <span class="greeting-text">Good evening,</span>
              <h1 class="main-title">Finance Overview</h1>
              <p class="subtitle-text">
                Track your income, expenses, investments, taxes and build a better financial future.
              </p>
            </div>

            <div class="header-controls">
              <!-- Month Filter -->
              <div class="select-pill-wrap">
                <i class="pi pi-calendar pill-icon"></i>
                <select
                  class="select-pill"
                  [ngModel]="service.selectedMonth()"
                  (ngModelChange)="service.selectedMonth.set($event)"
                  aria-label="Filter Month"
                >
                  <option value="2026-05">May 2026</option>
                  <option value="2026-04">April 2026</option>
                  <option value="2026-03">March 2026</option>
                  <option value="2026-02">February 2026</option>
                  <option value="2026-01">January 2026</option>
                </select>
                <i class="pi pi-chevron-down pill-chevron"></i>
              </div>

              <!-- Add Transaction Button -->
              <button
                type="button"
                class="btn-primary-pill"
                (click)="service.openAddDrawer()"
              >
                <i class="pi pi-plus"></i>
                <span>Add Transaction</span>
              </button>

              <!-- Import Button -->
              <button
                type="button"
                class="btn-secondary-pill"
                (click)="openImportModal()"
              >
                <i class="pi pi-upload"></i>
                <span>Import</span>
              </button>
            </div>
          </header>

          <!-- ─── 1. TOP SUMMARY CARDS (4 CARDS) ─── -->
          <section class="summary-cards-grid" aria-label="Financial Summary Cards">
            <!-- Total Income Card -->
            <article class="kpi-card income-kpi">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-green">
                  <i class="pi pi-wallet"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Total Income</span>
                  <strong class="kpi-amount">₹{{ service.totalIncome() | number }}</strong>
                  <span class="kpi-trend trend-up">
                    <i class="pi pi-caret-up"></i> 12% vs last month
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 80 32" class="sparkline-svg">
                  <polyline
                    points="0,24 16,22 32,26 48,16 64,12 80,4"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </article>

            <!-- Total Expense Card -->
            <article class="kpi-card expense-kpi">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-red">
                  <i class="pi pi-shopping-cart"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Total Expense</span>
                  <strong class="kpi-amount">₹{{ service.totalExpense() | number }}</strong>
                  <span class="kpi-trend trend-down-red">
                    <i class="pi pi-caret-up"></i> 5% vs last month
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 80 32" class="sparkline-svg">
                  <polyline
                    points="0,18 16,24 32,14 48,22 64,10 80,14"
                    fill="none"
                    stroke="#f43f5e"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </article>

            <!-- Total Investment Card -->
            <article class="kpi-card investment-kpi">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-purple">
                  <i class="pi pi-chart-bar"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Total Investment</span>
                  <strong class="kpi-amount">₹{{ service.totalInvestment() | number }}</strong>
                  <span class="kpi-trend trend-up">
                    <i class="pi pi-caret-up"></i> 8% vs last month
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 80 32" class="sparkline-svg">
                  <polyline
                    points="0,22 16,18 32,20 48,14 64,16 80,6"
                    fill="none"
                    stroke="#8b5cf6"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </article>

            <!-- Total Tax Card -->
            <article class="kpi-card tax-kpi">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-orange">
                  <i class="pi pi-percentage"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Total Tax (FY 25-26)</span>
                  <strong class="kpi-amount">₹{{ service.totalTax() | number }}</strong>
                  <span class="kpi-trend trend-orange">
                    <i class="pi pi-caret-up"></i> 0% vs last year
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 80 32" class="sparkline-svg">
                  <polyline
                    points="0,20 16,22 32,16 48,18 64,12 80,8"
                    fill="none"
                    stroke="#f59e0b"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </article>
          </section>

          <!-- ─── 2. SECOND ROW: ANALYTICS CARDS (3 CARDS) ─── -->
          <section class="analytics-row-3" aria-label="Income and Expense Analytics">
            <!-- 2.1 Income vs Expense (Bar Chart) -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Income vs Expense</h3>
                <div class="mini-filter">
                  <select class="mini-select">
                    <option>Last 6 Months</option>
                    <option>This Year</option>
                  </select>
                </div>
              </header>

              <div class="chart-legend-top">
                <span class="legend-dot green"></span>
                <span class="legend-text">Income</span>
                <span class="legend-dot red ml-3"></span>
                <span class="legend-text">Expense</span>
              </div>

              <div class="bar-chart-body">
                <div class="y-axis-labels">
                  <span>₹1.2L</span>
                  <span>₹90K</span>
                  <span>₹60K</span>
                  <span>₹30K</span>
                  <span>0</span>
                </div>
                <div class="bars-container">
                  <div
                    *ngFor="let m of service.monthlyComparisons()"
                    class="bar-month-group"
                  >
                    <div class="bars-pair">
                      <div
                        class="bar bar-income"
                        [style.height.%]="getBarHeight(m.income, 120000)"
                        [title]="'Income: ₹' + m.income"
                      ></div>
                      <div
                        class="bar bar-expense"
                        [style.height.%]="getBarHeight(m.expense, 120000)"
                        [title]="'Expense: ₹' + m.expense"
                      ></div>
                    </div>
                    <span class="x-axis-label">{{ m.month }}</span>
                  </div>
                </div>
              </div>
            </article>

            <!-- 2.2 Expense Breakdown (Donut Chart) -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Expense Breakdown</h3>
                <div class="mini-filter">
                  <select class="mini-select">
                    <option>This Month</option>
                    <option>Last Month</option>
                  </select>
                </div>
              </header>

              <div class="donut-and-legend-layout">
                <div class="donut-visual-wrap">
                  <svg viewBox="0 0 100 100" class="donut-svg">
                    <!-- Segment 1: Housing (30%) -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#3b82f6"
                      stroke-width="12"
                      stroke-dasharray="71.6 238.8"
                      stroke-dashoffset="0"
                    />
                    <!-- Segment 2: Food (18%) -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#f59e0b"
                      stroke-width="12"
                      stroke-dasharray="43 238.8"
                      stroke-dashoffset="-71.6"
                    />
                    <!-- Segment 3: Transport (12%) -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#06b6d4"
                      stroke-width="12"
                      stroke-dasharray="28.6 238.8"
                      stroke-dashoffset="-114.6"
                    />
                    <!-- Segment 4: Shopping (10%) -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#ec4899"
                      stroke-width="12"
                      stroke-dasharray="23.8 238.8"
                      stroke-dashoffset="-143.2"
                    />
                    <!-- Segment 5: Utilities (8%) -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#8b5cf6"
                      stroke-width="12"
                      stroke-dasharray="19.1 238.8"
                      stroke-dashoffset="-167"
                    />
                    <!-- Segment 6: Others (22%) -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#64748b"
                      stroke-width="12"
                      stroke-dasharray="52.5 238.8"
                      stroke-dashoffset="-186.1"
                    />
                  </svg>
                  <div class="donut-center-info">
                    <strong>₹{{ service.totalExpense() | number }}</strong>
                    <small>Total Expense</small>
                  </div>
                </div>

                <div class="legend-list-column">
                  <div
                    *ngFor="let item of service.expenseBreakdown()"
                    class="legend-row"
                  >
                    <div class="legend-left-col">
                      <span
                        class="legend-color-dot"
                        [style.background-color]="item.color"
                      ></span>
                      <span class="legend-name">{{ item.name }}</span>
                    </div>
                    <span class="legend-pct">{{ item.percentage }}%</span>
                    <strong class="legend-val">₹{{ item.amount | number }}</strong>
                  </div>
                </div>
              </div>
            </article>

            <!-- 2.3 Income Sources (Donut Chart) -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Income Sources</h3>
                <div class="mini-filter">
                  <select class="mini-select">
                    <option>This Month</option>
                    <option>Last Month</option>
                  </select>
                </div>
              </header>

              <div class="donut-and-legend-layout">
                <div class="donut-visual-wrap">
                  <svg viewBox="0 0 100 100" class="donut-svg">
                    <!-- Salary 70% -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#0ea5e9"
                      stroke-width="12"
                      stroke-dasharray="167.1 238.8"
                      stroke-dashoffset="0"
                    />
                    <!-- Freelance 15% -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#10b981"
                      stroke-width="12"
                      stroke-dasharray="35.8 238.8"
                      stroke-dashoffset="-167.1"
                    />
                    <!-- Business 10% -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#f97316"
                      stroke-width="12"
                      stroke-dasharray="23.8 238.8"
                      stroke-dashoffset="-202.9"
                    />
                    <!-- Others 5% -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#a855f7"
                      stroke-width="12"
                      stroke-dasharray="12 238.8"
                      stroke-dashoffset="-226.7"
                    />
                  </svg>
                  <div class="donut-center-info">
                    <strong>₹{{ service.totalIncome() | number }}</strong>
                    <small>Total Income</small>
                  </div>
                </div>

                <div class="legend-list-column">
                  <div
                    *ngFor="let item of service.incomeSources()"
                    class="legend-row"
                  >
                    <div class="legend-left-col">
                      <span
                        class="legend-color-dot"
                        [style.background-color]="item.color"
                      ></span>
                      <span class="legend-name">{{ item.name }}</span>
                    </div>
                    <span class="legend-pct">{{ item.percentage }}%</span>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <!-- ─── 3. THIRD ROW: PORTFOLIO, ASSETS & P&L (3 CARDS) ─── -->
          <section class="analytics-row-3" aria-label="Portfolio and Net Worth Analytics">
            <!-- 3.1 Investment Portfolio -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Investment Portfolio</h3>
                <div class="mini-filter">
                  <select class="mini-select">
                    <option>Current Value</option>
                    <option>Invested Value</option>
                  </select>
                </div>
              </header>

              <div class="portfolio-content-grid">
                <div class="portfolio-left-pane">
                  <div class="portfolio-top-val">
                    <div class="portfolio-icon">
                      <i class="pi pi-chart-line"></i>
                    </div>
                    <div>
                      <span class="sub-label">Total Value</span>
                      <strong class="large-val">₹{{ service.totalInvestment() | number }}</strong>
                      <span class="trend-pill positive">
                        <i class="pi pi-caret-up"></i> 8% vs last month
                      </span>
                    </div>
                  </div>

                  <!-- Area sparkline curve -->
                  <div class="portfolio-area-chart">
                    <svg viewBox="0 0 200 60" preserveAspectRatio="none" class="area-svg">
                      <defs>
                        <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
                          <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points="0,60 0,45 40,40 80,48 120,32 160,26 200,12 200,60"
                        fill="url(#invGrad)"
                      />
                      <polyline
                        points="0,45 40,40 80,48 120,32 160,26 200,12"
                        fill="none"
                        stroke="#10b981"
                        stroke-width="2.5"
                        stroke-linecap="round"
                      />
                    </svg>
                    <div class="area-x-labels">
                      <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                    </div>
                  </div>
                </div>

                <div class="portfolio-right-list">
                  <div
                    *ngFor="let item of service.investments()"
                    class="legend-row"
                  >
                    <div class="legend-left-col">
                      <span
                        class="legend-color-dot"
                        [style.background-color]="item.color"
                      ></span>
                      <span class="legend-name">{{ item.name }}</span>
                    </div>
                    <span class="legend-pct">{{ item.percentage }}%</span>
                    <strong class="legend-val">₹{{ item.amount | number }}</strong>
                  </div>
                </div>
              </div>
            </article>

            <!-- 3.2 Assets vs Liabilities -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Assets vs Liabilities</h3>
              </header>

              <div class="assets-liab-body">
                <div class="assets-comparison-bars">
                  <div class="asset-bar-col">
                    <span class="bar-col-label">Assets</span>
                    <div class="large-bar bg-assets"></div>
                  </div>
                  <div class="liability-bar-col">
                    <span class="bar-col-label">Liabilities</span>
                    <div class="large-bar bg-liabilities"></div>
                  </div>
                </div>

                <div class="net-worth-footer">
                  <span class="net-worth-label">Net Worth</span>
                  <div class="net-worth-row">
                    <strong class="net-worth-amount">
                      ₹{{ service.assetLiabilitySummary().netWorth | number }}
                    </strong>
                    <span class="trend-pill positive">
                      <i class="pi pi-caret-up"></i> 10% vs last month
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <!-- 3.3 Profit & Loss (Business/Freelance) -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Profit & Loss (Business/Freelance)</h3>
                <div class="mini-filter">
                  <select class="mini-select">
                    <option>This Month</option>
                    <option>Last 6 Months</option>
                  </select>
                </div>
              </header>

              <div class="pnl-header-row">
                <div class="pnl-left">
                  <div class="pnl-icon">
                    <i class="pi pi-arrow-up-right"></i>
                  </div>
                  <div>
                    <span class="sub-label">Profit</span>
                    <strong class="large-val">₹25,000</strong>
                    <span class="trend-pill positive">
                      <i class="pi pi-caret-up"></i> 15% vs last month
                    </span>
                  </div>
                </div>

                <div class="chart-legend-top mini">
                  <span class="legend-dot green"></span>
                  <span class="legend-text">Revenue</span>
                  <span class="legend-dot red ml-2"></span>
                  <span class="legend-text">Cost</span>
                </div>
              </div>

              <div class="bar-chart-body mini-bars">
                <div class="y-axis-labels mini">
                  <span>₹60K</span>
                  <span>₹40K</span>
                  <span>₹20K</span>
                  <span>0</span>
                </div>
                <div class="bars-container">
                  <div
                    *ngFor="let m of service.profitLossHistory()"
                    class="bar-month-group"
                  >
                    <div class="bars-pair">
                      <div
                        class="bar bar-income"
                        [style.height.%]="getBarHeight(m.revenue, 75000)"
                      ></div>
                      <div
                        class="bar bar-expense"
                        [style.height.%]="getBarHeight(m.cost, 75000)"
                      ></div>
                    </div>
                    <span class="x-axis-label">{{ m.month }}</span>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <!-- ─── 4. FOURTH ROW: TAX, TRANSACTIONS & GOALS (3 CARDS) ─── -->
          <section class="analytics-row-3" aria-label="Tax, Transactions and Goals">
            <!-- 4.1 Tax Summary (FY 2025-26) -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Tax Summary (FY 2025-26)</h3>
                <div class="mini-filter">
                  <select class="mini-select">
                    <option>Current Year</option>
                    <option>Previous Year</option>
                  </select>
                </div>
              </header>

              <div class="tax-body-layout">
                <div class="tax-radial-wrap">
                  <svg viewBox="0 0 100 100" class="radial-svg">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#f1f5f9"
                      stroke-width="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#10b981"
                      stroke-width="8"
                      stroke-dasharray="251.2"
                      stroke-dashoffset="70.3"
                      stroke-linecap="round"
                    />
                  </svg>
                  <div class="radial-center-text">
                    <strong>72%</strong>
                    <small>Completed</small>
                  </div>
                </div>

                <div class="tax-stats-list">
                  <div class="tax-stat-row">
                    <span class="stat-name">Taxable Income</span>
                    <strong class="stat-value">₹12,00,000</strong>
                  </div>
                  <div class="tax-stat-row">
                    <span class="stat-name">Estimated Tax</span>
                    <strong class="stat-value">₹1,80,000</strong>
                  </div>
                  <div class="tax-stat-row">
                    <span class="stat-name">Paid Tax</span>
                    <strong class="stat-value">₹1,30,000</strong>
                  </div>
                  <div class="tax-stat-row">
                    <span class="stat-name">Balance</span>
                    <strong class="stat-value text-balance">₹50,000</strong>
                  </div>
                </div>
              </div>

              <div class="card-footer-action">
                <button
                  type="button"
                  class="btn-tax-details"
                  (click)="openTaxModal()"
                >
                  View Tax Details
                </button>
              </div>
            </article>

            <!-- 4.2 Recent Transactions Table -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Recent Transactions</h3>
                <button
                  type="button"
                  class="card-action-link"
                  (click)="openAllTransactionsModal()"
                >
                  View All
                </button>
              </header>

              <div class="table-responsive">
                <table class="recent-tx-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th class="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let tx of service.recentTransactions()">
                      <td class="cell-date">{{ formatDateDisplay(tx.date) }}</td>
                      <td class="cell-desc">
                        <strong>{{ tx.description }}</strong>
                      </td>
                      <td class="cell-category">
                        <span class="category-chip">
                          {{ getCategoryIcon(tx.category) }} {{ tx.category }}
                        </span>
                      </td>
                      <td class="cell-type">
                        <span
                          class="type-pill"
                          [class.income]="tx.type === 'income'"
                          [class.expense]="tx.type === 'expense'"
                        >
                          {{ tx.type === 'income' ? 'Income' : 'Expense' }}
                        </span>
                      </td>
                      <td
                        class="cell-amount text-right"
                        [class.amount-income]="tx.type === 'income'"
                        [class.amount-expense]="tx.type === 'expense'"
                      >
                        {{ tx.type === 'income' ? '+ ' : '- ' }}₹{{ tx.amount | number }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <!-- 4.3 Financial Goals -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Financial Goals</h3>
                <button
                  type="button"
                  class="card-action-link"
                  (click)="openGoalsModal()"
                >
                  View All
                </button>
              </header>

              <div class="goals-list-container">
                <div *ngFor="let goal of service.goals()" class="goal-item-card">
                  <div class="goal-icon-box" [style.background-color]="goal.color + '20'" [style.color]="goal.color">
                    <i [class]="goal.icon"></i>
                  </div>
                  <div class="goal-content">
                    <div class="goal-title-row">
                      <strong>{{ goal.title }}</strong>
                      <span class="goal-amounts">
                        {{ service.formatCurrency(goal.currentAmount, true) }} /
                        {{ service.formatCurrency(goal.targetAmount, true) }}
                      </span>
                    </div>
                    <div class="goal-progress-bar-wrap">
                      <div
                        class="goal-progress-fill"
                        [style.width.%]="getGoalPercent(goal)"
                        [style.background-color]="goal.color"
                      ></div>
                    </div>
                  </div>
                  <span class="goal-pct-badge">{{ getGoalPercent(goal) }}%</span>
                </div>
              </div>
            </article>
          </section>
        </div>

        <!-- Right Side Add Transaction Drawer -->
        <app-add-transaction-drawer></app-add-transaction-drawer>
      </div>

      <!-- ─── MODALS ─── -->
      <!-- 1. View All Transactions Modal -->
      <div class="modal-backdrop" *ngIf="showTransactionsModal()" (click)="closeModals()">
        <div class="modal-dialog modal-lg" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>All Transactions Ledger</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>

          <div class="modal-body">
            <!-- Filter toolbar -->
            <div class="ledger-toolbar">
              <label class="search-input-wrap">
                <i class="pi pi-search"></i>
                <input
                  type="text"
                  placeholder="Search by description, tag, category..."
                  [(ngModel)]="ledgerSearch"
                />
              </label>

              <select [(ngModel)]="ledgerTypeFilter" class="filter-select">
                <option value="all">All Types</option>
                <option value="expense">Expenses Only</option>
                <option value="income">Incomes Only</option>
                <option value="transfer">Transfers Only</option>
              </select>

              <button
                type="button"
                class="btn-export-excel"
                (click)="service.exportTransactions()"
              >
                <i class="pi pi-file-excel"></i> Export Excel
              </button>
            </div>

            <!-- Table -->
            <div class="ledger-table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Payment</th>
                    <th>Type</th>
                    <th class="text-right">Amount</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let tx of filteredLedgerTransactions()">
                    <td>{{ tx.date }}</td>
                    <td>
                      <strong>{{ tx.description }}</strong>
                      <span *ngIf="tx.tags?.length" class="tag-subchips">
                        <small *ngFor="let tag of tx.tags">#{{ tag }}</small>
                      </span>
                    </td>
                    <td>{{ tx.category }}</td>
                    <td>{{ tx.paymentMethod }}</td>
                    <td>
                      <span
                        class="type-pill"
                        [class.income]="tx.type === 'income'"
                        [class.expense]="tx.type === 'expense'"
                      >
                        {{ tx.type }}
                      </span>
                    </td>
                    <td
                      class="text-right"
                      [class.amount-income]="tx.type === 'income'"
                      [class.amount-expense]="tx.type === 'expense'"
                    >
                      {{ tx.type === 'income' ? '+' : '-' }}₹{{ tx.amount | number }}
                    </td>
                    <td class="text-center">
                      <button
                        type="button"
                        class="icon-action-btn"
                        title="Edit"
                        (click)="editFromLedger(tx)"
                      >
                        <i class="pi pi-pencil"></i>
                      </button>
                      <button
                        type="button"
                        class="icon-action-btn delete"
                        title="Delete"
                        (click)="deleteFromLedger(tx.id)"
                      >
                        <i class="pi pi-trash"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Tax Details Modal -->
      <div class="modal-backdrop" *ngIf="showTaxModal()" (click)="closeModals()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>Tax Breakdown & Computations (FY 2025-26)</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>
          <div class="modal-body tax-modal-content">
            <div class="tax-regime-selector">
              <button
                type="button"
                class="regime-btn"
                [class.active]="selectedTaxRegime === 'new'"
                (click)="selectedTaxRegime = 'new'"
              >
                New Tax Regime (Default)
              </button>
              <button
                type="button"
                class="regime-btn"
                [class.active]="selectedTaxRegime === 'old'"
                (click)="selectedTaxRegime = 'old'"
              >
                Old Tax Regime (With Deductions)
              </button>
            </div>

            <div class="tax-breakdown-table">
              <div class="tax-row">
                <span>Gross Total Income</span>
                <strong>₹12,75,000</strong>
              </div>
              <div class="tax-row">
                <span>Standard Deduction (Sec 16ia)</span>
                <strong>- ₹75,000</strong>
              </div>
              <div class="tax-row" *ngIf="selectedTaxRegime === 'old'">
                <span>Section 80C (PPF, ELSS, PF)</span>
                <strong>- ₹1,50,000</strong>
              </div>
              <div class="tax-row" *ngIf="selectedTaxRegime === 'old'">
                <span>Section 80D (Health Insurance)</span>
                <strong>- ₹25,000</strong>
              </div>
              <div class="tax-row highlight">
                <span>Net Taxable Income</span>
                <strong>₹12,00,000</strong>
              </div>
              <div class="tax-row">
                <span>Total Tax Calculated</span>
                <strong>₹1,80,000</strong>
              </div>
              <div class="tax-row text-success">
                <span>TDS / Advance Tax Paid</span>
                <strong>₹1,30,000</strong>
              </div>
              <div class="tax-row highlight text-danger">
                <span>Tax Payable / Balance</span>
                <strong>₹50,000</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Import Modal -->
      <div class="modal-backdrop" *ngIf="showImportModal()" (click)="closeModals()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>Import Financial Data</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>
          <div class="modal-body">
            <p>Upload your Excel or JSON bank statement / transactions file:</p>
            <div class="import-drop-area" (click)="importInput.click()">
              <input
                #importInput
                type="file"
                hidden
                accept=".xlsx, .xls, .json, .csv"
                (change)="onFileImport($event)"
              />
              <i class="pi pi-file-excel import-icon"></i>
              <strong>Click to upload spreadsheet or JSON</strong>
              <small>Supports XLSX, CSV, JSON</small>
            </div>

            <div class="or-divider">OR</div>

            <button
              type="button"
              class="btn-sample-restore"
              (click)="restoreMockData()"
            >
              <i class="pi pi-refresh"></i> Reset & Restore Default Sample Data
            </button>
          </div>
        </div>
      </div>

      <!-- 4. Goals Modal -->
      <div class="modal-backdrop" *ngIf="showGoalsModal()" (click)="closeModals()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>Manage Financial Goals</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>
          <div class="modal-body">
            <div class="add-goal-box">
              <h3>Create New Goal</h3>
              <div class="form-grid-2">
                <input
                  type="text"
                  placeholder="Goal Title (e.g. Dream Car)"
                  [(ngModel)]="newGoalTitle"
                  class="form-control"
                />
                <input
                  type="number"
                  placeholder="Target Amount (₹)"
                  [(ngModel)]="newGoalTarget"
                  class="form-control"
                />
              </div>
              <button
                type="button"
                class="btn-primary-pill mt-3"
                (click)="addNewGoal()"
              >
                + Add Goal
              </button>
            </div>

            <hr class="my-4" />

            <h3>Current Goals</h3>
            <div class="goals-edit-list">
              <div *ngFor="let g of service.goals()" class="goal-edit-row">
                <div>
                  <strong>{{ g.title }}</strong>
                  <p>
                    ₹{{ g.currentAmount | number }} of ₹{{ g.targetAmount | number }}
                  </p>
                </div>
                <div class="goal-row-actions">
                  <button
                    type="button"
                    class="btn-contribute-sm"
                    (click)="contributeGoal(g.id)"
                  >
                    + ₹10,000
                  </button>
                  <button
                    type="button"
                    class="icon-action-btn delete"
                    (click)="service.deleteGoal(g.id)"
                  >
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        color: #0f172a;
        --border-light: rgba(226, 232, 240, 0.8);
      }

      .finance-page-container {
        padding: 20px 24px 48px;
        max-width: 1680px;
        margin: 0 auto;
      }

      .finance-main-layout {
        display: flex;
        gap: 24px;
        align-items: flex-start;
      }

      .dashboard-content-area {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      /* ─── Subheader / Top Action Bar ─── */
      .finance-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
      }

      .greeting-text {
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 500;
        display: block;
      }

      .main-title {
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        color: #0f172a;
        margin: 2px 0;
      }

      .subtitle-text {
        font-size: 0.88rem;
        color: #64748b;
        margin: 0;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .select-pill-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .pill-icon {
        position: absolute;
        left: 14px;
        color: #64748b;
        font-size: 0.9rem;
        pointer-events: none;
      }

      .pill-chevron {
        position: absolute;
        right: 14px;
        color: #64748b;
        font-size: 0.75rem;
        pointer-events: none;
      }

      .select-pill {
        appearance: none;
        height: 42px;
        padding: 0 34px 0 38px;
        background: #ffffff;
        border: 1px solid var(--border-light);
        border-radius: 24px;
        font-size: 0.88rem;
        font-weight: 600;
        color: #0f172a;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      }

      .btn-primary-pill {
        height: 42px;
        padding: 0 20px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 24px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
        transition: all 0.2s ease;
      }

      .btn-primary-pill:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
      }

      .btn-secondary-pill {
        height: 42px;
        padding: 0 20px;
        background: #ffffff;
        color: #334155;
        border: 1px solid var(--border-light);
        border-radius: 24px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        transition: all 0.2s ease;
      }

      .btn-secondary-pill:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      /* ─── 1. Top KPI Summary Grid (4 Cards) ─── */
      .summary-cards-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }

      .kpi-card {
        background: #ffffff;
        border-radius: 18px;
        padding: 18px 20px;
        border: 1px solid var(--border-light);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.02);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .kpi-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .kpi-icon-box {
        width: 46px;
        height: 46px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        color: #ffffff;
      }

      .bg-green {
        background: #10b981;
      }
      .bg-red {
        background: #f43f5e;
      }
      .bg-purple {
        background: #8b5cf6;
      }
      .bg-orange {
        background: #f59e0b;
      }

      .kpi-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kpi-label {
        font-size: 0.8rem;
        font-weight: 500;
        color: #64748b;
      }

      .kpi-amount {
        font-size: 1.35rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.4px;
      }

      .kpi-trend {
        font-size: 0.75rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin-top: 2px;
      }

      .trend-up {
        color: #10b981;
      }
      .trend-down-red {
        color: #f43f5e;
      }
      .trend-orange {
        color: #f59e0b;
      }

      .sparkline-svg {
        width: 76px;
        height: 32px;
        overflow: visible;
      }

      /* ─── 2 & 3. 3-Column Analytics Rows ─── */
      .analytics-row-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
      }

      .chart-card {
        background: #ffffff;
        border-radius: 18px;
        padding: 20px;
        border: 1px solid var(--border-light);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.02);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .card-header h3 {
        font-size: 0.98rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }

      .mini-select {
        appearance: none;
        background: transparent;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 4px 24px 4px 10px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        background-image: url('data:image/svg+xml;utf8,<svg fill="%2364748b" height="12" viewBox="0 0 24 24" width="12" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>');
        background-repeat: no-repeat;
        background-position: right 8px center;
      }

      .card-action-link {
        background: transparent;
        border: none;
        color: #2563eb;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
      }

      .card-action-link:hover {
        text-decoration: underline;
      }

      /* Legend top */
      .chart-legend-top {
        display: flex;
        align-items: center;
        font-size: 0.8rem;
        color: #64748b;
      }

      .chart-legend-top.mini {
        font-size: 0.75rem;
      }

      .legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 6px;
      }

      .legend-dot.green {
        background: #10b981;
      }
      .legend-dot.red {
        background: #f43f5e;
      }
      .ml-2 {
        margin-left: 8px;
      }
      .ml-3 {
        margin-left: 14px;
      }

      /* Bar Chart */
      .bar-chart-body {
        display: flex;
        gap: 12px;
        height: 155px;
        align-items: flex-end;
      }

      .bar-chart-body.mini-bars {
        height: 110px;
      }

      .y-axis-labels {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        font-size: 0.72rem;
        color: #94a3b8;
        padding-bottom: 22px;
        min-width: 32px;
      }

      .y-axis-labels.mini {
        min-width: 28px;
      }

      .bars-container {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        height: 100%;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 4px;
      }

      .bar-month-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        flex: 1;
      }

      .bars-pair {
        display: flex;
        gap: 4px;
        align-items: flex-end;
        height: 120px;
      }

      .bar {
        width: 10px;
        border-radius: 4px 4px 0 0;
        transition: height 0.3s ease;
      }

      .bar-income {
        background: #10b981;
      }
      .bar-expense {
        background: #f43f5e;
      }

      .x-axis-label {
        font-size: 0.72rem;
        color: #94a3b8;
      }

      /* Donut and Legend Layout */
      .donut-and-legend-layout {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 16px;
        align-items: center;
      }

      .donut-visual-wrap {
        position: relative;
        width: 120px;
        height: 120px;
      }

      .donut-svg {
        transform: rotate(-90deg);
        width: 100%;
        height: 100%;
      }

      .donut-center-info {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .donut-center-info strong {
        font-size: 0.95rem;
        color: #0f172a;
        line-height: 1.1;
      }

      .donut-center-info small {
        font-size: 0.68rem;
        color: #64748b;
      }

      .legend-list-column {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .legend-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.78rem;
      }

      .legend-left-col {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .legend-color-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .legend-name {
        color: #475569;
        font-weight: 500;
      }

      .legend-pct {
        color: #64748b;
        font-weight: 600;
      }

      .legend-val {
        color: #0f172a;
        font-weight: 700;
      }

      /* Portfolio card layout */
      .portfolio-content-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .portfolio-left-pane {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .portfolio-top-val {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .portfolio-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .sub-label {
        font-size: 0.75rem;
        color: #64748b;
        display: block;
      }

      .large-val {
        font-size: 1.1rem;
        font-weight: 800;
        color: #0f172a;
        display: block;
      }

      .trend-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 6px;
      }

      .trend-pill.positive {
        color: #10b981;
        background: #ecfdf5;
      }

      .portfolio-area-chart {
        height: 70px;
        display: flex;
        flex-direction: column;
      }

      .area-svg {
        width: 100%;
        height: 52px;
      }

      .area-x-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.68rem;
        color: #94a3b8;
      }

      .portfolio-right-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        justify-content: center;
      }

      /* Assets vs Liabilities */
      .assets-liab-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: 100%;
        justify-content: space-between;
      }

      .assets-comparison-bars {
        display: flex;
        align-items: flex-end;
        justify-content: space-around;
        height: 100px;
        padding-top: 10px;
      }

      .asset-bar-col,
      .liability-bar-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .bar-col-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
      }

      .large-bar {
        width: 52px;
        border-radius: 8px 8px 0 0;
      }

      .bg-assets {
        height: 75px;
        background: #10b981;
      }

      .bg-liabilities {
        height: 38px;
        background: #f43f5e;
      }

      .net-worth-footer {
        border-top: 1px solid #f1f5f9;
        padding-top: 10px;
      }

      .net-worth-label {
        font-size: 0.78rem;
        color: #64748b;
        display: block;
      }

      .net-worth-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 2px;
      }

      .net-worth-amount {
        font-size: 1.3rem;
        font-weight: 800;
        color: #0f172a;
      }

      /* Profit & Loss card */
      .pnl-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .pnl-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .pnl-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #10b981;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* Tax Card */
      .tax-body-layout {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 16px;
        align-items: center;
      }

      .tax-radial-wrap {
        position: relative;
        width: 90px;
        height: 90px;
      }

      .radial-svg {
        transform: rotate(-90deg);
        width: 100%;
        height: 100%;
      }

      .radial-center-text {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .radial-center-text strong {
        font-size: 1.05rem;
        color: #0f172a;
        line-height: 1;
      }

      .radial-center-text small {
        font-size: 0.68rem;
        color: #64748b;
      }

      .tax-stats-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .tax-stat-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8rem;
      }

      .stat-name {
        color: #64748b;
      }

      .stat-value {
        color: #0f172a;
      }

      .text-balance {
        color: #2563eb;
      }

      .card-footer-action {
        border-top: 1px solid #f1f5f9;
        padding-top: 10px;
        text-align: center;
      }

      .btn-tax-details {
        background: #f1f5f9;
        color: #475569;
        border: none;
        border-radius: 20px;
        padding: 6px 16px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-tax-details:hover {
        background: #e2e8f0;
        color: #0f172a;
      }

      /* Recent Transactions Table */
      .table-responsive {
        overflow-x: auto;
      }

      .recent-tx-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.78rem;
      }

      .recent-tx-table th {
        text-align: left;
        color: #94a3b8;
        font-weight: 600;
        padding: 4px 8px 8px;
        border-bottom: 1px solid #f1f5f9;
      }

      .recent-tx-table td {
        padding: 8px;
        border-bottom: 1px solid #f8fafc;
        color: #334155;
      }

      .cell-date {
        color: #64748b;
        white-space: nowrap;
      }

      .cell-desc strong {
        color: #0f172a;
      }

      .category-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #475569;
      }

      .type-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.72rem;
        font-weight: 600;
      }

      .type-pill.income {
        background: #dcfce7;
        color: #10b981;
      }

      .type-pill.expense {
        background: #fee2e2;
        color: #ef4444;
      }

      .cell-amount {
        font-weight: 700;
        white-space: nowrap;
      }

      .text-right {
        text-align: right;
      }

      .text-center {
        text-align: center;
      }

      .amount-income {
        color: #10b981;
      }

      .amount-expense {
        color: #ef4444;
      }

      /* Financial Goals */
      .goals-list-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .goal-item-card {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .goal-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
        flex-shrink: 0;
      }

      .goal-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .goal-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.78rem;
      }

      .goal-amounts {
        color: #64748b;
        font-weight: 500;
      }

      .goal-progress-bar-wrap {
        height: 6px;
        background: #f1f5f9;
        border-radius: 4px;
        overflow: hidden;
      }

      .goal-progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }

      .goal-pct-badge {
        font-size: 0.78rem;
        font-weight: 700;
        color: #64748b;
        min-width: 32px;
        text-align: right;
      }

      /* ─── MODALS ─── */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(4px);
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .modal-dialog {
        background: #ffffff;
        border-radius: 20px;
        width: 100%;
        max-width: 580px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
      }

      .modal-dialog.modal-lg {
        max-width: 900px;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #f1f5f9;
      }

      .modal-header h2 {
        font-size: 1.15rem;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
      }

      .modal-body {
        padding: 20px 24px;
      }

      .btn-close {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #64748b;
      }

      .ledger-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .search-input-wrap {
        position: relative;
        flex: 1;
        min-width: 220px;
      }

      .search-input-wrap i {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
      }

      .search-input-wrap input {
        width: 100%;
        height: 38px;
        padding: 0 12px 0 34px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 0.85rem;
      }

      .filter-select {
        height: 38px;
        padding: 0 12px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 0.85rem;
        color: #475569;
      }

      .btn-export-excel {
        height: 38px;
        padding: 0 14px;
        background: #10b981;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .ledger-table-wrap {
        max-height: 480px;
        overflow-y: auto;
      }

      .ledger-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .ledger-table th {
        position: sticky;
        top: 0;
        background: #f8fafc;
        padding: 8px 12px;
        text-align: left;
        color: #64748b;
        font-weight: 600;
        border-bottom: 1px solid #e2e8f0;
      }

      .ledger-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
      }

      .tag-subchips small {
        display: inline-block;
        background: #f1f5f9;
        color: #64748b;
        padding: 1px 6px;
        border-radius: 4px;
        margin-right: 4px;
        font-size: 0.7rem;
      }

      .icon-action-btn {
        background: transparent;
        border: none;
        color: #64748b;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 6px;
      }

      .icon-action-btn:hover {
        background: #f1f5f9;
        color: #2563eb;
      }

      .icon-action-btn.delete:hover {
        color: #ef4444;
      }

      /* Tax regime breakdown */
      .tax-regime-selector {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .regime-btn {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        color: #64748b;
      }

      .regime-btn.active {
        background: #dbeafe;
        color: #2563eb;
        border-color: #93c5fd;
      }

      .tax-breakdown-table {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .tax-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.88rem;
        padding: 8px 12px;
        background: #f8fafc;
        border-radius: 8px;
      }

      .tax-row.highlight {
        background: #f1f5f9;
        font-weight: 700;
      }

      .text-success {
        color: #10b981;
      }
      .text-danger {
        color: #ef4444;
      }

      /* Import drop */
      .import-drop-area {
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        background: #f8fafc;
        cursor: pointer;
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .import-icon {
        font-size: 2rem;
        color: #10b981;
      }

      .or-divider {
        text-align: center;
        margin: 16px 0;
        font-size: 0.8rem;
        color: #94a3b8;
        font-weight: 600;
      }

      .btn-sample-restore {
        width: 100%;
        padding: 10px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        border-radius: 10px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      /* Goals modal */
      .form-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .form-control {
        height: 40px;
        padding: 6px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        width: 100%;
      }

      .mt-3 {
        margin-top: 12px;
      }
      .my-4 {
        margin: 16px 0;
        border: none;
        border-top: 1px solid #f1f5f9;
      }

      .goals-edit-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .goal-edit-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #f8fafc;
        border-radius: 10px;
      }

      .goal-row-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-contribute-sm {
        background: #dcfce7;
        color: #10b981;
        border: none;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }

      /* ─── Responsive Queries ─── */
      @media (max-width: 1200px) {
        .finance-main-layout {
          flex-direction: column;
        }

        .summary-cards-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .analytics-row-3 {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 680px) {
        .finance-page-container {
          padding: 12px 12px 32px;
        }

        .summary-cards-grid {
          grid-template-columns: 1fr;
        }

        .header-controls {
          width: 100%;
          flex-wrap: wrap;
        }

        .btn-primary-pill,
        .btn-secondary-pill,
        .select-pill-wrap {
          flex: 1;
        }
      }
    `,
  ],
})
export class FinanceDashboardComponent implements OnInit {
  service = inject(FinanceService);
  route = inject(ActivatedRoute);

  // Modals state
  showTransactionsModal = signal(false);
  showTaxModal = signal(false);
  showImportModal = signal(false);
  showGoalsModal = signal(false);

  // Ledger state
  ledgerSearch = '';
  ledgerTypeFilter = 'all';

  // Tax state
  selectedTaxRegime: 'new' | 'old' = 'new';

  // New goal state
  newGoalTitle = '';
  newGoalTarget: number | null = null;

  ngOnInit(): void {
    // Check if routed directly to a sub-feature (e.g. finance/goals, finance/tax, etc.)
    this.route.url.subscribe((segments) => {
      const path = segments[0]?.path;
      if (path === 'income-expense') {
        this.openAllTransactionsModal();
      } else if (path === 'tax') {
        this.openTaxModal();
      } else if (path === 'goals') {
        this.openGoalsModal();
      }
    });
  }

  getBarHeight(value: number, max: number): number {
    const pct = Math.round((value / max) * 100);
    return Math.min(Math.max(pct, 5), 100);
  }

  getGoalPercent(goal: FinancialGoal): number {
    if (!goal.targetAmount) return 0;
    return Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
  }

  formatDateDisplay(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  getCategoryIcon(category: string): string {
    const map: Record<string, string> = {
      Salary: '💵',
      Shopping: '🛒',
      Investment: '📊',
      Utilities: '⚡',
      Food: '🍔',
      Housing: '🏠',
      Transport: '🚗',
      Freelance: '💻',
      Business: '🏢',
    };
    return map[category] || '📦';
  }

  // Modals
  openAllTransactionsModal(): void {
    this.showTransactionsModal.set(true);
  }

  openTaxModal(): void {
    this.showTaxModal.set(true);
  }

  openImportModal(): void {
    this.showImportModal.set(true);
  }

  openGoalsModal(): void {
    this.showGoalsModal.set(true);
  }

  closeModals(): void {
    this.showTransactionsModal.set(false);
    this.showTaxModal.set(false);
    this.showImportModal.set(false);
    this.showGoalsModal.set(false);
  }

  filteredLedgerTransactions(): FinanceTransaction[] {
    let list = this.service.transactions();
    if (this.ledgerTypeFilter !== 'all') {
      list = list.filter((t) => t.type === this.ledgerTypeFilter);
    }
    const q = this.ledgerSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }

  editFromLedger(tx: FinanceTransaction): void {
    this.closeModals();
    this.service.openAddDrawer(tx);
  }

  deleteFromLedger(id: string): void {
    if (confirm('Are you sure you want to delete this transaction?')) {
      this.service.deleteTransaction(id);
    }
  }

  onFileImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          this.service.importTransactions(parsed);
          alert('Imported ' + parsed.length + ' transactions successfully!');
          this.closeModals();
        }
      } catch {
        alert('File could not be parsed as JSON transactions array. Ensure valid format.');
      }
    };
    reader.readAsText(file);
  }

  restoreMockData(): void {
    localStorage.removeItem('u2_finance_state_v1');
    window.location.reload();
  }

  addNewGoal(): void {
    if (!this.newGoalTitle || !this.newGoalTarget) return;
    this.service.addGoal({
      title: this.newGoalTitle,
      targetAmount: Number(this.newGoalTarget),
      currentAmount: 0,
      category: 'other',
      icon: 'pi pi-flag',
      color: '#3b82f6',
    });
    this.newGoalTitle = '';
    this.newGoalTarget = null;
  }

  contributeGoal(id: string): void {
    this.service.contributeToGoal(id, 10000);
  }
}
