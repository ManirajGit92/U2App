import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LifeTrackerService, FitnessEntry, MentalHealthEntry, Reminder, ExpenseEntry, InvestmentEntry } from './life-tracker.service';

@Component({
  selector: 'app-life-tracker-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-grid">
      <!-- Insights Card -->
      <div class="card insights-card glass-card">
        <h3>🌱 Lifestyle Insights</h3>
        <ul>
          <li *ngFor="let insight of insights()">{{ insight }}</li>
        </ul>
      </div>

      <!-- Quick Stats -->
      <div class="stats-row">
        <div class="stat-card glass-card">
          <span class="label">Daily Steps</span>
          <span class="value">{{ lastSteps() }}</span>
          <div class="progress-ring" [style.--p]="(lastSteps() / 10000) * 100"></div>
        </div>
        <div class="stat-card glass-card">
          <span class="label">Mood</span>
          <span class="value">{{ lastMood() }}/10</span>
          <div class="mood-indicator" [style.background]="getMoodColor(lastMood())"></div>
        </div>
        <div class="stat-card glass-card">
          <span class="label">Sleep</span>
          <span class="value">{{ lastSleep() }}h</span>
        </div>
        <div class="stat-card glass-card">
          <span class="label">Total Expenses</span>
          <span class="value px-value">\${{ totalExpenses() }}</span>
        </div>
      </div>

      <!-- Charts Section 1: Fitness & Expenses -->
      <div class="chart-row">
        <div class="chart-box glass-card">
          <h3>📊 Fitness Activity (Mins)</h3>
          <div class="bar-chart">
            <div *ngFor="let f of fitnessData()" class="bar-wrap">
              <div class="bar" [style.--h]="(f.duration / 60) * 100 + '%'" [title]="f.activity"></div>
              <span class="bar-label">{{ f.activity | slice:0:3 }}</span>
            </div>
          </div>
        </div>
        <div class="chart-box glass-card">
          <h3>💰 Expense Breakdown</h3>
          <div class="pie-alt">
             <div *ngFor="let cat of expenseCategories()" class="pie-segment" 
                  [style.flex]="cat.percent" [style.background]="cat.color" [title]="cat.name">
             </div>
          </div>
          <div class="legend">
             <div *ngFor="let cat of expenseCategories()" class="legend-item">
                <span class="dot" [style.background]="cat.color"></span>
                <span>{{ cat.name }} (\${{ cat.amount }})</span>
             </div>
          </div>
        </div>
      </div>

      <!-- Charts Section 2: Mood & Investments -->
      <div class="chart-row">
        <div class="chart-box glass-card">
          <h3>🧠 Mental Health (Mood)</h3>
          <div class="line-alt">
             <div *ngFor="let m of moodData()" class="point" [style.bottom]="(m.mood * 10) + '%'" [title]="m.date"></div>
          </div>
        </div>
        <div class="chart-box glass-card">
          <h3>📈 Investment Distribution</h3>
          <div class="stack-chart">
             <div *ngFor="let i of investmentData()" class="stack-bar" 
                  [style.width]="(i.amount / totalInvestments() * 100) + '%'" 
                  [style.background]="getInvestmentColor(i.type)" [title]="i.asset">
             </div>
          </div>
          <p class="text-tertiary" style="margin-top: 1rem; font-size: 0.8rem">
            Total Assets Value: <strong>\${{ totalInvestments() }}</strong>
          </p>
        </div>
      </div>

      <!-- Reminders -->
      <div class="tasks-area glass-card">
         <h3>📝 Daily Reminders</h3>
         <div class="task-list">
            <div class="task-item" *ngFor="let task of reminders()">
               <input type="checkbox" [checked]="!task.active" (change)="task.active = !task.active">
               <span [class.done]="!task.active">{{ task.task }}</span>
               <span class="time">{{ task.time }}</span>
            </div>
         </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-grid { display: flex; flex-direction: column; gap: 1.5rem; }
    .insights-card { padding: 1.5rem; background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(99,102,241,0.1)); border: 1px solid rgba(16,185,129,0.2); }
    .insights-card ul { list-style: none; padding: 0; margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .insights-card li { padding-left: 1.5rem; position: relative; font-size: 0.9rem; }
    .insights-card li::before { content: '💡'; position: absolute; left: 0; }

    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
    .stat-card { padding: 1.5rem; text-align: center; position: relative; min-height: 120px; display: flex; flex-direction: column; justify-content: center; }
    .stat-card .label { display: block; font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 1px; }
    .stat-card .value { font-size: 1.8rem; font-weight: 800; color: var(--accent-primary); }
    .px-value { color: #f59e0b !important; }

    .progress-ring { width: 36px; height: 36px; border-radius: 50%; background: conic-gradient(var(--accent-primary) calc(var(--p) * 1%), rgba(var(--accent-rgb), 0.1) 0); position: absolute; top: 1rem; right: 1rem; }
    .mood-indicator { width: 12px; height: 12px; border-radius: 50%; position: absolute; top: 1rem; right: 1rem; box-shadow: 0 0 10px currentColor; }

    .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .chart-box { padding: 1.5rem; min-height: 250px; display: flex; flex-direction: column; }
    .chart-box h3 { margin-bottom: 1.5rem; font-size: 1rem; color: var(--text-secondary); }

    /* Bar Chart */
    .bar-chart { flex: 1; display: flex; gap: 0.75rem; align-items: flex-end; justify-content: space-around; padding-bottom: 1.5rem; }
    .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; height: 100%; justify-content: flex-end; }
    .bar { width: 100%; background: var(--accent-gradient); border-radius: 4px 4px 0 0; min-height: 4px; height: var(--h); transition: height 0.3s ease; }
    .bar-label { font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; }

    /* Pie/Segment Chart */
    .pie-alt { height: 20px; display: flex; border-radius: 10px; overflow: hidden; margin-bottom: 1.5rem; }
    .pie-segment { height: 100%; transition: flex 0.3s ease; }
    .legend { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; }
    .legend-item .dot { width: 8px; height: 8px; border-radius: 50%; }

    /* Line Chart Alt */
    .line-alt { flex: 1; border-bottom: 1px solid var(--border-color); border-left: 1px solid var(--border-color); position: relative; margin: 1rem; }
    .point { width: 8px; height: 8px; background: var(--accent-primary); border-radius: 50%; position: absolute; transition: bottom 0.3s ease; transform: translateX(-50%); }
    .point:nth-child(1) { left: 10%; }
    .point:nth-child(2) { left: 25%; }
    .point:nth-child(3) { left: 40%; }
    .point:nth-child(4) { left: 55%; }
    .point:nth-child(5) { left: 70%; }
    .point:nth-child(6) { left: 85%; }
    .point:nth-child(7) { left: 100%; }

    /* Stack Chart */
    .stack-chart { height: 40px; border-radius: 8px; overflow: hidden; display: flex; border: 1px solid var(--border-color); }
    .stack-bar { height: 100%; transition: width 0.3s ease; }

    .tasks-area { padding: 1.5rem; }
    .task-list { margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 2rem; }
    .task-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color); }
    .task-item .done { text-decoration: line-through; opacity: 0.5; }
    .task-item .time { margin-left: auto; font-size: 0.75rem; color: var(--text-tertiary); }

    @media (max-width: 768px) {
      .stats-row, .chart-row, .insights-card ul, .task-list { grid-template-columns: 1fr; }
    }
  `]
})
export class LifeTrackerDashboardComponent implements OnInit {
  service = inject(LifeTrackerService);
  
  insights = signal<string[]>([]);
  lastSteps = signal(0);
  lastMood = signal(0);
  lastSleep = signal(0);
  reminders = signal<Reminder[]>([]);
  
  fitnessData = signal<FitnessEntry[]>([]);
  moodData = signal<MentalHealthEntry[]>([]);
  expenseData = signal<ExpenseEntry[]>([]);
  investmentData = signal<InvestmentEntry[]>([]);

  totalExpenses = computed(() => this.expenseData().reduce((acc, c) => acc + c.amount, 0));
  totalInvestments = computed(() => this.investmentData().reduce((acc, c) => acc + c.amount, 0));

  expenseCategories = computed(() => {
    const cats: Record<string, number> = {};
    const total = this.totalExpenses() || 1;
    this.expenseData().forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    return Object.entries(cats).map(([name, amount], i) => ({
      name, amount, percent: (amount / total) * 10, color: colors[i % colors.length]
    }));
  });

  ngOnInit() {
    this.insights.set(this.service.getInsights());
    
    this.service.fitness$.subscribe((data: FitnessEntry[]) => {
       this.fitnessData.set(data.slice(-7));
       if (data.length > 0) this.lastSteps.set(data[data.length - 1].steps);
    });

    this.service.mentalHealth$.subscribe((data: MentalHealthEntry[]) => {
       this.moodData.set(data.slice(-7));
       if (data.length > 0) {
          this.lastMood.set(data[data.length - 1].mood);
          this.lastSleep.set(data[data.length - 1].sleep);
       }
    });

    this.service.expenses$.subscribe((data: ExpenseEntry[]) => this.expenseData.set(data));
    this.service.investments$.subscribe((data: InvestmentEntry[]) => this.investmentData.set(data));
    this.service.reminders$.subscribe((r: Reminder[]) => this.reminders.set(r));
  }

  getMoodColor(mood: number) {
    if (mood > 7) return '#10b981';
    if (mood > 4) return '#f59e0b';
    return '#ef4444';
  }

  getInvestmentColor(type: string) {
    switch(type) {
      case 'Stock': return '#6366f1';
      case 'Crypto': return '#ec4899';
      case 'Real Estate': return '#10b981';
      case 'Savings': return '#34d399';
      default: return '#eee';
    }
  }
}
