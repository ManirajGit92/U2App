import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MentalWellnessService } from './mental-wellness.service';

@Component({
  selector: 'app-mental-wellness-insights',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="mwi-page">
      <header class="mwi-header">
        <div>
          <h2>AI Wellness Insights & Recommendations 🧠</h2>
          <p>Personalized intelligence based on your daily tracking history.</p>
        </div>
        <button type="button" class="refresh-btn" (click)="refreshInsights()"><i class="pi pi-refresh"></i> Refresh AI Analysis</button>
      </header>

      <div class="insights-grid">
        <!-- 1. Wellness Score Analysis -->
        <article class="ai-card purple">
          <div class="card-icon"><i class="pi pi-sparkles"></i></div>
          <div class="card-content">
            <h3>Wellness Score Analysis</h3>
            <p>Your current score is <strong>78/100 (Good)</strong>. Your strongest pillar is <strong>Meditation & Gratitude</strong>, while <strong>Screen Time</strong> offers the highest potential for improvement.</p>
          </div>
        </article>

        <!-- 2. Mood Prediction -->
        <article class="ai-card blue">
          <div class="card-icon"><i class="pi pi-compass"></i></div>
          <div class="card-content">
            <h3>Mood Prediction & Trends</h3>
            <p>Based on your 14-day history, your mood is projected to remain <strong>Calm & Happy</strong> over the weekend if morning meditation is maintained.</p>
          </div>
        </article>

        <!-- 3. Burnout Detection -->
        <article class="ai-card green">
          <div class="card-icon"><i class="pi pi-shield"></i></div>
          <div class="card-content">
            <h3>Burnout Risk Assessment</h3>
            <span class="badge low-risk">Low Risk (15%)</span>
            <p>Your stress levels are moderate and sleep recovery is adequate. No significant burnout patterns detected.</p>
          </div>
        </article>

        <!-- 4. Stress Reduction Suggestions -->
        <article class="ai-card orange">
          <div class="card-icon"><i class="pi pi-bolt"></i></div>
          <div class="card-content">
            <h3>Stress Reduction Suggestions</h3>
            <ul>
              <li>Practice 4-7-8 breathing exercises for 5 minutes before bed.</li>
              <li>Take a 10-minute digital detox walk during lunch hours.</li>
              <li>Journal 3 things you are grateful for each evening.</li>
            </ul>
          </div>
        </article>

        <!-- 5. Meditation & Reading Recommendations -->
        <article class="ai-card teal span-2">
          <div class="card-icon"><i class="pi pi-book"></i></div>
          <div class="card-content">
            <h3>Recommended Practices & Reading</h3>
            <div class="rec-chips">
              <div class="chip-item">
                <i class="pi pi-moon"></i>
                <div>
                  <strong>Guided Mindfulness (15 min)</strong>
                  <small>Best for reducing afternoon anxiety</small>
                </div>
              </div>
              <div class="chip-item">
                <i class="pi pi-book"></i>
                <div>
                  <strong>"The Miracle of Mindfulness" by Thich Nhat Hanh</strong>
                  <small>Recommended based on your reading goals</small>
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- 6. Daily Motivational Message -->
        <article class="ai-card quote-card span-2">
          <div class="card-content">
            <i class="pi pi-quote-left quote-mark"></i>
            <p class="quote-text">"Quiet the mind, and the soul will speak."</p>
            <span class="quote-author">— Jaya Hargila</span>
          </div>
        </article>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .mwi-page { display: flex; flex-direction: column; gap: 20px; }
    .mwi-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .mwi-header h2 { margin: 0; font-size: 1.5rem; }
    .mwi-header p { margin: 2px 0 0; color: var(--text-secondary); font-size: 0.88rem; }
    .refresh-btn { border-radius: 12px; padding: 8px 16px; font-weight: 700; font-size: 0.85rem; border: 1px solid var(--border-color); background: var(--surface-card); color: var(--accent-primary); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .insights-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .span-2 { grid-column: span 2; }
    .ai-card { background: color-mix(in srgb, var(--surface-card) 88%, transparent); border: 1px solid var(--border-color); border-radius: 20px; padding: 18px; backdrop-filter: blur(20px); display: flex; gap: 14px; transition: all var(--transition-fast); }
    .ai-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
    .card-icon { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; color: #fff; font-size: 1.2rem; flex-shrink: 0; }
    .purple .card-icon { background: linear-gradient(135deg, #a78bfa, #8b5cf6); }
    .blue .card-icon { background: linear-gradient(135deg, #60a5fa, #3b82f6); }
    .green .card-icon { background: linear-gradient(135deg, #34d399, #10b981); }
    .orange .card-icon { background: linear-gradient(135deg, #fb923c, #f97316); }
    .teal .card-icon { background: linear-gradient(135deg, #2dd4bf, #14b8a6); }
    .card-content h3 { margin: 0 0 6px; font-size: 1.05rem; }
    .card-content p { margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; }
    .card-content ul { margin: 6px 0 0; padding-left: 18px; font-size: 0.85rem; color: var(--text-secondary); }
    .badge.low-risk { background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; display: inline-block; margin-bottom: 6px; }
    .rec-chips { display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
    .chip-item { background: color-mix(in srgb, var(--bg-tertiary) 70%, transparent); border: 1px solid var(--border-color); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; flex: 1; min-width: 220px; }
    .chip-item i { color: var(--accent-primary); font-size: 1.1rem; }
    .chip-item strong { display: block; font-size: 0.84rem; }
    .chip-item small { color: var(--text-secondary); font-size: 0.72rem; }
    .quote-card { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: 0; }
    .quote-mark { font-size: 1.6rem; opacity: 0.8; }
    .quote-text { font-size: 1.1rem; font-weight: 700; margin: 4px 0 !important; color: #fff !important; }
    .quote-author { font-size: 0.8rem; opacity: 0.85; }
    @media (max-width: 900px) { .insights-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } }
  `],
})
export class MentalWellnessInsightsComponent implements OnInit {
  service = inject(MentalWellnessService);

  ngOnInit() {}

  refreshInsights() {
    alert('✨ AI Analysis Refreshed with latest entry data!');
  }
}
