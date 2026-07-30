import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MentalWellnessService } from './mental-wellness.service';
import { MentalWellnessEntry, WellnessInsight } from './mental-wellness.models';

@Component({
  selector: 'app-mental-wellness-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="mw-dashboard">
      <!-- Top Header / Navigation Tabs -->
      <header class="mw-header">
        <div class="mw-title-block">
          <h2>Mind & Mental Wellness 🧠</h2>
          <p>Calm mind, better decisions.</p>
        </div>
        <div class="mw-header-right">
          <nav class="mw-tabs" role="tablist">
            <button type="button" class="tab-btn" [class.active]="activeTab() === 'overview'" (click)="activeTab.set('overview')">Overview</button>
            <button type="button" class="tab-btn" [class.active]="activeTab() === 'insights'" (click)="activeTab.set('insights')">Insights</button>
            <button type="button" class="tab-btn" [class.active]="activeTab() === 'trends'" (click)="activeTab.set('trends')">Trends</button>
            <button type="button" class="tab-btn" [class.active]="activeTab() === 'history'" (click)="activeTab.set('history')">History</button>
          </nav>
          <div class="date-picker-wrap">
            <button type="button" class="date-nav-btn" (click)="changeDate(-1)"><i class="pi pi-chevron-left"></i></button>
            <div class="date-badge">
              <i class="pi pi-calendar"></i>
              <span>{{ formattedCurrentDate() }}</span>
            </div>
            <button type="button" class="date-nav-btn" (click)="changeDate(1)"><i class="pi pi-chevron-right"></i></button>
          </div>
          <a routerLink="add" class="add-entry-btn">
            <i class="pi pi-plus"></i>
            <span>Add Entry</span>
          </a>
        </div>
      </header>

      <!-- ─── 1. TOP SUMMARY CARDS ─── -->
      <section class="summary-cards-grid" aria-label="Mental wellness summary">
        <!-- Happiness Score -->
        <article class="summary-card happiness-tone">
          <div class="card-top">
            <div class="card-icon"><i class="pi pi-face-smile"></i></div>
            <span class="card-label">Happiness Score</span>
          </div>
          <div class="card-middle">
            <strong class="card-score">{{ Math.round((latestEntry()?.happinessScore ?? 7.8) * 10) }} <small>/100</small></strong>
            <span class="status-chip success">Good</span>
          </div>
          <div class="card-bottom">
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" class="sparkline">
              <polyline points="0,18 16,14 33,19 50,10 66,12 83,8 100,5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <small class="trend-diff positive"><i class="pi pi-arrow-up"></i> +5% vs last week</small>
          </div>
        </article>

        <!-- Anxiety Level -->
        <article class="summary-card anxiety-tone">
          <div class="card-top">
            <div class="card-icon"><i class="pi pi-shield"></i></div>
            <span class="card-label">Anxiety Level</span>
          </div>
          <div class="card-middle">
            <strong class="card-score">{{ Math.round((latestEntry()?.anxietyLevel ?? 2.5) * 10) }} <small>/100</small></strong>
            <span class="status-chip info">Mild</span>
          </div>
          <div class="card-bottom">
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" class="sparkline">
              <polyline points="0,10 16,14 33,8 50,16 66,12 83,18 100,9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <small class="trend-diff positive"><i class="pi pi-arrow-down"></i> -3% vs last week</small>
          </div>
        </article>

        <!-- Stress Level -->
        <article class="summary-card stress-tone">
          <div class="card-top">
            <div class="card-icon"><i class="pi pi-bolt"></i></div>
            <span class="card-label">Stress Level</span>
          </div>
          <div class="card-middle">
            <strong class="card-score">{{ Math.round((latestEntry()?.stressLevel ?? 3.2) * 10) }} <small>/100</small></strong>
            <span class="status-chip warning">Moderate</span>
          </div>
          <div class="card-bottom">
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" class="sparkline">
              <polyline points="0,12 16,8 33,15 50,11 66,18 83,14 100,10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <small class="trend-diff neutral"><i class="pi pi-minus"></i> Stable</small>
          </div>
        </article>

        <!-- Emotional Control -->
        <article class="summary-card emotional-tone">
          <div class="card-top">
            <div class="card-icon"><i class="pi pi-sun"></i></div>
            <span class="card-label">Emotional Control</span>
          </div>
          <div class="card-middle">
            <strong class="card-score">76 <small>/100</small></strong>
            <span class="status-chip success">Good</span>
          </div>
          <div class="card-bottom">
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" class="sparkline">
              <polyline points="0,16 16,12 33,14 50,8 66,10 83,6 100,4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <small class="trend-diff positive"><i class="pi pi-arrow-up"></i> +8% vs last week</small>
          </div>
        </article>

        <!-- Positive Thoughts -->
        <article class="summary-card thoughts-tone">
          <div class="card-top">
            <div class="card-icon"><i class="pi pi-heart"></i></div>
            <span class="card-label">Positive Thoughts</span>
          </div>
          <div class="card-middle">
            <strong class="card-score">84 <small>/100</small></strong>
            <span class="status-chip success">Excellent</span>
          </div>
          <div class="card-bottom">
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" class="sparkline">
              <polyline points="0,18 16,14 33,10 50,12 66,8 83,6 100,3" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <small class="trend-diff positive"><i class="pi pi-arrow-up"></i> +12% vs last week</small>
          </div>
        </article>
      </section>

      <!-- ─── 2. MAIN WIDGETS GRID ─── -->
      <section class="mw-widgets-grid">
        <!-- Widget 1: Mood Overview -->
        <article class="mw-card mood-widget">
          <header class="mw-card-header">
            <h3>Mood Overview</h3>
            <span class="header-badge">Today</span>
          </header>
          <div class="mood-chart-layout">
            <div class="donut-chart-wrap">
              <div class="donut-chart" [style.background]="moodDonutGradient()">
                <div class="donut-inner">
                  <strong>{{ overallMoodLabel() }}</strong>
                  <small>Overall Mood</small>
                </div>
              </div>
            </div>
            <div class="mood-legend">
              <div class="legend-item"><span class="dot happy"></span><span>Happy</span><strong>{{ moodDist().happy }}%</strong></div>
              <div class="legend-item"><span class="dot calm"></span><span>Calm</span><strong>{{ moodDist().calm }}%</strong></div>
              <div class="legend-item"><span class="dot neutral"></span><span>Neutral</span><strong>{{ moodDist().neutral }}%</strong></div>
              <div class="legend-item"><span class="dot anxious"></span><span>Anxious</span><strong>{{ moodDist().anxious }}%</strong></div>
              <div class="legend-item"><span class="dot sad"></span><span>Sad</span><strong>{{ moodDist().sad }}%</strong></div>
            </div>
          </div>
          <footer class="mw-card-footer">
            <a routerLink="journal" class="card-link">View Mood History <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 2: Meditation & Breathing -->
        <article class="mw-card practice-widget">
          <header class="mw-card-header">
            <h3>Meditation & Breathing</h3>
            <span class="header-badge">Today</span>
          </header>
          <div class="practice-grid">
            <div class="practice-box purple">
              <div class="box-icon"><i class="pi pi-moon"></i></div>
              <span class="box-label">Meditation Minutes</span>
              <strong class="box-val">{{ latestEntry()?.meditationMinutes || 30 }} <small>minutes</small></strong>
              <div class="box-progress"><span [style.width.%]="meditationProgress()"></span></div>
              <small class="box-sub">Daily Goal: 30 min ({{ meditationProgress() }}%)</small>
            </div>
            <div class="practice-box green">
              <div class="box-icon"><i class="pi pi-compass"></i></div>
              <span class="box-label">Breathing Exercises</span>
              <strong class="box-val">{{ latestEntry()?.breathingExerciseSessions || 3 }} <small>sessions</small></strong>
              <div class="box-progress"><span [style.width.%]="breathingProgress()"></span></div>
              <small class="box-sub">Daily Goal: 3 sessions ({{ breathingProgress() }}%)</small>
            </div>
          </div>
          <footer class="mw-card-footer split-actions">
            <button type="button" class="action-btn-sm primary" (click)="quickStartMeditation()"><i class="pi pi-play"></i> Start Meditation</button>
            <a routerLink="meditation" class="card-link">View All Sessions <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 3: Screen Time & Digital Detox -->
        <article class="mw-card screen-widget">
          <header class="mw-card-header">
            <h3>Screen Time & Digital Detox</h3>
            <span class="header-badge">Today</span>
          </header>
          <div class="screen-grid">
            <div class="screen-box blue">
              <div class="box-icon"><i class="pi pi-mobile"></i></div>
              <span class="box-label">Screen Time</span>
              <strong class="box-val">{{ latestEntry()?.screenTimeHours || 4 }}h {{ latestEntry()?.screenTimeMinutes || 25 }}m</strong>
              <div class="box-progress"><span [style.width.%]="screenTimePercent()" [class.over]="screenTimePercent() > 100"></span></div>
              <small class="box-sub">Daily Limit: 6h</small>
            </div>
            <div class="screen-box teal">
              <div class="box-icon"><i class="pi pi-leaf"></i></div>
              <span class="box-label">Digital Detox</span>
              <strong class="box-val">{{ latestEntry()?.digitalDetoxHours || 2 }}h {{ latestEntry()?.digitalDetoxMinutes || 15 }}m</strong>
              <div class="box-progress"><span style="width: 75%"></span></div>
              <small class="box-sub">Detox Time: Good</small>
            </div>
          </div>
          <footer class="mw-card-footer">
            <a routerLink="screen-time" class="card-link">View Detailed Report <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 4: Gratitude Journal -->
        <article class="mw-card gratitude-widget">
          <header class="mw-card-header">
            <h3>Gratitude Journal</h3>
            <span class="header-badge">Today</span>
          </header>
          <div class="gratitude-body">
            <p class="gratitude-prompt">What are you grateful for today?</p>
            <ul class="gratitude-list">
              <li *ngFor="let g of gratitudeEntries()"><i class="pi pi-heart-fill"></i><span>{{ g }}</span></li>
            </ul>
            <div class="quick-add-row" *ngIf="showAddGratitude()">
              <input type="text" [(ngModel)]="newGratitudeText" placeholder="I am grateful for..." (keyup.enter)="addGratitude()">
              <button type="button" class="btn-icon-add" (click)="addGratitude()"><i class="pi pi-check"></i></button>
            </div>
          </div>
          <footer class="mw-card-footer split-actions">
            <button type="button" class="action-btn-sm ghost" (click)="showAddGratitude.set(!showAddGratitude())"><i class="pi pi-plus"></i> Quick Add</button>
            <a routerLink="gratitude" class="card-link">View All Journal Entries <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 5: Emotional Control -->
        <article class="mw-card emotional-trend-widget">
          <header class="mw-card-header">
            <h3>Emotional Control</h3>
            <div class="header-controls">
              <select class="mini-select" aria-label="Select period">
                <option>This Week</option>
                <option>This Month</option>
              </select>
            </div>
          </header>
          <div class="emotional-chart-body">
            <div class="chart-y-axis">
              <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
            </div>
            <div class="trend-chart-area">
              <svg viewBox="0 0 300 120" preserveAspectRatio="none" class="main-trend-svg">
                <defs>
                  <linearGradient id="emotionalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <polygon points="0,120 0,40 50,55 100,25 150,45 200,30 250,22 300,25 300,120" fill="url(#emotionalGrad)"/>
                <polyline points="0,40 50,55 100,25 150,45 200,30 250,22 300,25" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round"/>
                <circle cx="0" cy="40" r="4" fill="#8b5cf6"/>
                <circle cx="50" cy="55" r="4" fill="#8b5cf6"/>
                <circle cx="100" cy="25" r="4" fill="#8b5cf6"/>
                <circle cx="150" cy="45" r="4" fill="#8b5cf6"/>
                <circle cx="200" cy="30" r="4" fill="#8b5cf6"/>
                <circle cx="250" cy="22" r="4" fill="#8b5cf6"/>
                <circle cx="300" cy="25" r="4" fill="#8b5cf6"/>
              </svg>
              <div class="chart-x-axis">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>
          </div>
          <footer class="mw-card-footer metric-row">
            <div>
              <small>Average Score</small>
              <strong>76 <small>/100</small></strong>
            </div>
            <div class="trend-stat positive">
              <i class="pi pi-arrow-up"></i>
              <span>8% vs last week</span>
            </div>
          </footer>
        </article>

        <!-- Widget 6: Positive Thoughts Tracker -->
        <article class="mw-card thoughts-widget">
          <header class="mw-card-header">
            <h3>Positive Thoughts Tracker</h3>
            <span class="header-badge">This Week</span>
          </header>
          <div class="thoughts-body">
            <div class="thought-ring-wrap">
              <div class="thought-ring" [style.background]="thoughtRingGradient()">
                <div class="thought-inner">
                  <strong>{{ thoughtStats().percentage }}%</strong>
                  <small>Positive</small>
                </div>
              </div>
            </div>
            <div class="thought-counts">
              <div class="count-row green">
                <span class="dot"></span><span>Positive</span><strong>{{ thoughtStats().positive }}</strong>
              </div>
              <div class="count-row orange">
                <span class="dot"></span><span>Neutral</span><strong>{{ thoughtStats().neutral }}</strong>
              </div>
              <div class="count-row red">
                <span class="dot"></span><span>Negative</span><strong>{{ thoughtStats().negative }}</strong>
              </div>
            </div>
          </div>
          <footer class="mw-card-footer">
            <button type="button" class="btn-text-action" (click)="addThought()"><i class="pi pi-plus"></i> Add New Thought</button>
          </footer>
        </article>

        <!-- Widget 7: Books Read & Learning -->
        <article class="mw-card books-widget">
          <header class="mw-card-header">
            <h3>Books Read & Learning</h3>
            <span class="header-badge">This Month</span>
          </header>
          <div class="books-body">
            <div class="book-box purple">
              <div class="box-icon"><i class="pi pi-book"></i></div>
              <span class="box-label">Books Read</span>
              <strong class="box-val">{{ latestEntry()?.booksRead || 2 }} <small>Books</small></strong>
              <div class="box-progress"><span style="width: 50%"></span></div>
              <small class="box-sub">Goal: 4 Books (50%)</small>
            </div>
            <div class="book-box green">
              <div class="box-icon"><i class="pi pi-graduation-cap"></i></div>
              <span class="box-label">Learning Hours</span>
              <strong class="box-val">12.5 <small>Hours</small></strong>
              <div class="box-progress"><span style="width: 63%"></span></div>
              <small class="box-sub">Goal: 20 Hours (63%)</small>
            </div>
          </div>
          <footer class="mw-card-footer">
            <a routerLink="books" class="card-link">View Learning History <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 8: Daily Reflection -->
        <article class="mw-card reflection-widget">
          <header class="mw-card-header">
            <h3>Daily Reflection</h3>
            <span class="header-badge">Today</span>
          </header>
          <div class="reflection-body">
            <div class="ref-section">
              <small class="ref-label">What went well today?</small>
              <p>{{ reflectionWell() }}</p>
            </div>
            <div class="ref-section">
              <small class="ref-label">What could be better?</small>
              <p>{{ reflectionBetter() }}</p>
            </div>
            <div class="ref-section">
              <small class="ref-label">Tomorrow I will...</small>
              <p>{{ reflectionTomorrow() }}</p>
            </div>
          </div>
          <footer class="mw-card-footer">
            <a routerLink="journal" class="card-link">View All Reflections <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 9: Mind Wellness Streaks -->
        <article class="mw-card streaks-widget wide-widget">
          <header class="mw-card-header">
            <h3>Mind Wellness Streaks</h3>
          </header>
          <div class="streaks-grid">
            <div class="streak-card" *ngFor="let s of streaks()">
              <div class="streak-icon" [style.background]="s.color"><i [class]="s.icon"></i></div>
              <div class="streak-info">
                <span class="streak-title">{{ s.label }}</span>
                <strong class="streak-days">{{ s.days }} Days</strong>
                <small class="streak-status">{{ s.status }}</small>
              </div>
            </div>
          </div>
          <footer class="mw-card-footer">
            <a routerLink="habits" class="card-link">View All Streaks <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 10: AI Wellness Insights -->
        <article class="mw-card insights-widget">
          <header class="mw-card-header">
            <h3>Insights for You</h3>
          </header>
          <div class="insights-list">
            <div class="insight-row" *ngFor="let insight of insights()">
              <i [class]="insight.icon"></i>
              <span>{{ insight.text }}</span>
            </div>
          </div>
          <footer class="mw-card-footer">
            <a routerLink="insights" class="card-link">View All Insights <i class="pi pi-arrow-right"></i></a>
          </footer>
        </article>

        <!-- Widget 11: Motivational Quote -->
        <article class="mw-card quote-widget">
          <div class="quote-illustration">
            <svg viewBox="0 0 200 80" class="landscape-svg">
              <path d="M0,80 Q50,30 100,60 T200,40 L200,80 Z" fill="rgba(255,255,255,0.15)"/>
              <path d="M0,80 Q70,40 140,70 T200,50 L200,80 Z" fill="rgba(255,255,255,0.2)"/>
              <circle cx="150" cy="25" r="12" fill="rgba(255,255,255,0.3)"/>
            </svg>
          </div>
          <div class="quote-content">
            <i class="pi pi-quote-left quote-mark"></i>
            <p class="quote-text">{{ dailyQuote().text }}</p>
            <span class="quote-author">— {{ dailyQuote().author }}</span>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      color: var(--text-primary);
    }

    .mw-dashboard {
      display: flex;
      flex-direction: column;
      gap: 20px;
      animation: mwIn 0.4s ease-out both;
    }

    /* ── Header ── */
    .mw-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .mw-title-block h2 {
      margin: 0;
      font-size: clamp(1.4rem, 2.5vw, 1.85rem);
      line-height: 1.2;
    }

    .mw-title-block p {
      margin: 2px 0 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .mw-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .mw-tabs {
      display: flex;
      gap: 4px;
      background: color-mix(in srgb, var(--surface-card) 80%, transparent);
      padding: 4px;
      border-radius: 14px;
      border: 1px solid var(--border-color);
    }

    .tab-btn {
      border: 0;
      background: transparent;
      padding: 6px 14px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .tab-btn.active {
      background: var(--accent-primary);
      color: #fff;
    }

    .date-picker-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      background: color-mix(in srgb, var(--surface-card) 80%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 3px 6px;
    }

    .date-nav-btn {
      border: 0;
      background: transparent;
      color: var(--text-secondary);
      width: 28px;
      height: 28px;
      border-radius: 8px;
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    .date-nav-btn:hover {
      background: var(--accent-surface);
      color: var(--accent-primary);
    }

    .date-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 0 4px;
    }

    .add-entry-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 14px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      font-weight: 700;
      font-size: 0.88rem;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.28);
      transition: all var(--transition-fast);
    }

    .add-entry-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(99, 102, 241, 0.38);
      color: #fff;
    }

    /* ── Summary Cards Grid ── */
    .summary-cards-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(160px, 1fr));
      gap: 14px;
    }

    .summary-card {
      background: color-mix(in srgb, var(--surface-card) 88%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 14px 16px;
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all var(--transition-fast);
    }

    .summary-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
      border-color: color-mix(in srgb, var(--accent-primary) 40%, var(--border-color));
    }

    .card-top {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card-icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 1.1rem;
      color: #fff;
    }

    .happiness-tone .card-icon { background: linear-gradient(135deg, #818cf8, #6366f1); }
    .anxiety-tone .card-icon { background: linear-gradient(135deg, #fb923c, #f97316); }
    .stress-tone .card-icon { background: linear-gradient(135deg, #f43f5e, #e11d48); }
    .emotional-tone .card-icon { background: linear-gradient(135deg, #34d399, #10b981); }
    .thoughts-tone .card-icon { background: linear-gradient(135deg, #a78bfa, #8b5cf6); }

    .card-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-secondary);
    }

    .card-middle {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }

    .card-score {
      font-size: 1.6rem;
      line-height: 1;
      font-weight: 900;
    }

    .card-score small {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-weight: 700;
    }

    .status-chip {
      font-size: 0.72rem;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 999px;
    }

    .status-chip.success { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .status-chip.info { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .status-chip.warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

    .card-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .sparkline {
      width: 70px;
      height: 22px;
      color: var(--accent-primary);
    }

    .trend-diff {
      font-size: 0.72rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .trend-diff.positive { color: #10b981; }
    .trend-diff.neutral { color: var(--text-secondary); }

    /* ── Main Widgets Grid ── */
    .mw-widgets-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .mw-card {
      background: color-mix(in srgb, var(--surface-card) 88%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 22px;
      padding: 18px;
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: all var(--transition-fast);
    }

    .mw-card:hover {
      box-shadow: var(--shadow-md);
      border-color: color-mix(in srgb, var(--accent-primary) 35%, var(--border-color));
    }

    .wide-widget {
      grid-column: span 2;
    }

    .mw-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .mw-card-header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
    }

    .header-badge {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-secondary);
      background: var(--bg-tertiary);
      padding: 3px 9px;
      border-radius: 999px;
    }

    .mini-select {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-radius: 8px;
      padding: 3px 8px;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .mw-card-footer {
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent);
    }

    .card-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 800;
      color: var(--accent-primary);
    }

    .split-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .action-btn-sm {
      border: 0;
      border-radius: 10px;
      padding: 6px 12px;
      font-weight: 700;
      font-size: 0.8rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all var(--transition-fast);
    }

    .action-btn-sm.primary {
      background: var(--accent-gradient);
      color: #fff;
    }

    .action-btn-sm.ghost {
      background: var(--accent-surface);
      color: var(--accent-primary);
    }

    .btn-text-action {
      background: transparent;
      border: 0;
      color: var(--accent-primary);
      font-weight: 800;
      font-size: 0.84rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* ── Mood Overview ── */
    .mood-chart-layout {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 16px;
      align-items: center;
    }

    .donut-chart-wrap {
      display: flex;
      justify-content: center;
    }

    .donut-chart {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      position: relative;
    }

    .donut-inner {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: var(--surface-card);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
    }

    .donut-inner strong {
      font-size: 0.95rem;
      line-height: 1.1;
    }

    .donut-inner small {
      font-size: 0.65rem;
      color: var(--text-secondary);
    }

    .mood-legend {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
    }

    .legend-item strong {
      margin-left: auto;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot.happy { background: #22c55e; }
    .dot.calm { background: #3b82f6; }
    .dot.neutral { background: #f59e0b; }
    .dot.anxious { background: #fb923c; }
    .dot.sad { background: #ef4444; }

    /* ── Meditation & Breathing ── */
    .practice-grid, .screen-grid, .books-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .practice-box, .screen-box, .book-box {
      background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .box-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 0.9rem;
    }

    .purple .box-icon { background: linear-gradient(135deg, #a78bfa, #8b5cf6); }
    .green .box-icon { background: linear-gradient(135deg, #34d399, #10b981); }
    .blue .box-icon { background: linear-gradient(135deg, #60a5fa, #3b82f6); }
    .teal .box-icon { background: linear-gradient(135deg, #2dd4bf, #14b8a6); }

    .box-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-weight: 700;
    }

    .box-val {
      font-size: 1.35rem;
      line-height: 1;
      font-weight: 900;
    }

    .box-val small {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .box-progress {
      height: 6px;
      background: var(--bg-primary);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 2px;
    }

    .box-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--accent-primary);
    }

    .box-progress span.over {
      background: var(--danger);
    }

    .box-sub {
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    /* ── Gratitude Journal ── */
    .gratitude-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .gratitude-prompt {
      margin: 0;
      font-size: 0.82rem;
      color: var(--text-secondary);
      font-weight: 700;
    }

    .gratitude-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .gratitude-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--text-primary);
    }

    .gratitude-list li i {
      color: #f43f5e;
      font-size: 0.75rem;
    }

    .quick-add-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }

    .quick-add-row input {
      flex: 1;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 6px 10px;
      font-size: 0.82rem;
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    .btn-icon-add {
      border: 0;
      background: var(--accent-primary);
      color: #fff;
      border-radius: 10px;
      width: 32px;
      height: 32px;
      cursor: pointer;
    }

    /* ── Emotional Control Chart ── */
    .emotional-chart-body {
      display: grid;
      grid-template-columns: 30px 1fr;
      gap: 8px;
      height: 130px;
    }

    .chart-y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 0.68rem;
      color: var(--text-secondary);
    }

    .trend-chart-area {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    .main-trend-svg {
      width: 100%;
      height: 100px;
    }

    .chart-x-axis {
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      color: var(--text-secondary);
    }

    .metric-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .metric-row small {
      display: block;
      font-size: 0.72rem;
      color: var(--text-secondary);
    }

    .trend-stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .trend-stat.positive { color: #10b981; }

    /* ── Thoughts Widget ── */
    .thoughts-body {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 16px;
      align-items: center;
    }

    .thought-ring-wrap {
      display: flex;
      justify-content: center;
    }

    .thought-ring {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }

    .thought-inner {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: var(--surface-card);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .thought-inner strong {
      font-size: 1.1rem;
      line-height: 1;
    }

    .thought-inner small {
      font-size: 0.65rem;
      color: var(--text-secondary);
    }

    .thought-counts {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .count-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
    }

    .count-row strong {
      margin-left: auto;
    }

    .count-row.green .dot { background: #22c55e; }
    .count-row.orange .dot { background: #f59e0b; }
    .count-row.red .dot { background: #ef4444; }

    /* ── Daily Reflection ── */
    .reflection-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ref-section p {
      margin: 2px 0 0;
      font-size: 0.82rem;
      color: var(--text-primary);
      line-height: 1.35;
    }

    .ref-label {
      font-size: 0.72rem;
      color: var(--text-secondary);
      font-weight: 700;
    }

    /* ── Streaks Widget ── */
    .streaks-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .streak-card {
      background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .streak-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .streak-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .streak-title {
      font-size: 0.72rem;
      color: var(--text-secondary);
      font-weight: 700;
    }

    .streak-days {
      font-size: 1.15rem;
      font-weight: 900;
      line-height: 1.1;
    }

    .streak-status {
      font-size: 0.68rem;
      color: #10b981;
      font-weight: 800;
    }

    /* ── Insights Widget ── */
    .insights-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .insight-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.84rem;
      line-height: 1.35;
      background: color-mix(in srgb, var(--bg-tertiary) 50%, transparent);
      border-radius: 12px;
      padding: 10px;
    }

    .insight-row i {
      color: var(--accent-primary);
      font-size: 1rem;
      margin-top: 2px;
    }

    /* ── Quote Widget ── */
    .quote-widget {
      background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899);
      color: #fff;
      border: 0;
      position: relative;
      overflow: hidden;
    }

    .quote-illustration {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 80px;
      pointer-events: none;
    }

    .quote-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .quote-mark {
      font-size: 1.4rem;
      opacity: 0.7;
    }

    .quote-text {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.35;
    }

    .quote-author {
      font-size: 0.78rem;
      opacity: 0.85;
    }

    /* ── Responsive ── */
    @media (max-width: 1400px) {
      .summary-cards-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .mw-widgets-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .wide-widget {
        grid-column: span 2;
      }
    }

    @media (max-width: 900px) {
      .summary-cards-grid, .mw-widgets-grid {
        grid-template-columns: 1fr;
      }
      .wide-widget {
        grid-column: span 1;
      }
      .streaks-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 560px) {
      .streaks-grid, .practice-grid, .screen-grid, .books-body {
        grid-template-columns: 1fr;
      }
      .mood-chart-layout, .thoughts-body {
        grid-template-columns: 1fr;
      }
    }

    @keyframes mwIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class MentalWellnessDashboardComponent implements OnInit {
  service = inject(MentalWellnessService);
  Math = Math;

  activeTab = signal<'overview' | 'insights' | 'trends' | 'history'>('overview');
  currentDate = signal(new Date());

  latestEntry = computed(() => this.service.getLatestEntry());
  moodDist = computed(() => this.service.getMoodDistribution());
  overallMoodLabel = computed(() => this.service.getOverallMoodLabel());
  thoughtStats = computed(() => this.service.getPositiveThoughtStats());
  streaks = computed(() => this.service.getStreaks());
  insights = computed(() => this.service.getInsights());
  dailyQuote = computed(() => this.service.getDailyQuote());

  gratitudeEntries = computed(() => this.latestEntry()?.gratitudeEntries.slice(0, 4) || [
    'Grateful for good health and family',
    'Amazing sunrise this morning',
    'Productive work and learning',
    'Supportive friends and team',
  ]);

  showAddGratitude = signal(false);
  newGratitudeText = '';

  reflectionWell = computed(() => this.latestEntry()?.dailyReflection || 'Completed important tasks, exercised, and spent quality time with family.');
  reflectionBetter = computed(() => 'Need to reduce screen time at night and wake up earlier.');
  reflectionTomorrow = computed(() => 'Meditate in the morning and focus more on learning.');

  formattedCurrentDate = computed(() => {
    return this.currentDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });

  meditationProgress = computed(() => Math.min(Math.round(((this.latestEntry()?.meditationMinutes || 30) / 30) * 100), 100));
  breathingProgress = computed(() => Math.min(Math.round(((this.latestEntry()?.breathingExerciseSessions || 3) / 3) * 100), 100));

  screenTimePercent = computed(() => {
    const totalMins = (this.latestEntry()?.screenTimeHours || 4) * 60 + (this.latestEntry()?.screenTimeMinutes || 25);
    return Math.round((totalMins / 360) * 100);
  });

  moodDonutGradient = computed(() => {
    const dist = this.moodDist();
    let cursor = 0;
    const happyStop = cursor + dist.happy;
    const calmStop = happyStop + dist.calm;
    const neutralStop = calmStop + dist.neutral;
    const anxiousStop = neutralStop + dist.anxious;
    return `conic-gradient(#22c55e 0% ${happyStop}%, #3b82f6 ${happyStop}% ${calmStop}%, #f59e0b ${calmStop}% ${neutralStop}%, #fb923c ${neutralStop}% ${anxiousStop}%, #ef4444 ${anxiousStop}% 100%)`;
  });

  thoughtRingGradient = computed(() => {
    const pct = this.thoughtStats().percentage;
    return `conic-gradient(#a78bfa 0% ${pct}%, color-mix(in srgb, #a78bfa 15%, transparent) ${pct}% 100%)`;
  });

  ngOnInit() {}

  changeDate(deltaDays: number) {
    const next = new Date(this.currentDate());
    next.setDate(next.getDate() + deltaDays);
    this.currentDate.set(next);
  }

  addGratitude() {
    if (!this.newGratitudeText.trim()) return;
    const entry = this.latestEntry();
    if (entry) {
      const updated = {
        ...entry,
        gratitudeEntries: [...entry.gratitudeEntries, this.newGratitudeText.trim()],
      };
      this.service.updateEntry(entry.id, updated);
    }
    this.newGratitudeText = '';
    this.showAddGratitude.set(false);
  }

  addThought() {
    const text = prompt('Enter a new positive thought/affirmation:');
    if (!text) return;
    const entry = this.latestEntry();
    if (entry) {
      const updated = {
        ...entry,
        positiveThoughts: [...entry.positiveThoughts, text.trim()],
      };
      this.service.updateEntry(entry.id, updated);
    }
  }

  quickStartMeditation() {
    alert('🧘 Quick Meditation Started! Take a deep breath in... and out...');
  }
}
