import { Component, ElementRef, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { Chart, registerables } from 'chart.js';
import { Subject, takeUntil, combineLatest } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-grid">
      <!-- KPI Row 1 -->
      <div class="kpi-cards">
        <div class="kpi-card accent-blue">
          <div class="kpi-icon">💰</div>
          <div class="kpi-info">
            <div class="kpi-title">Total Revenue</div>
            <div class="kpi-value">₹{{ totalRevenue | number:'1.2-2' }}</div>
            <div class="kpi-sub">From {{ totalInvoices }} bills</div>
          </div>
        </div>
        <div class="kpi-card accent-green">
          <div class="kpi-icon">📦</div>
          <div class="kpi-info">
            <div class="kpi-title">Products</div>
            <div class="kpi-value">{{ totalProducts }}</div>
            <div class="kpi-sub">{{ lowStockProducts }} low stock</div>
          </div>
        </div>
        <div class="kpi-card accent-purple">
          <div class="kpi-icon">👥</div>
          <div class="kpi-info">
            <div class="kpi-title">Customers</div>
            <div class="kpi-value">{{ totalCustomers }}</div>
          </div>
        </div>
        <div class="kpi-card accent-orange">
          <div class="kpi-icon">🛍️</div>
          <div class="kpi-info">
            <div class="kpi-title">Pending Orders</div>
            <div class="kpi-value">{{ pendingOrders }}</div>
            <div class="kpi-sub">{{ billedOrders }} billed</div>
          </div>
        </div>
        <div class="kpi-card accent-teal">
          <div class="kpi-icon">👤</div>
          <div class="kpi-info">
            <div class="kpi-title">Employees</div>
            <div class="kpi-value">{{ totalEmployees }}</div>
          </div>
        </div>
        <div class="kpi-card accent-red">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-info">
            <div class="kpi-title">Low Stock Alerts</div>
            <div class="kpi-value">{{ lowStockProducts }}</div>
            <div class="kpi-sub">{{ outOfStockProducts }} out of stock</div>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="charts-row">
        <div class="chart-card">
          <h3>📈 Revenue Trend (Monthly)</h3>
          <div class="chart-wrap"><canvas #revenueChart></canvas></div>
        </div>
        <div class="chart-card">
          <h3>📊 Stock Distribution</h3>
          <div class="chart-wrap"><canvas #stockChart></canvas></div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="bottom-row">
        <!-- Top Selling Products -->
        <div class="info-card">
          <h3>🏆 Top Selling Products</h3>
          <div class="top-list">
            <div class="top-item" *ngFor="let p of topSelling; let i = index">
              <span class="rank-badge rank-{{ i + 1 }}">{{ i + 1 }}</span>
              <div class="top-info">
                <span class="top-name">{{ p.name }}</span>
                <span class="top-sub">{{ p.unitsSold }} units · ₹{{ p.revenue | number:'1.0-0' }}</span>
              </div>
              <div class="top-bar-wrap">
                <div class="top-bar" [style.width.%]="p.pct"></div>
              </div>
            </div>
            <div class="empty-info" *ngIf="topSelling.length === 0">No billing data yet</div>
          </div>
        </div>

        <!-- Employee-wise Sales -->
        <div class="info-card">
          <h3>👤 Employee Sales</h3>
          <div class="top-list">
            <div class="top-item" *ngFor="let e of employeeSales">
              <div class="emp-avatar-xs" *ngIf="e.photo">
                <img [src]="e.photo" [alt]="e.name">
              </div>
              <div class="emp-init-xs" *ngIf="!e.photo">{{ e.name[0] }}</div>
              <div class="top-info">
                <span class="top-name">{{ e.name }}</span>
                <span class="top-sub">{{ e.orderCount }} orders</span>
              </div>
              <span class="emp-total">₹{{ e.total | number:'1.0-0' }}</span>
            </div>
            <div class="empty-info" *ngIf="employeeSales.length === 0">No employee orders yet</div>
          </div>
        </div>

        <!-- Low Stock Alerts -->
        <div class="info-card alert-card">
          <h3>🚨 Low Stock Alerts</h3>
          <div class="alert-list">
            <div class="alert-item" *ngFor="let p of lowStockList" [class.out]="p.stock === 0">
              <div class="alert-product-img">
                <img *ngIf="p.imageUrl" [src]="p.imageUrl" [alt]="p.name">
                <span *ngIf="!p.imageUrl">📦</span>
              </div>
              <div class="alert-info">
                <span class="alert-name">{{ p.name }}</span>
                <div class="stock-progress-wrap">
                  <div class="stock-progress" [style.width.%]="getStockPct(p)" [class.critical]="p.stock === 0"></div>
                </div>
              </div>
              <span class="alert-stock" [class.zero]="p.stock === 0">{{ p.stock === 0 ? 'Out' : p.stock }}</span>
            </div>
            <div class="empty-info" *ngIf="lowStockList.length === 0">✅ All products well-stocked</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-grid { display: flex; flex-direction: column; gap: 20px; }

    .kpi-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
    .kpi-card {
      background: var(--surface-card); border: 1px solid var(--border-color);
      border-radius: var(--radius-lg); padding: 18px;
      display: flex; align-items: center; gap: 14px;
      transition: transform 0.2s, box-shadow 0.2s; border-left: 4px solid transparent;
    }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
    .accent-blue { border-left-color: #6366f1; }
    .accent-green { border-left-color: #10b981; }
    .accent-purple { border-left-color: #a855f7; }
    .accent-orange { border-left-color: #f59e0b; }
    .accent-teal { border-left-color: #06b6d4; }
    .accent-red { border-left-color: #ef4444; }
    .kpi-icon { font-size: 1.8rem; line-height: 1; }
    .kpi-info { flex: 1; min-width: 0; }
    .kpi-title { font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 2px; }
    .kpi-value { font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1; }
    .kpi-sub { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px; }

    .charts-row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
    .chart-card {
      background: var(--surface-card); border: 1px solid var(--border-color);
      border-radius: var(--radius-lg); padding: 18px;
    }
    .chart-card h3 { margin: 0 0 14px; font-size: 1rem; font-weight: 700; color: var(--text-primary); }
    .chart-wrap { position: relative; height: 220px; }
    .chart-wrap canvas { width: 100% !important; height: 100% !important; }

    .bottom-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .info-card { background: var(--surface-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; }
    .info-card h3 { margin: 0 0 14px; font-size: 1rem; font-weight: 700; color: var(--text-primary); }

    .top-list { display: flex; flex-direction: column; gap: 10px; }
    .top-item { display: flex; align-items: center; gap: 10px; }
    .rank-badge { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; flex-shrink: 0; }
    .rank-1 { background: #fbbf24; color: white; }
    .rank-2 { background: #9ca3af; color: white; }
    .rank-3 { background: #cd7c2f; color: white; }
    .rank-4, .rank-5 { background: rgba(0,0,0,0.08); color: var(--text-secondary); }
    .top-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .top-name { font-weight: 700; font-size: 0.88rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .top-sub { font-size: 0.75rem; color: var(--text-tertiary); }
    .top-bar-wrap { width: 60px; height: 6px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; }
    .top-bar { height: 100%; background: var(--accent-primary); border-radius: 3px; transition: width 0.5s ease; }

    .emp-avatar-xs { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
    .emp-avatar-xs img { width: 100%; height: 100%; object-fit: cover; }
    .emp-init-xs { width: 32px; height: 32px; border-radius: 50%; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
    .emp-total { font-weight: 700; font-size: 0.9rem; color: var(--accent-primary); white-space: nowrap; }

    .alert-card { border-left: 4px solid #ef4444; }
    .alert-list { display: flex; flex-direction: column; gap: 10px; }
    .alert-item { display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--bg-primary); border-radius: var(--radius-sm); }
    .alert-item.out { background: rgba(239,68,68,0.05); }
    .alert-product-img { width: 36px; height: 36px; border-radius: 6px; overflow: hidden; flex-shrink: 0; background: var(--surface-card); display: flex; align-items: center; justify-content: center; font-size: 1rem; }
    .alert-product-img img { width: 100%; height: 100%; object-fit: cover; }
    .alert-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .alert-name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stock-progress-wrap { height: 4px; background: rgba(239,68,68,0.15); border-radius: 2px; overflow: hidden; }
    .stock-progress { height: 100%; background: #f59e0b; border-radius: 2px; transition: width 0.5s; }
    .stock-progress.critical { background: #ef4444; }
    .alert-stock { font-weight: 800; font-size: 0.9rem; color: #f59e0b; width: 28px; text-align: right; }
    .alert-stock.zero { color: #ef4444; }

    .empty-info { text-align: center; padding: 20px; color: var(--text-tertiary); font-size: 0.85rem; }

    @media (max-width: 1100px) { .bottom-row { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 900px) { .charts-row { grid-template-columns: 1fr; } .bottom-row { grid-template-columns: 1fr; } }
    @media (max-width: 600px) { .kpi-cards { grid-template-columns: repeat(2, 1fr); } }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('revenueChart', { static: true }) revenueChartRef!: ElementRef;
  @ViewChild('stockChart', { static: true }) stockChartRef!: ElementRef;

  totalRevenue = 0;
  totalInvoices = 0;
  totalProducts = 0;
  totalCustomers = 0;
  totalEmployees = 0;
  pendingOrders = 0;
  billedOrders = 0;
  lowStockProducts = 0;
  outOfStockProducts = 0;

  topSelling: { name: string; unitsSold: number; revenue: number; pct: number }[] = [];
  employeeSales: { name: string; photo?: string; orderCount: number; total: number }[] = [];
  lowStockList: any[] = [];

  private revChart: Chart | null = null;
  private stockChart: Chart | null = null;
  private destroy$ = new Subject<void>();

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.invoices$.pipe(takeUntil(this.destroy$)).subscribe(invs => {
      this.totalInvoices = invs.length;
      this.totalRevenue = invs.reduce((acc, i) => acc + i.grandTotal, 0);
      this.renderRevenueChart(invs);
      this.computeTopSelling(invs);
    });

    this.state.products$.pipe(takeUntil(this.destroy$)).subscribe(prods => {
      this.totalProducts = prods.length;
      this.lowStockProducts = prods.filter(p => p.stock <= p.lowStockThreshold).length;
      this.outOfStockProducts = prods.filter(p => p.stock === 0).length;
      this.lowStockList = prods.filter(p => p.stock <= p.lowStockThreshold).slice(0, 5);
      this.renderStockChart(prods);
    });

    this.state.customers$.pipe(takeUntil(this.destroy$)).subscribe(c => this.totalCustomers = c.length);
    this.state.employees$.pipe(takeUntil(this.destroy$)).subscribe(e => this.totalEmployees = e.length);

    combineLatest([this.state.orders$, this.state.employees$]).pipe(takeUntil(this.destroy$)).subscribe(([orders, employees]) => {
      this.pendingOrders = orders.filter(o => o.status === 'pending').length;
      this.billedOrders = orders.filter(o => o.status === 'billed').length;
      this.computeEmployeeSales(orders, employees);
    });
  }

  ngOnDestroy() {
    this.destroy$.next(); this.destroy$.complete();
    this.revChart?.destroy(); this.stockChart?.destroy();
  }

  private computeTopSelling(invoices: any[]) {
    const map: Record<string, { name: string; unitsSold: number; revenue: number }> = {};
    invoices.forEach(inv => {
      inv.items.forEach((item: any) => {
        if (!map[item.productId]) map[item.productId] = { name: item.productName, unitsSold: 0, revenue: 0 };
        map[item.productId].unitsSold += item.quantity;
        map[item.productId].revenue += item.total;
      });
    });
    const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const maxRev = sorted[0]?.revenue || 1;
    this.topSelling = sorted.map(p => ({ ...p, pct: (p.revenue / maxRev) * 100 }));
  }

  private computeEmployeeSales(orders: any[], employees: any[]) {
    const map: Record<string, { name: string; photo?: string; orderCount: number; total: number }> = {};
    orders.filter(o => o.employeeId).forEach(o => {
      const emp = employees.find(e => e.id === o.employeeId);
      if (!map[o.employeeId]) map[o.employeeId] = { name: o.employeeName || o.employeeId, photo: emp?.photoUrl, orderCount: 0, total: 0 };
      map[o.employeeId].orderCount++;
      map[o.employeeId].total += o.grandTotal;
    });
    this.employeeSales = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }

  getStockPct(p: any): number {
    if (!p.lowStockThreshold || p.lowStockThreshold === 0) return 0;
    return Math.min(100, (p.stock / (p.lowStockThreshold * 2)) * 100);
  }

  private renderRevenueChart(invoices: any[]) {
    if (this.revChart) this.revChart.destroy();
    const grouped: any = {};
    invoices.forEach(i => {
      const m = new Date(i.date).toLocaleString('default', { month: 'short', year: 'numeric' });
      grouped[m] = (grouped[m] || 0) + i.grandTotal;
    });
    this.revChart = new Chart(this.revenueChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: Object.keys(grouped).length ? Object.keys(grouped) : ['No Data'],
        datasets: [{ label: 'Revenue (₹)', data: Object.values(grouped).length ? Object.values(grouped) as number[] : [0], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#6366f1' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  private renderStockChart(products: any[]) {
    if (this.stockChart) this.stockChart.destroy();
    const top = [...products].sort((a, b) => b.stock - a.stock).slice(0, 6);
    this.stockChart = new Chart(this.stockChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: top.length ? top.map(p => p.name) : ['No Data'],
        datasets: [{ data: top.length ? top.map(p => p.stock) : [1], backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#10b981', '#f59e0b'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
    });
  }
}
