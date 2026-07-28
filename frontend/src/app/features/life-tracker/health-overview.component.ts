import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DietEntry, FitnessEntry, LifeTrackerService, MentalHealthEntry, RoutineEntry } from './life-tracker.service';

interface SummaryCard {
  label: string;
  value: string;
  unit: string;
  status: string;
  compare: string;
  icon: string;
  tone: string;
  trend: number[];
}

@Component({
  selector: 'app-health-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="health-page">
      <section class="health-hero">
        <div>
          <p>Welcome back, Mani</p>
          <h2>Your body dashboard is looking steady.</h2>
          <span>{{ primaryInsight() }}</span>
        </div>
        <div class="hero-actions">
          <a routerLink="../health/add" class="primary-action"><i class="pi pi-plus"></i>Add New</a>
          <button type="button" class="ghost-action"><i class="pi pi-file-pdf"></i>Export Report</button>
        </div>
      </section>

      <section class="summary-grid" aria-label="Health summary">
        <article class="summary-card" *ngFor="let card of summaryCards(); let i = index" [style.animation-delay.ms]="i * 45">
          <div class="summary-icon" [style.background]="card.tone"><i [class]="card.icon"></i></div>
          <div>
            <span>{{ card.label }}</span>
            <strong>{{ card.value }} <small>{{ card.unit }}</small></strong>
            <em>{{ card.status }}</em>
          </div>
          <svg viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">
            <polyline [attr.points]="sparkline(card.trend)" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
          </svg>
          <p>{{ card.compare }}</p>
        </article>
      </section>

      <section class="health-grid">
        <article class="panel vitals">
          <header><h3>Vital Signs</h3><span>Today, 7:30 AM</span></header>
          <div class="vital-grid">
            <div *ngFor="let vital of vitals">
              <i [class]="vital.icon"></i>
              <span>{{ vital.label }}</span>
              <strong>{{ vital.value }}</strong>
              <small>{{ vital.unit }}</small>
            </div>
          </div>
          <a routerLink="../MentalHealth">View All Vitals <i class="pi pi-chevron-right"></i></a>
        </article>

        <article class="panel trend-panel">
          <header><h3>Weight Trend</h3><select aria-label="Weight period"><option>This Month</option><option>Weekly</option><option>Yearly</option></select></header>
          <div class="trend-value"><strong>{{ weightKg() }} <small>kg</small></strong><span><i class="pi pi-arrow-down"></i>1.2 kg</span></div>
          <div class="weight-chart" aria-label="Monthly weight trend">
            <span *ngFor="let point of weightTrend; let i = index" [style.left.%]="lineX(i, weightTrend.length)" [style.bottom.%]="point"></span>
          </div>
          <div class="chart-labels"><small>May 1</small><small>May 14</small><small>May 31</small></div>
        </article>

        <article class="panel activity">
          <header><h3>Activity Summary</h3><span>Today</span></header>
          <div class="activity-layout">
            <div class="activity-ring" [style.--steps]="stepsProgress()">
              <strong>{{ formatNumber(steps()) }}</strong>
              <span>Steps</span>
            </div>
            <div class="activity-list">
              <div *ngFor="let item of activityStats"><i [class]="item.icon"></i><span>{{ item.label }}</span><strong>{{ item.value() }}</strong></div>
            </div>
          </div>
        </article>

        <article class="panel sleep">
          <header><h3>Sleep Analysis</h3><span>Today</span></header>
          <div class="sleep-head"><strong>{{ sleepHours() }}h</strong><div class="score-badge">80</div></div>
          <div class="sleep-bar"><span class="deep"></span><span class="light"></span><span class="rem"></span><span class="awake"></span></div>
          <div class="legend"><span>Deep</span><span>REM</span><span>Awake</span></div>
          <a routerLink="../MentalHealth">View Sleep Details <i class="pi pi-chevron-right"></i></a>
        </article>

        <article class="panel water">
          <header><h3>Water Intake</h3><span>Today</span></header>
          <div class="water-layout">
            <div class="water-ring" [style.--water]="waterProgress()"><strong>{{ waterLiters() }} / 3</strong><span>Liters</span></div>
            <div class="timeline">
              <div *ngFor="let item of waterTimeline"><i class="pi pi-filter-fill"></i><span>{{ item.amount }}</span><small>{{ item.time }}</small><i class="pi pi-check-circle ok"></i></div>
            </div>
          </div>
          <button type="button" class="link-button">Add Water <i class="pi pi-plus"></i></button>
        </article>

        <article class="panel nutrition">
          <header><h3>Nutrition Summary</h3><span>Today</span></header>
          <div class="nutrition-layout">
            <div class="nutrition-ring"><strong>{{ calories() }}</strong><span>kcal</span></div>
            <div class="macro-list">
              <div><span>Protein</span><strong>120g / 30%</strong></div>
              <div><span>Carbs</span><strong>180g / 40%</strong></div>
              <div><span>Fat</span><strong>55g / 30%</strong></div>
            </div>
          </div>
        </article>

        <article class="panel workout">
          <header><h3>Today's Workout</h3><a routerLink="../Fitness">View All</a></header>
          <div class="workout-icon"><i class="pi pi-bolt"></i></div>
          <h4>{{ workoutName() }}</h4>
          <p>Upper Body</p>
          <div class="workout-stats"><div><span>Duration</span><strong>{{ workoutMinutes() }} min</strong></div><div><span>Calories</span><strong>{{ calories() }}</strong></div><div><span>Exercises</span><strong>6</strong></div></div>
          <em>Completed</em>
        </article>

        <article class="panel habits wide">
          <header><h3>Habits</h3><span>This Week</span></header>
          <div class="habit-table">
            <div class="habit-row header"><span></span><b *ngFor="let day of weekDays">{{ day }}</b></div>
            <div class="habit-row" *ngFor="let habit of habits"><span><i [class]="habit.icon"></i>{{ habit.name }}</span><b *ngFor="let done of habit.days" [class.done]="done"></b></div>
          </div>
        </article>

        <article class="panel medicines wide">
          <header><h3>Medicine Schedule</h3><span>Today</span></header>
          <div class="medicine-list">
            <div *ngFor="let med of medicines"><span>{{ med.name }}</span><small>{{ med.dose }}</small><strong>{{ med.time }}</strong><em [class.taken]="med.status === 'Taken'">{{ med.status }}</em></div>
          </div>
        </article>

        <article class="panel appointments wide">
          <header><h3>Upcoming Appointments</h3><a routerLink="../calendar">View All</a></header>
          <div class="appointment-list">
            <div *ngFor="let appt of appointments"><i [class]="appt.icon"></i><span><strong>{{ appt.title }}</strong><small>{{ appt.subtitle }}</small></span><b>{{ appt.date }}</b><em>{{ appt.time }}</em></div>
          </div>
        </article>

        <article class="panel insights wide">
          <header><h3>AI Health Insights</h3><span>Personalized</span></header>
          <div class="insight-cards"><div *ngFor="let item of insights()"><i [class]="item.icon"></i><strong>{{ item.title }}</strong><span>{{ item.text }}</span></div></div>
        </article>

        <article class="panel records wide">
          <header><h3>Health Records</h3><a routerLink="../MentalHealth">View All Records</a></header>
          <div class="record-grid"><div *ngFor="let record of records"><i [class]="record.icon"></i><span>{{ record.label }}</span><strong>{{ record.count }} Records</strong></div></div>
        </article>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .health-page { display: flex; flex-direction: column; gap: 14px; color: var(--text-primary); }
    .health-hero, .summary-card, .panel { background: color-mix(in srgb, var(--surface-card) 90%, transparent); border: 1px solid var(--border-color); box-shadow: 0 18px 52px rgba(15, 23, 42, 0.08); backdrop-filter: blur(22px); }
    .health-hero { min-height: 126px; border-radius: 24px; padding: 22px; display: flex; justify-content: space-between; gap: 18px; align-items: center; background: linear-gradient(135deg, color-mix(in srgb, var(--surface-card) 88%, transparent), color-mix(in srgb, var(--accent-primary) 10%, var(--surface-card))); }
    .health-hero p, .health-hero span, header span, .summary-card span, .summary-card p, small { color: var(--text-secondary); }
    .health-hero h2 { margin: 3px 0 4px; font-size: clamp(1.55rem, 3vw, 2.35rem); line-height: 1.08; letter-spacing: 0; }
    .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .primary-action, .ghost-action, .link-button { min-height: 42px; border-radius: 14px; padding: 0 14px; display: inline-flex; align-items: center; gap: 8px; font-weight: 850; border: 1px solid var(--border-color); cursor: pointer; }
    .primary-action { color: #fff; background: linear-gradient(135deg, #4f46e5, #0ea5e9); border-color: transparent; box-shadow: 0 16px 34px rgba(79, 70, 229, 0.28); }
    .ghost-action, .link-button { background: var(--surface-card); color: var(--text-primary); }
    .summary-grid { display: grid; grid-template-columns: repeat(6, minmax(170px, 1fr)); gap: 12px; }
    .summary-card { min-height: 150px; border-radius: 18px; padding: 13px; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 9px; animation: rise 0.38s ease both; }
    .summary-icon { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; color: #fff; }
    .summary-card strong { display: block; font-size: 1.35rem; line-height: 1.1; }
    .summary-card small { font-size: 0.76rem; }
    .summary-card em { color: var(--success); font-style: normal; font-size: 0.78rem; font-weight: 800; }
    .summary-card svg { grid-column: 1 / -1; color: var(--accent-primary); height: 38px; }
    .summary-card p { grid-column: 1 / -1; font-size: 0.78rem; margin: 0; }
    .health-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    .panel { border-radius: 18px; padding: 15px; min-height: 236px; overflow: hidden; }
    .panel:hover, .summary-card:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--accent-primary) 45%, var(--border-color)); transition: all var(--transition-fast); }
    .vitals, .trend-panel, .activity { grid-column: span 2; }
    .sleep, .water, .nutrition, .workout { grid-column: span 2; }
    .wide { grid-column: span 2; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
    h3 { font-size: 0.98rem; margin: 0; letter-spacing: 0; }
    select { color: var(--text-primary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px; padding: 6px 9px; }
    .vital-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden; }
    .vital-grid div { min-height: 92px; padding: 10px; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
    .vital-grid i, .record-grid i, .appointment-list i { color: var(--accent-primary); }
    .vital-grid span { display: block; font-size: 0.72rem; color: var(--text-secondary); }
    .vital-grid strong { display: block; font-size: 1rem; }
    .panel > a, header a { color: var(--accent-primary); font-size: 0.78rem; font-weight: 900; }
    .trend-value { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
    .trend-value strong { font-size: 1.7rem; }
    .trend-value span { color: var(--success); font-weight: 900; }
    .weight-chart { height: 170px; position: relative; border-bottom: 1px solid var(--border-color); background: repeating-linear-gradient(to top, transparent 0 41px, var(--border-color) 42px); }
    .weight-chart span { width: 9px; height: 9px; position: absolute; border-radius: 50%; background: #635bff; transform: translate(-50%, 50%); box-shadow: 0 0 0 5px rgba(99,91,255,0.1); }
    .chart-labels, .workout-stats { display: flex; justify-content: space-between; gap: 8px; }
    .activity-layout, .water-layout, .nutrition-layout { display: grid; grid-template-columns: 138px minmax(0, 1fr); gap: 16px; align-items: center; }
    .activity-ring, .water-ring, .nutrition-ring { width: 136px; height: 136px; border-radius: 50%; display: grid; place-items: center; align-content: center; position: relative; }
    .activity-ring { background: conic-gradient(#6255f6 calc(var(--steps) * 1%), #22c55e 0 70%, #fb923c 70% 86%, #e5e7eb 0); }
    .water-ring { background: conic-gradient(#0ea5e9 calc(var(--water) * 1%), color-mix(in srgb, #0ea5e9 14%, transparent) 0); }
    .nutrition-ring { background: conic-gradient(#22c55e 0 30%, #3b82f6 30% 70%, #ef4444 70% 100%); }
    .activity-ring::after, .water-ring::after, .nutrition-ring::after { content: ''; position: absolute; inset: 16px; border-radius: inherit; background: var(--surface-card); }
    .activity-ring strong, .activity-ring span, .water-ring strong, .water-ring span, .nutrition-ring strong, .nutrition-ring span { position: relative; z-index: 1; }
    .activity-list, .timeline, .macro-list, .medicine-list, .appointment-list { display: flex; flex-direction: column; gap: 10px; }
    .activity-list div, .timeline div, .macro-list div, .medicine-list div, .appointment-list div { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 9px; align-items: center; color: var(--text-secondary); }
    .activity-list strong, .medicine-list strong { color: var(--text-primary); }
    .sleep-head { display: flex; justify-content: space-between; align-items: center; }
    .sleep-head strong { font-size: 1.7rem; }
    .score-badge { width: 48px; height: 48px; border-radius: 50%; border: 5px solid var(--success); display: grid; place-items: center; font-weight: 900; }
    .sleep-bar { height: 26px; border-radius: 8px; display: flex; overflow: hidden; margin: 16px 0; background: var(--bg-secondary); }
    .sleep-bar span:nth-child(1) { flex: 1.5; background: #4f46e5; } .sleep-bar span:nth-child(2) { flex: 2; background: #7c3aed; } .sleep-bar span:nth-child(3) { flex: 1.2; background: #60a5fa; } .sleep-bar span:nth-child(4) { flex: 0.35; background: #f472b6; }
    .legend, .insight-cards, .record-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .timeline div { grid-template-columns: auto minmax(0, 1fr) auto auto; }
    .ok { color: var(--success); }
    .workout { text-align: center; }
    .workout-icon { width: 58px; height: 58px; margin: 4px auto 10px; border-radius: 16px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #7c3aed, #60a5fa); font-size: 1.4rem; }
    .workout h4 { margin: 0; } .workout p { color: var(--text-secondary); margin: 0 0 14px; }
    .workout-stats div { flex: 1; border-top: 1px solid var(--border-color); padding-top: 10px; }
    .workout em, .medicine-list em { display: inline-block; margin-top: 12px; padding: 5px 12px; border-radius: 999px; color: var(--success); background: rgba(16,185,129,0.12); font-style: normal; font-weight: 900; }
    .habit-table { display: grid; gap: 9px; }
    .habit-row { display: grid; grid-template-columns: minmax(130px, 1fr) repeat(7, 24px); align-items: center; gap: 11px; }
    .habit-row span { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 800; }
    .habit-row b { width: 18px; height: 18px; border-radius: 50%; background: var(--bg-tertiary); border: 1px solid var(--border-color); }
    .habit-row b.done { background: var(--success); border-color: var(--success); }
    .medicine-list div { grid-template-columns: minmax(0, 1fr) auto auto auto; padding: 9px 0; border-bottom: 1px solid var(--border-color); }
    .medicine-list em:not(.taken) { color: var(--warning); background: rgba(245,158,11,0.13); }
    .appointment-list div { grid-template-columns: 36px minmax(0, 1fr) auto auto; padding: 10px; border: 1px solid var(--border-color); border-radius: 14px; }
    .appointment-list small { display: block; }
    .insight-cards div, .record-grid div { border: 1px solid var(--border-color); border-radius: 14px; padding: 12px; background: color-mix(in srgb, var(--bg-secondary) 70%, transparent); }
    .insight-cards i { color: var(--success); }
    .insight-cards strong, .insight-cards span, .record-grid span, .record-grid strong { display: block; }
    .insight-cards span { font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px; }
    .record-grid { grid-template-columns: repeat(5, 1fr); }
    .record-grid strong { color: var(--text-secondary); font-size: 0.76rem; }
    @media (max-width: 1500px) { .summary-grid { grid-template-columns: repeat(3, 1fr); } .health-grid { grid-template-columns: repeat(4, 1fr); } .vitals, .trend-panel, .activity, .wide { grid-column: span 2; } .sleep, .water, .nutrition, .workout { grid-column: span 2; } }
    @media (max-width: 900px) { .health-hero { flex-direction: column; align-items: flex-start; } .summary-grid, .health-grid, .legend, .record-grid, .insight-cards { grid-template-columns: 1fr; } .vitals, .trend-panel, .activity, .sleep, .water, .nutrition, .workout, .wide { grid-column: span 1; } .vital-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 560px) { .activity-layout, .water-layout, .nutrition-layout { grid-template-columns: 1fr; } .activity-ring, .water-ring, .nutrition-ring { justify-self: center; } .habit-row { grid-template-columns: minmax(108px, 1fr) repeat(7, 16px); gap: 7px; } }
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class HealthOverviewComponent implements OnInit {
  private service = inject(LifeTrackerService);

  fitnessData = signal<FitnessEntry[]>([]);
  dietData = signal<DietEntry[]>([]);
  mentalData = signal<MentalHealthEntry[]>([]);
  routines = signal<RoutineEntry[]>([]);
  rawInsights = signal<string[]>([]);

  weightTrend = [86, 78, 60, 65, 69, 62, 54, 50, 53, 43, 45, 39, 36, 31, 18];
  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  vitals = [
    { label: 'Blood Pressure', value: '120/80', unit: 'mmHg', icon: 'pi pi-heart-fill' },
    { label: 'Heart Rate', value: '68', unit: 'bpm', icon: 'pi pi-heart' },
    { label: 'SpO2', value: '98%', unit: '', icon: 'pi pi-filter-fill' },
    { label: 'Body Temp', value: '36.6 C', unit: '', icon: 'pi pi-sun' },
    { label: 'Blood Sugar', value: '98', unit: 'mg/dL', icon: 'pi pi-bolt' },
    { label: 'Respiratory Rate', value: '18', unit: 'breaths/min', icon: 'pi pi-compass' },
    { label: 'Stress Level', value: 'Low', unit: '', icon: 'pi pi-face-smile' },
    { label: 'Energy Level', value: 'High', unit: '', icon: 'pi pi-sparkles' },
  ];
  waterTimeline = [
    { amount: '250 ml', time: '07:00 AM' }, { amount: '500 ml', time: '09:30 AM' },
    { amount: '500 ml', time: '12:30 PM' }, { amount: '500 ml', time: '03:30 PM' },
  ];
  habits = [
    { name: 'Drink Water', icon: 'pi pi-filter-fill', days: [true, false, false, true, true, false, false] },
    { name: 'Morning Walk', icon: 'pi pi-compass', days: [true, true, true, true, true, false, false] },
    { name: 'Workout', icon: 'pi pi-bolt', days: [true, true, false, true, false, false, false] },
    { name: 'Meditation', icon: 'pi pi-moon', days: [true, true, true, true, true, false, false] },
  ];
  medicines = [
    { name: 'Vitamin D3', dose: '1000 IU', time: '09:00 AM', status: 'Taken' },
    { name: 'Fish Oil', dose: '1 Capsule', time: '01:00 PM', status: 'Pending' },
    { name: 'Multivitamin', dose: '1 Tablet', time: '07:00 PM', status: 'Pending' },
  ];
  appointments = [
    { title: 'Dr. Rajesh Kumar', subtitle: 'Cardiologist', date: 'May 28, 2024', time: '10:00 AM', icon: 'pi pi-user' },
    { title: 'Health Checkup', subtitle: 'Full Body Checkup', date: 'Jun 05, 2024', time: '09:30 AM', icon: 'pi pi-heart' },
    { title: 'Dental Cleaning', subtitle: 'Dental Care', date: 'Jun 12, 2024', time: '11:00 AM', icon: 'pi pi-shield' },
  ];
  records = [
    { label: 'Lab Reports', count: '12', icon: 'pi pi-file' },
    { label: 'Prescriptions', count: '08', icon: 'pi pi-book' },
    { label: 'Medical History', count: '05', icon: 'pi pi-folder' },
    { label: 'Vaccination', count: '07', icon: 'pi pi-verified' },
    { label: 'Allergies', count: '03', icon: 'pi pi-exclamation-triangle' },
  ];

  latestFitness = computed(() => this.fitnessData().at(-1));
  latestDiet = computed(() => this.dietData().at(-1));
  latestMental = computed(() => this.mentalData().at(-1));
  steps = computed(() => this.latestFitness()?.steps || 7842);
  weightKg = computed(() => 72.5);
  sleepHours = computed(() => this.latestMental()?.sleep || 7.3);
  waterLiters = computed(() => Number(((this.latestDiet()?.water || 6) * 0.25).toFixed(1)));
  calories = computed(() => this.latestDiet()?.calories || Math.round((this.latestFitness()?.duration || 45) * 7.1));
  workoutMinutes = computed(() => this.latestFitness()?.duration || 45);
  workoutName = computed(() => this.latestFitness()?.activity || 'Strength Training');
  stepsProgress = computed(() => Math.min(Math.round((this.steps() / 10000) * 100), 100));
  waterProgress = computed(() => Math.min(Math.round((this.waterLiters() / 3) * 100), 100));
  primaryInsight = computed(() => this.rawInsights()[0]?.replace(/[^\x20-\x7E]/g, '').trim() || 'Hydration and sleep are your strongest levers today.');
  activityStats = [
    { label: 'Distance', icon: 'pi pi-map-marker', value: () => `${(this.steps() * 0.00072).toFixed(1)} km` },
    { label: 'Calories', icon: 'pi pi-fire', value: () => `${this.calories()} kcal` },
    { label: 'Floors', icon: 'pi pi-building', value: () => '12 floors' },
    { label: 'Active Time', icon: 'pi pi-clock', value: () => `${this.workoutMinutes()} min` },
  ];
  insights = computed(() => [
    { title: 'Great Job', text: 'You have hit your step goal for 5 days in a row.', icon: 'pi pi-check-circle' },
    { title: 'Improve Sleep', text: 'Try to sleep at least 7-8 hours for better recovery.', icon: 'pi pi-moon' },
    { title: 'Hydration', text: `You are ${Math.max(0, 3 - this.waterLiters()).toFixed(1)} liters short of your daily goal.`, icon: 'pi pi-filter-fill' },
  ]);
  summaryCards = computed<SummaryCard[]>(() => [
    { label: 'Health Score', value: '85', unit: '/100', status: 'Excellent', compare: '+4 this week', icon: 'pi pi-heart-fill', tone: 'linear-gradient(135deg,#f43f5e,#fb7185)', trend: [30, 50, 54, 46, 51, 42, 58] },
    { label: 'BMI', value: '24.1', unit: '', status: 'Normal', compare: 'Stable', icon: 'pi pi-id-card', tone: 'linear-gradient(135deg,#10b981,#86efac)', trend: [35, 48, 44, 39, 45, 36, 50] },
    { label: 'Weight', value: String(this.weightKg()), unit: 'kg', status: 'Good', compare: '-1.2 kg this week', icon: 'pi pi-box', tone: 'linear-gradient(135deg,#3b82f6,#93c5fd)', trend: [42, 48, 44, 46, 40, 55, 61] },
    { label: 'Sleep', value: `${Math.floor(this.sleepHours())}h`, unit: `${Math.round((this.sleepHours() % 1) * 60)}m`, status: 'Good', compare: '+20m average', icon: 'pi pi-moon', tone: 'linear-gradient(135deg,#7c3aed,#c4b5fd)', trend: [34, 45, 49, 41, 44, 57, 48] },
    { label: 'Water', value: String(this.waterLiters()), unit: '/ 3 L', status: `${this.waterProgress()}% Goal`, compare: '2 glasses left', icon: 'pi pi-filter-fill', tone: 'linear-gradient(135deg,#06b6d4,#7dd3fc)', trend: [20, 28, 38, 45, 54, 62, 72] },
    { label: 'Heart Rate', value: '68', unit: 'bpm', status: 'Normal', compare: '-3 bpm resting', icon: 'pi pi-heart', tone: 'linear-gradient(135deg,#fb923c,#f43f5e)', trend: [38, 55, 47, 61, 50, 58, 66] },
  ]);

  ngOnInit() {
    this.rawInsights.set(this.service.getInsights());
    this.service.fitness$.subscribe((data) => this.fitnessData.set(data));
    this.service.diet$.subscribe((data) => this.dietData.set(data));
    this.service.mentalHealth$.subscribe((data) => this.mentalData.set(data));
    this.service.routines$.subscribe((data) => this.routines.set(data));
  }

  sparkline(values: number[]): string {
    const max = Math.max(...values);
    const min = Math.min(...values);
    return values.map((value, index) => `${(index / (values.length - 1)) * 116 + 2},${34 - ((value - min) / Math.max(max - min, 1)) * 28}`).join(' ');
  }

  lineX(index: number, count: number): number {
    return count <= 1 ? 50 : (index / (count - 1)) * 94 + 3;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value || 0);
  }
}
