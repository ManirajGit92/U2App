import { Component, ElementRef, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillingStateService } from '../../services/billing-state.service';
import { Chart, registerables } from 'chart.js';
import { Subject, takeUntil } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-grid">
      <div class="kpi-cards">
        <div class="kpi-card">
          <div class="kpi-title">Total Revenue</div>
          <div class="kpi-value">₹{{ totalRevenue | number:'1.2-2' }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Total Invoices</div>
          <div class="kpi-value">{{ totalInvoices }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Products in Stock</div>
          <div class="kpi-value">{{ totalProducts }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Total Customers</div>
          <div class="kpi-value">{{ totalCustomers }}</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-container">
          <h3>Revenue Flow (Monthly)</h3>
          <canvas #revenueChart></canvas>
        </div>
        <div class="chart-container">
          <h3>Stock Distribution</h3>
          <canvas #stockChart></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-grid {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .kpi-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .kpi-card {
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .kpi-title {
      font-size: 0.9rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-value {
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--text-primary);
    }
    .charts-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }
    .chart-container {
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 24px;
      position: relative;
    }
    .chart-container h3 {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 1.1rem;
    }
    canvas {
      width: 100% !important;
      max-height: 300px;
    }
    @media (max-width: 900px) {
      .charts-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('revenueChart', { static: true }) revenueChartRef!: ElementRef;
  @ViewChild('stockChart', { static: true }) stockChartRef!: ElementRef;

  totalRevenue = 0;
  totalInvoices = 0;
  totalProducts = 0;
  totalCustomers = 0;

  private revChartInstance: Chart | null = null;
  private stockChartInstance: Chart | null = null;
  private destroy$ = new Subject<void>();

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.invoices$.pipe(takeUntil(this.destroy$)).subscribe(invs => {
      this.totalInvoices = invs.length;
      this.totalRevenue = invs.reduce((acc, curr) => acc + curr.grandTotal, 0);
      this.renderRevenueChart(invs);
    });

    this.state.products$.pipe(takeUntil(this.destroy$)).subscribe(prods => {
      this.totalProducts = prods.length;
      this.renderStockChart(prods);
    });

    this.state.customers$.pipe(takeUntil(this.destroy$)).subscribe(custs => {
      this.totalCustomers = custs.length;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.revChartInstance) this.revChartInstance.destroy();
    if (this.stockChartInstance) this.stockChartInstance.destroy();
  }

  private renderRevenueChart(invoices: any[]) {
    if (this.revChartInstance) this.revChartInstance.destroy();
    
    // Group by month
    const grouped: any = {};
    invoices.forEach(i => {
      const date = new Date(i.date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      grouped[monthYear] = (grouped[monthYear] || 0) + i.grandTotal;
    });

    const labels = Object.keys(grouped);
    const data = Object.values(grouped) as number[];

    this.revChartInstance = new Chart(this.revenueChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Revenue (₹)',
          data: data.length ? data : [0],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private renderStockChart(products: any[]) {
    if (this.stockChartInstance) this.stockChartInstance.destroy();
    
    const topStock = [...products].sort((a,b) => b.stock - a.stock).slice(0, 5);
    const labels = topStock.map(p => p.name);
    const data = topStock.map(p => p.stock) as number[];

    this.stockChartInstance = new Chart(this.stockChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Stock Quantity',
          data: data.length ? data : [1],
          backgroundColor: [
            '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#10b981'
          ]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}
