import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MentalWellnessService } from './mental-wellness.service';

@Component({
  selector: 'app-mental-wellness-trends',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="mwt-page">
      <header class="mwt-header">
        <div>
          <h2>Analytics & Mental Wellness Reports</h2>
          <p>Track your long-term emotional stability, stress, and habits over time.</p>
        </div>
        <div class="mwt-actions">
          <select [(ngModel)]="selectedPeriod" name="period" class="period-select">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button type="button" class="action-btn" (click)="exportExcel()"><i class="pi pi-file-excel"></i> Export Excel</button>
          <button type="button" class="action-btn primary" (click)="exportPDF()"><i class="pi pi-file-pdf"></i> Export PDF</button>
        </div>
      </header>

      <section class="trends-grid">
        <!-- Mood & Happiness Trends -->
        <article class="chart-card span-2">
          <header class="card-head">
            <h3><i class="pi pi-chart-line"></i> Mood & Happiness Trends</h3>
            <span class="badge success">+12% vs last month</span>
          </header>
          <div class="chart-body">
            <div class="bars-container">
              <div class="bar-col" *ngFor="let val of happinessValues(); let i = index">
                <span class="val-tooltip">{{ val * 10 }}</span>
                <div class="bar-fill" [style.height.%]="val * 10"></div>
                <small class="x-label">{{ labels()[i] }}</small>
              </div>
            </div>
          </div>
        </article>

        <!-- Stress & Anxiety Comparison -->
        <article class="chart-card">
          <header class="card-head">
            <h3><i class="pi pi-bolt"></i> Stress vs. Anxiety</h3>
          </header>
          <div class="chart-body">
            <div class="dual-line-visual">
              <svg viewBox="0 0 200 100" preserveAspectRatio="none">
                <polyline points="0,70 30,50 60,65 90,40 120,55 150,30 180,45 200,25" fill="none" stroke="#ef4444" stroke-width="3"/>
                <polyline points="0,50 30,60 60,40 90,55 120,35 150,40 180,25 200,30" fill="none" stroke="#3b82f6" stroke-width="3"/>
              </svg>
              <div class="legend-row">
                <span class="legend-chip red"><span class="dot"></span> Stress</span>
                <span class="legend-chip blue"><span class="dot"></span> Anxiety</span>
              </div>
            </div>
          </div>
        </article>

        <!-- Meditation Progress -->
        <article class="chart-card">
          <header class="card-head">
            <h3><i class="pi pi-moon"></i> Meditation Progress</h3>
          </header>
          <div class="chart-body">
            <div class="bars-container">
              <div class="bar-col" *ngFor="let val of meditationValues(); let i = index">
                <span class="val-tooltip">{{ val }}m</span>
                <div class="bar-fill purple" [style.height.%]="Math.min(100, (val / 45) * 100)"></div>
                <small class="x-label">{{ labels()[i] }}</small>
              </div>
            </div>
          </div>
        </article>

        <!-- Screen Time Trends -->
        <article class="chart-card">
          <header class="card-head">
            <h3><i class="pi pi-mobile"></i> Screen Time Trends</h3>
          </header>
          <div class="chart-body">
            <div class="bars-container">
              <div class="bar-col" *ngFor="let val of screenValues(); let i = index">
                <span class="val-tooltip">{{ val }}h</span>
                <div class="bar-fill blue" [style.height.%]="Math.min(100, (val / 8) * 100)"></div>
                <small class="x-label">{{ labels()[i] }}</small>
              </div>
            </div>
          </div>
        </article>

        <!-- Reading & Growth -->
        <article class="chart-card">
          <header class="card-head">
            <h3><i class="pi pi-book"></i> Reading & Learning Hours</h3>
          </header>
          <div class="chart-body">
            <div class="bars-container">
              <div class="bar-col" *ngFor="let val of learningValues(); let i = index">
                <span class="val-tooltip">{{ val }}h</span>
                <div class="bar-fill green" [style.height.%]="Math.min(100, (val / 4) * 100)"></div>
                <small class="x-label">{{ labels()[i] }}</small>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .mwt-page { display: flex; flex-direction: column; gap: 20px; }
    .mwt-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .mwt-header h2 { margin: 0; font-size: 1.5rem; }
    .mwt-header p { margin: 2px 0 0; color: var(--text-secondary); font-size: 0.88rem; }
    .mwt-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .period-select { padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--surface-card); color: var(--text-primary); font-weight: 700; }
    .action-btn { border-radius: 12px; padding: 8px 16px; font-weight: 700; font-size: 0.85rem; border: 1px solid var(--border-color); background: var(--surface-card); color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .action-btn.primary { background: var(--accent-gradient); color: #fff; border: 0; }
    .trends-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .span-2 { grid-column: span 2; }
    .chart-card { background: color-mix(in srgb, var(--surface-card) 88%, transparent); border: 1px solid var(--border-color); border-radius: 20px; padding: 18px; backdrop-filter: blur(20px); display: flex; flex-direction: column; gap: 14px; }
    .card-head { display: flex; align-items: center; justify-content: space-between; }
    .card-head h3 { margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }
    .badge { font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 999px; }
    .badge.success { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .chart-body { height: 180px; position: relative; }
    .bars-container { height: 100%; display: flex; align-items: flex-end; justify-content: space-around; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 24px; }
    .bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; }
    .bar-fill { width: 60%; max-width: 28px; border-radius: 8px 8px 0 0; background: var(--accent-gradient); min-height: 4px; transition: height 0.3s ease; }
    .bar-fill.purple { background: linear-gradient(135deg, #a78bfa, #8b5cf6); }
    .bar-fill.blue { background: linear-gradient(135deg, #60a5fa, #3b82f6); }
    .bar-fill.green { background: linear-gradient(135deg, #34d399, #10b981); }
    .val-tooltip { font-size: 0.7rem; font-weight: 800; margin-bottom: 4px; color: var(--text-secondary); }
    .x-label { position: absolute; bottom: -20px; font-size: 0.7rem; color: var(--text-secondary); font-weight: 700; }
    .dual-line-visual { height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
    .dual-line-visual svg { width: 100%; height: 130px; }
    .legend-row { display: flex; gap: 16px; justify-content: center; }
    .legend-chip { font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .legend-chip.red .dot { background: #ef4444; }
    .legend-chip.blue .dot { background: #3b82f6; }
    @media (max-width: 900px) { .trends-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } }
  `],
})
export class MentalWellnessTrendsComponent implements OnInit {
  service = inject(MentalWellnessService);
  selectedPeriod = 'weekly';
  Math = Math;

  labels = computed(() => this.service.getWeekdayLabels());
  happinessValues = computed(() => this.service.getWeeklyTrend('happinessScore'));
  meditationValues = computed(() => this.service.getWeeklyTrend('meditationMinutes'));
  screenValues = computed(() => this.service.getWeeklyTrend('screenTimeHours'));
  learningValues = computed(() => this.service.getWeeklyTrend('learningHours'));

  ngOnInit() {}

  exportExcel() {
    this.service.exportExcel();
  }

  exportPDF() {
    alert('📄 Mental Wellness Report PDF generated!');
  }
}
