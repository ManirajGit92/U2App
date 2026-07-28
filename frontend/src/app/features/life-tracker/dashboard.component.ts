import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  DietEntry,
  ExpenseEntry,
  FitnessEntry,
  InvestmentEntry,
  LifeTrackerService,
  MentalHealthEntry,
  Reminder,
  RoutineEntry,
} from './life-tracker.service';

interface KpiCard {
  label: string;
  value: string;
  trend: string;
  icon: string;
  tone: string;
  progress: number;
}

@Component({
  selector: 'app-life-tracker-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="premium-dashboard">
      <section class="hero-panel">
        <div class="hero-copy">
          <span class="eyebrow">Today overview</span>
          <h2>Stay focused and make today count.</h2>
          <p>{{ insightText() }}</p>
        </div>
        <div class="hero-metrics" aria-label="Quick productivity summary">
          <div>
            <span>{{ todaysFocus() }}%</span>
            <small>Focus</small>
          </div>
          <div>
            <span>{{ completedTasks() }}/{{ totalTasks() }}</span>
            <small>Tasks</small>
          </div>
          <div>
            <span>{{ currentStreak() }}</span>
            <small>Day streak</small>
          </div>
        </div>
      </section>

      <section class="kpi-grid" aria-label="LifeTracker summary cards">
        <article class="kpi-card" *ngFor="let kpi of kpis(); let i = index" [style.animation-delay.ms]="i * 55">
          <div class="kpi-icon" [style.--tone]="kpi.tone">
            <i [class]="kpi.icon" aria-hidden="true"></i>
          </div>
          <div class="kpi-content">
            <span>{{ kpi.label }}</span>
            <strong>{{ kpi.value }}</strong>
            <small>{{ kpi.trend }}</small>
          </div>
          <div class="mini-ring" [style.--progress]="kpi.progress">
            <span>{{ kpi.progress }}%</span>
          </div>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="dashboard-card health-card">
          <header class="card-header">
            <span class="card-icon red"><i class="pi pi-heart"></i></span>
            <div>
              <h3>Health Monitoring</h3>
              <p>Score, hydration, sleep and active energy</p>
            </div>
            <a routerLink="../MentalHealth">View Details</a>
          </header>
          <div class="health-layout">
            <div class="score-ring" [style.--score]="healthScore()">
              <span>{{ healthScore() }}%</span>
              <small>Health score</small>
            </div>
            <div class="metric-list">
              <div *ngFor="let item of healthMetrics()">
                <span><i [class]="item.icon"></i>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <div class="progress-track"><span [style.width.%]="item.progress"></span></div>
              </div>
            </div>
          </div>
        </article>

        <article class="dashboard-card expense-card">
          <header class="card-header">
            <span class="card-icon violet"><i class="pi pi-wallet"></i></span>
            <div>
              <h3>Expense Monitoring</h3>
              <p>Monthly spend, budget and categories</p>
            </div>
            <a routerLink="../Expenses">View Details</a>
          </header>
          <div class="expense-layout">
            <div>
              <span class="muted-label">This month</span>
              <strong class="big-value">{{ currency(totalExpenses()) }}</strong>
              <p class="positive">8.5% under planned budget</p>
            </div>
            <div class="donut" [style.background]="expenseDonut()"></div>
          </div>
          <div class="category-list">
            <div *ngFor="let cat of expenseCategories()">
              <span><i [style.background]="cat.color"></i>{{ cat.name }}</span>
              <strong>{{ currency(cat.amount) }}</strong>
              <small>{{ cat.percent }}%</small>
            </div>
          </div>
        </article>

        <article class="dashboard-card fitness-card">
          <header class="card-header">
            <span class="card-icon blue"><i class="pi pi-bolt"></i></span>
            <div>
              <h3>Fitness Monitoring</h3>
              <p>Exercise minutes and weekly movement trend</p>
            </div>
            <a routerLink="../Fitness">View Details</a>
          </header>
          <div class="bar-chart" aria-label="Workout history chart">
            <div class="bar-wrap" *ngFor="let f of fitnessData(); let i = index">
              <span class="bar-tooltip">{{ f.activity }} · {{ f.duration }}m</span>
              <div class="bar" [style.height.%]="barHeight(f.duration)" [style.animation-delay.ms]="i * 70"></div>
              <small>{{ shortDate(f.date) }}</small>
            </div>
          </div>
          <div class="split-metrics">
            <div><span>Exercise</span><strong>{{ totalExerciseMinutes() }}m</strong></div>
            <div><span>Calories</span><strong>{{ caloriesBurned() }}</strong></div>
          </div>
        </article>

        <article class="dashboard-card mental-card">
          <header class="card-header">
            <span class="card-icon rose"><i class="pi pi-face-smile"></i></span>
            <div>
              <h3>Mental Health</h3>
              <p>Mood history, sleep and journal signal</p>
            </div>
            <a routerLink="../MentalHealth">View Details</a>
          </header>
          <div class="line-chart">
            <div
              class="line-point"
              *ngFor="let m of moodData(); let i = index"
              [style.left.%]="lineX(i, moodData().length)"
              [style.bottom.%]="m.mood * 10"
              [title]="m.date + ': ' + m.mood + '/10'">
            </div>
          </div>
          <div class="journal-note">
            <i class="pi pi-book"></i>
            <span>{{ latestReflection() }}</span>
          </div>
        </article>

        <article class="dashboard-card investment-card wide">
          <header class="card-header">
            <span class="card-icon green"><i class="pi pi-chart-line"></i></span>
            <div>
              <h3>Investment Dashboard</h3>
              <p>Portfolio value, allocation and growth outlook</p>
            </div>
            <a routerLink="../Investments">View Details</a>
          </header>
          <div class="investment-layout">
            <div class="portfolio-value">
              <span>Portfolio value</span>
              <strong>{{ currency(totalInvestments()) }}</strong>
              <small class="positive">+12.4% projected annual growth</small>
            </div>
            <div class="area-chart" aria-hidden="true">
              <span *ngFor="let h of [32, 44, 39, 55, 62, 58, 74, 82]" [style.height.%]="h"></span>
            </div>
            <div class="allocation">
              <div *ngFor="let item of investmentAllocation()">
                <span><i [style.background]="item.color"></i>{{ item.name }}</span>
                <strong>{{ item.percent }}%</strong>
              </div>
            </div>
          </div>
        </article>

        <article class="dashboard-card routine-card">
          <header class="card-header">
            <span class="card-icon teal"><i class="pi pi-clock"></i></span>
            <div>
              <h3>Daily Routine Timeline</h3>
              <p>Quick edit your routine from the category view</p>
            </div>
            <a routerLink="../Routines">View All</a>
          </header>
          <div class="timeline">
            <div class="timeline-item" *ngFor="let routine of routines()">
              <button
                type="button"
                class="status-dot"
                [class.done]="routine.completed"
                [attr.aria-label]="routine.completed ? 'Completed routine' : 'Pending routine'">
                <i class="pi" [ngClass]="routine.completed ? 'pi-check' : 'pi-circle'"></i>
              </button>
              <strong>{{ routine.time }}</strong>
              <span>{{ routine.task }}</span>
              <small>{{ routine.frequency }}</small>
            </div>
          </div>
        </article>

        <article class="dashboard-card reminder-card">
          <header class="card-header">
            <span class="card-icon amber"><i class="pi pi-bell"></i></span>
            <div>
              <h3>Reminders</h3>
              <p>Priority labels, category chips and due times</p>
            </div>
          </header>
          <div class="chip-row">
            <button type="button" class="chip active">All</button>
            <button type="button" class="chip">Health</button>
            <button type="button" class="chip">Finance</button>
            <button type="button" class="chip">Work</button>
          </div>
          <div class="reminder-list">
            <label *ngFor="let reminder of reminders(); let i = index">
              <input type="checkbox" [checked]="!reminder.active" (change)="reminder.active = !reminder.active">
              <span>{{ reminder.task }}</span>
              <em [class.high]="i === 0">{{ i === 0 ? 'High' : 'Normal' }}</em>
              <small>{{ reminder.time }}</small>
            </label>
          </div>
        </article>

        <article class="dashboard-card goals-card">
          <header class="card-header">
            <span class="card-icon red"><i class="pi pi-flag"></i></span>
            <div>
              <h3>Goals & Progress</h3>
              <p>Targets and completion percentage</p>
            </div>
          </header>
          <div class="goal-list">
            <div *ngFor="let goal of goals">
              <div>
                <strong>{{ goal.name }}</strong>
                <span>Target: {{ goal.target }}</span>
              </div>
              <small>{{ goal.progress }}%</small>
              <div class="progress-track"><span [style.width.%]="goal.progress" [style.background]="goal.color"></span></div>
            </div>
          </div>
        </article>

        <article class="dashboard-card calendar-card">
          <header class="card-header">
            <span class="card-icon amber"><i class="pi pi-calendar"></i></span>
            <div>
              <h3>Calendar</h3>
              <p>Daily, weekly and monthly rhythm</p>
            </div>
            <a routerLink="../calendar">Open</a>
          </header>
          <div class="calendar-tabs" role="tablist" aria-label="Calendar views">
            <button class="active" type="button">Daily</button>
            <button type="button">Weekly</button>
            <button type="button">Monthly</button>
          </div>
          <div class="mini-calendar">
            <span *ngFor="let day of calendarDays" [class.today]="day === todayDay">{{ day }}</span>
          </div>
        </article>

        <article class="dashboard-card motivation-card">
          <div class="motivation-image">
            <div>
              <span>Daily quote</span>
              <strong>Small steps every day. Big results one day.</strong>
            </div>
          </div>
          <div class="achievement-row">
            <div><i class="pi pi-trophy"></i><span>{{ completedTasks() }} tasks completed</span></div>
            <div><i class="pi pi-star"></i><span>{{ currentStreak() }} day streak</span></div>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .premium-dashboard {
      display: flex;
      flex-direction: column;
      gap: 18px;
      animation: dashboardIn 0.45s ease both;
    }

    .hero-panel, .kpi-card, .dashboard-card {
      background: color-mix(in srgb, var(--surface-card) 88%, transparent);
      border: 1px solid var(--border-color);
      box-shadow: 0 18px 52px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(22px);
    }

    .hero-panel {
      border-radius: 24px;
      min-height: 150px;
      padding: clamp(18px, 3vw, 28px);
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 22px;
      overflow: hidden;
      position: relative;
    }

    .hero-panel::after {
      content: '';
      position: absolute;
      inset: auto -8% -65% 45%;
      height: 180px;
      background: linear-gradient(90deg, rgba(14, 165, 233, 0.2), rgba(52, 211, 153, 0.2));
      filter: blur(42px);
      pointer-events: none;
    }

    .eyebrow, .muted-label {
      color: var(--text-secondary);
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .hero-copy h2 {
      font-size: clamp(1.45rem, 3vw, 2.35rem);
      line-height: 1.08;
      margin: 6px 0 8px;
      letter-spacing: 0;
    }

    .hero-copy p {
      color: var(--text-secondary);
      max-width: 760px;
      margin: 0;
    }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(96px, 1fr));
      gap: 12px;
      align-self: center;
      z-index: 1;
    }

    .hero-metrics div {
      min-height: 88px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      background: color-mix(in srgb, var(--bg-secondary) 78%, transparent);
      display: grid;
      place-items: center;
      padding: 10px;
    }

    .hero-metrics span {
      font-size: 1.45rem;
      font-weight: 900;
      color: var(--accent-primary);
    }

    .hero-metrics small {
      color: var(--text-secondary);
      font-weight: 800;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(9, minmax(150px, 1fr));
      gap: 14px;
      overflow-x: auto;
      padding-bottom: 4px;
      scroll-snap-type: x proximity;
    }

    .kpi-card {
      min-height: 132px;
      border-radius: 22px;
      padding: 14px;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      grid-template-rows: 1fr auto;
      gap: 10px 12px;
      scroll-snap-align: start;
      animation: cardIn 0.42s ease both;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
    }

    .kpi-card:hover, .dashboard-card:hover {
      transform: translateY(-4px);
      border-color: color-mix(in srgb, var(--accent-primary) 45%, var(--border-color));
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.13);
    }

    .kpi-icon, .card-icon {
      display: inline-grid;
      place-items: center;
      color: #fff;
      background: var(--tone);
      border-radius: 15px;
    }

    .kpi-icon {
      width: 44px;
      height: 44px;
      box-shadow: 0 12px 24px color-mix(in srgb, var(--tone) 36%, transparent);
    }

    .kpi-content {
      min-width: 0;
    }

    .kpi-content span {
      display: block;
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-weight: 800;
    }

    .kpi-content strong {
      display: block;
      margin-top: 3px;
      font-size: 1.35rem;
      line-height: 1.1;
      color: var(--text-primary);
    }

    .kpi-content small {
      color: var(--success);
      font-weight: 800;
    }

    .mini-ring {
      grid-column: 1 / -1;
      justify-self: end;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: conic-gradient(var(--accent-primary) calc(var(--progress) * 1%), color-mix(in srgb, var(--accent-primary) 12%, transparent) 0);
      display: grid;
      place-items: center;
      position: relative;
    }

    .mini-ring::after {
      content: '';
      position: absolute;
      inset: 6px;
      border-radius: inherit;
      background: var(--surface-card);
    }

    .mini-ring span {
      position: relative;
      z-index: 1;
      font-size: 0.68rem;
      font-weight: 900;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .dashboard-card {
      border-radius: 22px;
      padding: 16px;
      min-height: 300px;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
      overflow: hidden;
    }

    .dashboard-card.wide {
      grid-column: span 2;
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: 11px;
      margin-bottom: 16px;
    }

    .card-header h3 {
      margin: 0;
      font-size: 1rem;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .card-header p {
      margin: 4px 0 0;
      color: var(--text-secondary);
      font-size: 0.78rem;
      line-height: 1.35;
    }

    .card-header a {
      margin-left: auto;
      white-space: nowrap;
      color: var(--accent-primary);
      font-size: 0.78rem;
      font-weight: 900;
    }

    .card-icon {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
    }

    .red { --tone: linear-gradient(135deg, #f43f5e, #fb7185); }
    .violet { --tone: linear-gradient(135deg, #7c3aed, #60a5fa); }
    .blue { --tone: linear-gradient(135deg, #2563eb, #06b6d4); }
    .rose { --tone: linear-gradient(135deg, #db2777, #f97316); }
    .green { --tone: linear-gradient(135deg, #059669, #34d399); }
    .teal { --tone: linear-gradient(135deg, #0d9488, #22c55e); }
    .amber { --tone: linear-gradient(135deg, #f59e0b, #f97316); }

    .health-layout {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 18px;
      align-items: center;
    }

    .score-ring {
      width: 148px;
      height: 148px;
      border-radius: 50%;
      background: conic-gradient(#22c55e calc(var(--score) * 1%), rgba(34, 197, 94, 0.13) 0);
      display: grid;
      place-items: center;
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.16);
    }

    .score-ring::after {
      content: '';
      position: absolute;
      inset: 18px;
      border-radius: inherit;
      background: var(--surface-card);
      box-shadow: inset 0 0 0 1px var(--border-color);
    }

    .score-ring span, .score-ring small {
      position: relative;
      z-index: 1;
    }

    .score-ring span {
      font-size: 2rem;
      font-weight: 900;
    }

    .score-ring small {
      color: var(--text-secondary);
      margin-top: 42px;
      position: absolute;
      font-weight: 800;
    }

    .metric-list, .category-list, .reminder-list, .goal-list, .allocation, .timeline {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .metric-list div, .category-list div, .allocation div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      color: var(--text-secondary);
      font-size: 0.85rem;
    }

    .metric-list span, .category-list span, .allocation span {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .metric-list i {
      color: var(--accent-primary);
    }

    .metric-list strong, .category-list strong, .allocation strong {
      color: var(--text-primary);
    }

    .progress-track {
      grid-column: 1 / -1;
      height: 7px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
      overflow: hidden;
    }

    .progress-track span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #2563eb, #22c55e);
      animation: growWidth 0.8s ease both;
    }

    .expense-layout, .investment-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
    }

    .big-value, .portfolio-value strong {
      display: block;
      font-size: 1.75rem;
      line-height: 1.1;
      margin-top: 4px;
      letter-spacing: 0;
    }

    .positive {
      color: var(--success);
      font-weight: 800;
      font-size: 0.82rem;
      margin: 8px 0 0;
    }

    .donut {
      width: 112px;
      height: 112px;
      border-radius: 50%;
      position: relative;
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
    }

    .donut::after {
      content: '';
      position: absolute;
      inset: 28px;
      border-radius: inherit;
      background: var(--surface-card);
    }

    .category-list {
      margin-top: 18px;
    }

    .category-list i, .allocation i {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      flex: 0 0 auto;
    }

    .category-list small {
      color: var(--text-secondary);
    }

    .bar-chart {
      height: 184px;
      display: flex;
      align-items: end;
      gap: 10px;
      padding-top: 18px;
      border-bottom: 1px solid var(--border-color);
    }

    .bar-wrap {
      flex: 1;
      min-width: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: end;
      gap: 8px;
      position: relative;
    }

    .bar {
      width: 100%;
      min-height: 8px;
      border-radius: 10px 10px 4px 4px;
      background: linear-gradient(180deg, #0ea5e9, #2563eb);
      animation: growHeight 0.75s ease both;
    }

    .bar-tooltip {
      position: absolute;
      bottom: calc(100% + 8px);
      transform: translateY(6px);
      opacity: 0;
      pointer-events: none;
      background: var(--text-primary);
      color: var(--text-inverse);
      border-radius: 10px;
      padding: 6px 8px;
      white-space: nowrap;
      font-size: 0.72rem;
      transition: all var(--transition-fast);
      z-index: 2;
    }

    .bar-wrap:hover .bar-tooltip {
      opacity: 1;
      transform: translateY(0);
    }

    .bar-wrap small {
      color: var(--text-secondary);
      font-size: 0.7rem;
      font-weight: 800;
    }

    .split-metrics, .achievement-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 14px;
    }

    .split-metrics div, .achievement-row div {
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 10px;
      background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
    }

    .split-metrics span, .portfolio-value span {
      display: block;
      color: var(--text-secondary);
      font-weight: 800;
      font-size: 0.78rem;
    }

    .split-metrics strong {
      display: block;
      font-size: 1.25rem;
      line-height: 1.1;
      margin-top: 4px;
    }

    .line-chart {
      height: 170px;
      border-left: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      position: relative;
      background:
        linear-gradient(to top, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent),
        repeating-linear-gradient(to top, transparent 0 41px, var(--border-color) 42px);
      border-radius: 16px 16px 0 0;
    }

    .line-point {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #db2777;
      border: 3px solid var(--surface-card);
      position: absolute;
      transform: translate(-50%, 50%);
      box-shadow: 0 8px 18px rgba(219, 39, 119, 0.32);
    }

    .journal-note {
      margin-top: 14px;
      border: 1px solid var(--border-color);
      background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
      border-radius: 16px;
      padding: 12px;
      display: flex;
      gap: 10px;
      color: var(--text-secondary);
      font-size: 0.86rem;
    }

    .investment-layout {
      grid-template-columns: minmax(160px, 0.8fr) minmax(220px, 1.2fr) minmax(170px, 0.8fr);
    }

    .area-chart {
      height: 170px;
      display: flex;
      align-items: end;
      gap: 8px;
      padding: 14px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.16), rgba(14, 165, 233, 0.08));
      border: 1px solid var(--border-color);
    }

    .area-chart span {
      flex: 1;
      border-radius: 999px 999px 4px 4px;
      background: linear-gradient(180deg, #34d399, #0ea5e9);
      min-height: 16px;
      animation: growHeight 0.75s ease both;
    }

    .timeline {
      position: relative;
    }

    .timeline::before {
      content: '';
      position: absolute;
      top: 18px;
      bottom: 18px;
      left: 17px;
      width: 2px;
      background: var(--border-color);
    }

    .timeline-item {
      display: grid;
      grid-template-columns: 36px 74px minmax(0, 1fr) auto;
      gap: 9px;
      align-items: center;
      min-height: 42px;
      position: relative;
    }

    .status-dot {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid var(--border-color);
      background: var(--surface-card);
      color: var(--text-secondary);
      display: grid;
      place-items: center;
      z-index: 1;
    }

    .status-dot.done {
      background: var(--success);
      color: #fff;
      border-color: var(--success);
    }

    .timeline-item strong {
      color: var(--accent-primary);
      font-size: 0.82rem;
    }

    .timeline-item span {
      font-weight: 800;
      min-width: 0;
    }

    .timeline-item small {
      color: var(--text-secondary);
      font-weight: 700;
    }

    .chip-row, .calendar-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .chip, .calendar-tabs button {
      border: 1px solid var(--border-color);
      border-radius: 999px;
      background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
      color: var(--text-secondary);
      font-weight: 800;
      padding: 7px 12px;
      cursor: pointer;
    }

    .chip.active, .calendar-tabs button.active {
      background: var(--accent-primary);
      color: #fff;
      border-color: var(--accent-primary);
    }

    .reminder-list label {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 9px;
      min-height: 40px;
      color: var(--text-secondary);
    }

    .reminder-list input {
      width: 18px;
      height: 18px;
      accent-color: var(--accent-primary);
    }

    .reminder-list span {
      color: var(--text-primary);
      font-weight: 800;
      min-width: 0;
    }

    .reminder-list em {
      font-style: normal;
      border-radius: 999px;
      padding: 4px 8px;
      background: rgba(59, 130, 246, 0.12);
      color: #2563eb;
      font-size: 0.7rem;
      font-weight: 900;
    }

    .reminder-list em.high {
      background: rgba(244, 63, 94, 0.13);
      color: #e11d48;
    }

    .reminder-list small {
      color: var(--text-secondary);
      font-weight: 800;
    }

    .goal-list > div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    .goal-list strong {
      display: block;
    }

    .goal-list span {
      color: var(--text-secondary);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .goal-list small {
      font-weight: 900;
    }

    .mini-calendar {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 7px;
    }

    .mini-calendar span {
      aspect-ratio: 1;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      font-weight: 900;
      font-size: 0.82rem;
    }

    .mini-calendar span.today {
      background: linear-gradient(135deg, #2563eb, #0ea5e9);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.25);
    }

    .motivation-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .motivation-image {
      min-height: 230px;
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      align-items: end;
      padding: 18px;
      color: #fff;
      background:
        linear-gradient(180deg, transparent 20%, rgba(15, 23, 42, 0.78)),
        linear-gradient(135deg, #0f766e, #2563eb 52%, #f97316);
      position: relative;
    }

    .motivation-image::before {
      content: '';
      position: absolute;
      inset: 18% 8% auto;
      height: 42%;
      background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.02));
      clip-path: polygon(0 100%, 24% 32%, 42% 76%, 62% 16%, 100% 100%);
    }

    .motivation-image div {
      position: relative;
      z-index: 1;
    }

    .motivation-image span {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      font-weight: 900;
      opacity: 0.86;
    }

    .motivation-image strong {
      display: block;
      font-size: 1.25rem;
      line-height: 1.25;
      margin-top: 6px;
      max-width: 320px;
    }

    .achievement-row {
      margin-top: 0;
    }

    .achievement-row div {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);
      font-weight: 800;
    }

    .achievement-row i {
      color: var(--warning);
    }

    @media (max-width: 1400px) {
      .kpi-grid {
        grid-template-columns: repeat(9, minmax(168px, 1fr));
      }

      .dashboard-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 1100px) {
      .dashboard-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .investment-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .hero-panel {
        grid-template-columns: 1fr;
      }

      .hero-metrics {
        grid-template-columns: repeat(3, 1fr);
      }

      .dashboard-grid,
      .dashboard-card.wide {
        grid-template-columns: 1fr;
        grid-column: span 1;
      }

      .health-layout,
      .expense-layout {
        grid-template-columns: 1fr;
      }

      .score-ring, .donut {
        justify-self: center;
      }
    }

    @media (max-width: 520px) {
      .hero-metrics, .split-metrics, .achievement-row {
        grid-template-columns: 1fr;
      }

      .dashboard-card {
        padding: 14px;
      }

      .timeline-item {
        grid-template-columns: 34px 62px minmax(0, 1fr);
      }

      .timeline-item small {
        grid-column: 3;
      }

      .reminder-list label {
        grid-template-columns: auto minmax(0, 1fr) auto;
      }

      .reminder-list small {
        grid-column: 2 / -1;
      }
    }

    @keyframes dashboardIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes growWidth {
      from { width: 0; }
    }

    @keyframes growHeight {
      from { height: 0; }
    }
  `],
})
export class LifeTrackerDashboardComponent implements OnInit {
  private service = inject(LifeTrackerService);

  routines = signal<RoutineEntry[]>([]);
  reminders = signal<Reminder[]>([]);
  fitnessData = signal<FitnessEntry[]>([]);
  moodData = signal<MentalHealthEntry[]>([]);
  expenseData = signal<ExpenseEntry[]>([]);
  investmentData = signal<InvestmentEntry[]>([]);
  dietData = signal<DietEntry[]>([]);
  insights = signal<string[]>([]);

  todayDay = new Date().getDate();
  calendarDays = Array.from({ length: 31 }, (_, i) => i + 1);

  goals = [
    { name: 'Get Fit & Healthy', target: 'Dec 2026', progress: 75, color: '#22c55e' },
    { name: 'Clear AI Certification', target: 'Sep 2026', progress: 60, color: '#2563eb' },
    { name: 'Financial Freedom', target: 'Dec 2027', progress: 40, color: '#7c3aed' },
    { name: 'Build Own Business', target: 'Dec 2027', progress: 30, color: '#f97316' },
  ];

  totalExpenses = computed(() => this.expenseData().reduce((acc, item) => acc + Number(item.amount || 0), 0));
  totalInvestments = computed(() => this.investmentData().reduce((acc, item) => acc + Number(item.amount || 0), 0));
  lastFitness = computed(() => this.fitnessData().at(-1));
  lastMoodEntry = computed(() => this.moodData().at(-1));
  lastDiet = computed(() => this.dietData().at(-1));
  completedTasks = computed(() => this.routines().filter((item) => item.completed).length);
  totalTasks = computed(() => Math.max(this.routines().length, 1));
  todaysFocus = computed(() => Math.round((this.completedTasks() / this.totalTasks()) * 100));
  currentStreak = computed(() => Math.max(1, this.completedTasks() + this.moodData().length + this.fitnessData().length));
  totalExerciseMinutes = computed(() => this.fitnessData().reduce((acc, item) => acc + Number(item.duration || 0), 0));
  caloriesBurned = computed(() => Math.round(this.totalExerciseMinutes() * 7.4 + (this.lastFitness()?.steps || 0) * 0.04));
  waterLiters = computed(() => Number(((this.lastDiet()?.water || 0) * 0.25).toFixed(1)));
  healthScore = computed(() => {
    const stepScore = Math.min(((this.lastFitness()?.steps || 0) / 10000) * 35, 35);
    const sleepScore = Math.min(((this.lastMoodEntry()?.sleep || 0) / 8) * 30, 30);
    const moodScore = Math.min(((this.lastMoodEntry()?.mood || 0) / 10) * 20, 20);
    const waterScore = Math.min((this.waterLiters() / 3) * 15, 15);
    return Math.round(stepScore + sleepScore + moodScore + waterScore);
  });
  insightText = computed(() => this.insights()[0]?.replace(/[^\x20-\x7E]/g, '').trim() || 'Great job. Your day is balanced across health, focus and money.');
  latestReflection = computed(() => this.lastMoodEntry()?.reflection || 'No journal entry yet. Add a short reflection to track your emotional pattern.');

  expenseCategories = computed(() => {
    const totals: Record<string, number> = {};
    const total = this.totalExpenses() || 1;
    this.expenseData().forEach((item) => {
      totals[item.category || 'Other'] = (totals[item.category || 'Other'] || 0) + Number(item.amount || 0);
    });
    const colors = ['#2563eb', '#f43f5e', '#f59e0b', '#14b8a6', '#7c3aed', '#22c55e'];
    return Object.entries(totals).map(([name, amount], index) => ({
      name,
      amount,
      color: colors[index % colors.length],
      percent: Math.round((amount / total) * 100),
    }));
  });

  expenseDonut = computed(() => {
    const cats = this.expenseCategories();
    if (!cats.length) return 'conic-gradient(#2563eb 0 100%)';
    let cursor = 0;
    const stops = cats.map((cat) => {
      const start = cursor;
      cursor += cat.percent;
      return `${cat.color} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  investmentAllocation = computed(() => {
    const totals: Record<string, number> = {};
    const total = this.totalInvestments() || 1;
    this.investmentData().forEach((item) => {
      totals[item.type || 'Other'] = (totals[item.type || 'Other'] || 0) + Number(item.amount || 0);
    });
    const colors = ['#22c55e', '#2563eb', '#f97316', '#7c3aed'];
    return Object.entries(totals).map(([name, amount], index) => ({
      name,
      color: colors[index % colors.length],
      percent: Math.round((amount / total) * 100),
    }));
  });

  healthMetrics = computed(() => [
    { label: 'Steps', value: `${this.formatNumber(this.lastFitness()?.steps || 0)} / 10,000`, progress: Math.min(((this.lastFitness()?.steps || 0) / 10000) * 100, 100), icon: 'pi pi-compass' },
    { label: 'Water', value: `${this.waterLiters()} / 3 L`, progress: Math.min((this.waterLiters() / 3) * 100, 100), icon: 'pi pi-filter-fill' },
    { label: 'Sleep', value: `${this.lastMoodEntry()?.sleep || 0}h`, progress: Math.min(((this.lastMoodEntry()?.sleep || 0) / 8) * 100, 100), icon: 'pi pi-moon' },
    { label: 'Heart Rate', value: `${68 + this.completedTasks()} bpm`, progress: 72, icon: 'pi pi-heart-fill' },
    { label: 'Calories', value: `${this.caloriesBurned()} kcal`, progress: Math.min((this.caloriesBurned() / 600) * 100, 100), icon: 'pi pi-fire' },
  ]);

  kpis = computed<KpiCard[]>(() => [
    { label: 'Daily Steps', value: this.formatNumber(this.lastFitness()?.steps || 0), trend: '+12% vs yesterday', icon: 'pi pi-compass', tone: 'linear-gradient(135deg, #2563eb, #0ea5e9)', progress: Math.round(Math.min(((this.lastFitness()?.steps || 0) / 10000) * 100, 100)) },
    { label: 'Water Intake', value: `${this.waterLiters()} L`, trend: 'Goal 3 L', icon: 'pi pi-filter-fill', tone: 'linear-gradient(135deg, #06b6d4, #2563eb)', progress: Math.round(Math.min((this.waterLiters() / 3) * 100, 100)) },
    { label: 'Sleep Duration', value: `${this.lastMoodEntry()?.sleep || 0}h`, trend: 'Good sleep', icon: 'pi pi-moon', tone: 'linear-gradient(135deg, #6366f1, #8b5cf6)', progress: Math.round(Math.min(((this.lastMoodEntry()?.sleep || 0) / 8) * 100, 100)) },
    { label: 'Mood Score', value: `${this.lastMoodEntry()?.mood || 0}/10`, trend: 'Stable mood', icon: 'pi pi-face-smile', tone: 'linear-gradient(135deg, #db2777, #f97316)', progress: Math.round(((this.lastMoodEntry()?.mood || 0) / 10) * 100) },
    { label: "Today's Focus", value: `${this.todaysFocus()}%`, trend: 'On track', icon: 'pi pi-bullseye', tone: 'linear-gradient(135deg, #f43f5e, #f97316)', progress: this.todaysFocus() },
    { label: 'Completed Tasks', value: `${this.completedTasks()}/${this.totalTasks()}`, trend: 'Keep momentum', icon: 'pi pi-check-circle', tone: 'linear-gradient(135deg, #16a34a, #22c55e)', progress: this.todaysFocus() },
    { label: 'Productivity Score', value: `${Math.min(98, this.todaysFocus() + 12)}%`, trend: '+5% this week', icon: 'pi pi-chart-line', tone: 'linear-gradient(135deg, #7c3aed, #2563eb)', progress: Math.min(98, this.todaysFocus() + 12) },
    { label: 'Current Streak', value: `${this.currentStreak()} days`, trend: 'Personal best', icon: 'pi pi-star', tone: 'linear-gradient(135deg, #f59e0b, #f97316)', progress: Math.min(this.currentStreak() * 7, 100) },
    { label: "Today's Expenses", value: this.currency(this.totalExpenses()), trend: 'Within budget', icon: 'pi pi-wallet', tone: 'linear-gradient(135deg, #0f766e, #14b8a6)', progress: Math.min(Math.round((this.totalExpenses() / 1200) * 100), 100) },
  ]);

  ngOnInit() {
    this.insights.set(this.service.getInsights());
    this.service.routines$.subscribe((data) => this.routines.set(data.length ? data : this.defaultRoutines()));
    this.service.reminders$.subscribe((data) => this.reminders.set(data.length ? data : this.defaultReminders()));
    this.service.fitness$.subscribe((data) => this.fitnessData.set(this.padFitnessData(data).slice(-7)));
    this.service.mentalHealth$.subscribe((data) => this.moodData.set(this.padMoodData(data).slice(-7)));
    this.service.expenses$.subscribe((data) => this.expenseData.set(data));
    this.service.investments$.subscribe((data) => this.investmentData.set(data));
    this.service.diet$.subscribe((data) => this.dietData.set(data));
  }

  currency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value || 0);
  }

  barHeight(value: number): number {
    const max = Math.max(...this.fitnessData().map((item) => item.duration), 60);
    return Math.max((value / max) * 100, 8);
  }

  lineX(index: number, count: number): number {
    if (count <= 1) return 50;
    return (index / (count - 1)) * 92 + 4;
  }

  shortDate(date: string): string {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? date.slice(5) : parsed.toLocaleDateString('en-US', { weekday: 'short' });
  }

  private padFitnessData(data: FitnessEntry[]): FitnessEntry[] {
    if (data.length >= 5) return data;
    const today = new Date();
    const samples = [26, 38, 31, 48, 34, 52, 44].map((duration, index) => ({
      id: `sample-f-${index}`,
      date: new Date(today.getTime() - (6 - index) * 86400000).toISOString().split('T')[0],
      activity: ['Walk', 'Yoga', 'Run', 'Gym', 'Cycle', 'HIIT', 'Stretch'][index],
      duration,
      steps: 3600 + index * 720,
      intensity: (index % 3 === 0 ? 'High' : index % 2 === 0 ? 'Medium' : 'Low') as FitnessEntry['intensity'],
    }));
    return [...samples, ...data].slice(-7);
  }

  private padMoodData(data: MentalHealthEntry[]): MentalHealthEntry[] {
    if (data.length >= 5) return data;
    const today = new Date();
    const samples = [6, 7, 6, 8, 7, 8, 8].map((mood, index) => ({
      id: `sample-m-${index}`,
      date: new Date(today.getTime() - (6 - index) * 86400000).toISOString().split('T')[0],
      mood,
      sleep: 6.5 + (index % 3) * 0.5,
      reflection: 'Focused, calm and building a better rhythm.',
    }));
    return [...samples, ...data].slice(-7);
  }

  private defaultRoutines(): RoutineEntry[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      { id: 'r1', date: today, time: '05:00', task: 'Wake up & meditation', frequency: 'Daily', completed: true },
      { id: 'r2', date: today, time: '06:00', task: 'Workout & mobility', frequency: 'Daily', completed: true },
      { id: 'r3', date: today, time: '10:00', task: 'Deep work block', frequency: 'Daily', completed: false },
      { id: 'r4', date: today, time: '21:30', task: 'Plan tomorrow', frequency: 'Daily', completed: false },
    ];
  }

  private defaultReminders(): Reminder[] {
    return [
      { id: 'rm1', time: '09:00', task: 'Drink 3L water', active: true },
      { id: 'rm2', time: '13:00', task: 'Review budget', active: true },
      { id: 'rm3', time: '19:00', task: 'Read 20 pages', active: true },
    ];
  }
}
