import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnitTestService } from '../unit-test.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-grid" *ngIf="metrics$ | async as metrics">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="card stat-card blue">
          <div class="stat-icon">📄</div>
          <div class="stat-data">
            <h3>Total Tests</h3>
            <p>{{ metrics.totalTests }}</p>
          </div>
        </div>
        <div class="card stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-data">
            <h3>Passed</h3>
            <p>{{ metrics.passedTests }}</p>
          </div>
        </div>
        <div class="card stat-card red">
          <div class="stat-icon">❌</div>
          <div class="stat-data">
            <h3>Failed</h3>
            <p>{{ metrics.failedTests }}</p>
          </div>
        </div>
        <div class="card stat-card orange">
          <div class="stat-icon">🐛</div>
          <div class="stat-data">
            <h3>Open Bugs</h3>
            <p>{{ metrics.openBugs }}</p>
          </div>
        </div>
      </div>

      <!-- Charts Area -->
      <div class="charts-area">
        <div class="card chart-card">
          <h3>Execution Status</h3>
          <div class="chart-container">
            <!-- CSS Pie Chart -->
            <div class="pie-chart" [style.background]="getPieChartGradient(metrics)"></div>
            <div class="chart-legend">
              <div class="legend-item"><span class="dot passed"></span> Pass ({{ metrics.passedTests }})</div>
              <div class="legend-item"><span class="dot failed"></span> Fail ({{ metrics.failedTests }})</div>
              <div class="legend-item"><span class="dot pending"></span> Pending ({{ metrics.pendingTests }})</div>
            </div>
          </div>
        </div>
        
        <div class="card chart-card">
          <h3>Bug Severity</h3>
          <div class="bar-chart-container">
            <div class="bar-row">
              <span class="bar-label">Critical</span>
              <div class="bar-wrapper"><div class="bar bg-critical" [style.width.%]="getBarWidth(metrics.criticalBugs, metrics.totalBugs)"></div></div>
              <span class="bar-val">{{ metrics.criticalBugs }}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">High</span>
              <div class="bar-wrapper"><div class="bar bg-high" [style.width.%]="getBarWidth(metrics.highBugs, metrics.totalBugs)"></div></div>
              <span class="bar-val">{{ metrics.highBugs }}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">Medium</span>
              <div class="bar-wrapper"><div class="bar bg-medium" [style.width.%]="getBarWidth(metrics.mediumBugs, metrics.totalBugs)"></div></div>
              <span class="bar-val">{{ metrics.mediumBugs }}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">Low</span>
              <div class="bar-wrapper"><div class="bar bg-low" [style.width.%]="getBarWidth(metrics.lowBugs, metrics.totalBugs)"></div></div>
              <span class="bar-val">{{ metrics.lowBugs }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-grid {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .stat-card.blue { border-left: 4px solid var(--info); }
    .stat-card.green { border-left: 4px solid var(--success); }
    .stat-card.red { border-left: 4px solid var(--danger); }
    .stat-card.orange { border-left: 4px solid var(--warning); }
    
    .stat-icon {
      font-size: 2rem;
      background: var(--bg-tertiary);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-data h3 {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.85rem;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .stat-data p {
      margin: 0.2rem 0 0;
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .charts-area {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
    }
    .chart-card h3 {
      margin: 0 0 1.5rem 0;
      color: var(--text-primary);
      font-size: 1.1rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.75rem;
    }
    
    /* Pie Chart */
    .chart-container {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 1rem 0;
    }
    .pie-chart {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
    }
    .chart-legend {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .dot.passed { background: var(--success); }
    .dot.failed { background: var(--danger); }
    .dot.pending { background: var(--text-tertiary); }

    /* Bar Chart */
    .bar-chart-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .bar-label {
      width: 60px;
      font-size: 0.9rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .bar-wrapper {
      flex: 1;
      height: 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      overflow: hidden;
    }
    .bar {
      height: 100%;
      border-radius: 6px;
      transition: width 1s ease-out;
    }
    .bar-val {
      width: 30px;
      text-align: right;
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.9rem;
    }
    .bg-critical { background: #991b1b; }
    .bg-high { background: var(--danger); }
    .bg-medium { background: var(--warning); }
    .bg-low { background: var(--info); }
  `]
})
export class DashboardComponent {
  unitTestService = inject(UnitTestService);

  metrics$: Observable<any> = this.unitTestService.state$.pipe(
    map(state => {
      const totalTests = state.testCases.length;
      const passedTests = state.executions.filter(e => e.status === 'Pass').length;
      const failedTests = state.executions.filter(e => e.status === 'Fail').length;
      const pendingTests = state.executions.filter(e => e.status === 'Pending').length;
      const totalBugs = state.bugs.length;
      const openBugs = state.bugs.filter(b => b.status === 'Open' || b.status === 'In Progress').length;
      
      const criticalBugs = state.bugs.filter(b => b.severity === 'Critical').length;
      const highBugs = state.bugs.filter(b => b.severity === 'High').length;
      const mediumBugs = state.bugs.filter(b => b.severity === 'Medium').length;
      const lowBugs = state.bugs.filter(b => b.severity === 'Low').length;

      return {
        totalTests, passedTests, failedTests, pendingTests, totalBugs, openBugs,
        criticalBugs, highBugs, mediumBugs, lowBugs
      };
    })
  );

  getPieChartGradient(metrics: any) {
    const total = metrics.totalTests || 1; // avoid div by 0
    const passPct = (metrics.passedTests / total) * 100;
    const failPct = (metrics.failedTests / total) * 100;
    // const pendPct = (metrics.pendingTests / total) * 100;

    // CSS Conic Gradient logic
    const passEnd = passPct;
    const failEnd = passEnd + failPct;
    
    return `conic-gradient(
      var(--success) 0% ${passEnd}%, 
      var(--danger) ${passEnd}% ${failEnd}%, 
      var(--text-tertiary) ${failEnd}% 100%
    )`;
  }

  getBarWidth(val: number, total: number) {
    if (!total) return 0;
    return (val / total) * 100;
  }
}
