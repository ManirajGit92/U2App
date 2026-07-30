import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MentalWellnessService } from './mental-wellness.service';
import {
  EMOTIONAL_CONTROL_OPTIONS,
  MEDITATION_TYPES,
  MOOD_OPTIONS,
  MentalWellnessEntry,
  SCREEN_TIME_CATEGORIES,
  DETOX_ACTIVITIES,
  createBlankEntry,
} from './mental-wellness.models';

@Component({
  selector: 'app-mental-wellness-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="mww-page">
      <!-- Wizard Top Bar -->
      <header class="mww-header">
        <div class="mww-header-title">
          <button type="button" class="back-link" routerLink="../"><i class="pi pi-arrow-left"></i></button>
          <div>
            <h2>Add Mind & Mental Wellness Entry</h2>
            <p>Track your inner well-being. Small steps, big changes. 💕</p>
          </div>
        </div>
        <div class="mww-header-meta">
          <div class="date-field">
            <i class="pi pi-calendar"></i>
            <span>Entry Date</span>
            <input type="date" [(ngModel)]="entry.date">
          </div>
          <button type="button" class="help-btn"><i class="pi pi-question-circle"></i> Need Help?</button>
        </div>
      </header>

      <!-- Step Progress Indicator -->
      <section class="mww-stepper" aria-label="Wizard progress">
        <div
          *ngFor="let s of steps; let i = index"
          class="step-item"
          [class.active]="activeStep() === i"
          [class.completed]="activeStep() > i"
          (click)="goToStep(i)">
          <div class="step-badge">
            <i class="pi pi-check" *ngIf="activeStep() > i"></i>
            <span *ngIf="activeStep() <= i">{{ i + 1 }}</span>
          </div>
          <div class="step-copy">
            <strong>{{ s.title }}</strong>
            <small>{{ s.subtitle }}</small>
          </div>
          <div class="step-connector" *ngIf="i < steps.length - 1"></div>
        </div>
      </section>

      <!-- Main Layout: Form Steps + Right Daily Snapshot -->
      <div class="mww-main-layout">
        <form class="mww-form-area" (ngSubmit)="submitEntry()">

          <!-- STEP 1: Wellness Metrics -->
          <div class="wizard-step-pane" *ngIf="activeStep() === 0">
            <div class="pane-header">
              <i class="pi pi-heart-fill"></i>
              <h3>How are you feeling today?</h3>
            </div>
            <div class="metrics-grid">
              <!-- Happiness Score Slider -->
              <div class="metric-slider-card">
                <div class="card-label-row">
                  <span class="icon-label 😊">Happiness Score</span>
                  <strong class="val-label">{{ entry.happinessScore }}<small>/10</small></strong>
                </div>
                <span class="feeling-tag">{{ getHappinessLabel(entry.happinessScore) }}</span>
                <input type="range" min="0" max="10" step="1" [(ngModel)]="entry.happinessScore" name="happinessScore" class="purple-slider">
                <div class="range-marks"><span>0</span><span>5</span><span>10</span></div>
              </div>

              <!-- Anxiety Level Slider -->
              <div class="metric-slider-card">
                <div class="card-label-row">
                  <span class="icon-label 😰">Anxiety Level</span>
                  <strong class="val-label">{{ entry.anxietyLevel }}<small>/10</small></strong>
                </div>
                <span class="feeling-tag info">{{ getAnxietyLabel(entry.anxietyLevel) }}</span>
                <input type="range" min="0" max="10" step="1" [(ngModel)]="entry.anxietyLevel" name="anxietyLevel" class="blue-slider">
                <div class="range-marks"><span>0</span><span>5</span><span>10</span></div>
              </div>

              <!-- Stress Level Slider -->
              <div class="metric-slider-card">
                <div class="card-label-row">
                  <span class="icon-label ⚡">Stress Level</span>
                  <strong class="val-label">{{ entry.stressLevel }}<small>/10</small></strong>
                </div>
                <span class="feeling-tag warning">{{ getStressLabel(entry.stressLevel) }}</span>
                <input type="range" min="0" max="10" step="1" [(ngModel)]="entry.stressLevel" name="stressLevel" class="orange-slider">
                <div class="range-marks"><span>0</span><span>5</span><span>10</span></div>
              </div>

              <!-- Mood Dropdown -->
              <div class="metric-select-card">
                <label>Mood</label>
                <div class="select-with-icon">
                  <select [(ngModel)]="entry.mood" name="mood">
                    <option *ngFor="let m of moodOptions" [value]="m.value">{{ m.emoji }} {{ m.label }}</option>
                  </select>
                </div>
                <span class="select-desc">Feeling peaceful and relaxed</span>
              </div>

              <!-- Emotional Control -->
              <div class="metric-select-card">
                <label>Emotional Control</label>
                <select [(ngModel)]="entry.emotionalControl" name="emotionalControl">
                  <option *ngFor="let ec of emotionalControlOptions" [value]="ec.value">{{ ec.label }}</option>
                </select>
                <span class="select-desc">Handled emotions well today</span>
              </div>
            </div>
          </div>

          <!-- STEP 2: Journal & Reflection -->
          <div class="wizard-step-pane" *ngIf="activeStep() === 1">
            <div class="journal-grid">
              <!-- Gratitude Journal -->
              <div class="journal-card">
                <div class="pane-header">
                  <i class="pi pi-book"></i>
                  <div>
                    <h3>Gratitude Journal</h3>
                    <p>What are you grateful for today?</p>
                  </div>
                </div>
                <div class="input-list">
                  <div class="list-row" *ngFor="let g of entry.gratitudeEntries; let i = index">
                    <span class="num">{{ i + 1 }}</span>
                    <input type="text" [(ngModel)]="entry.gratitudeEntries[i]" [name]="'gratitude_' + i">
                    <button type="button" class="remove-btn" (click)="removeGratitude(i)"><i class="pi pi-times"></i></button>
                  </div>
                </div>
                <button type="button" class="add-more-btn" (click)="addGratitude()"><i class="pi pi-plus"></i> Add More</button>
              </div>

              <!-- Daily Reflection -->
              <div class="journal-card">
                <div class="pane-header">
                  <i class="pi pi-pencil"></i>
                  <div>
                    <h3>Daily Reflection</h3>
                    <p>How was your day?</p>
                  </div>
                </div>
                <textarea
                  class="reflection-textarea"
                  [(ngModel)]="entry.dailyReflection"
                  name="dailyReflection"
                  placeholder="Today was productive and peaceful. I stayed focused on my goals, took breaks when needed..."
                  maxlength="500"></textarea>
                <small class="char-count">{{ entry.dailyReflection.length || 0 }}/500</small>
              </div>

              <!-- Positive Thoughts -->
              <div class="journal-card span-2">
                <div class="pane-header">
                  <i class="pi pi-heart"></i>
                  <div>
                    <h3>Positive Thoughts</h3>
                    <p>What positive thoughts did you have?</p>
                  </div>
                </div>
                <div class="thoughts-chips">
                  <div class="thought-chip" *ngFor="let t of entry.positiveThoughts; let i = index">
                    <span>{{ t }}</span>
                    <button type="button" (click)="removeThought(i)"><i class="pi pi-times"></i></button>
                  </div>
                </div>
                <div class="add-thought-row">
                  <input type="text" [(ngModel)]="newThoughtText" placeholder="Type a positive thought or affirmation..." (keyup.enter)="addThought()">
                  <button type="button" class="add-more-btn" (click)="addThought()"><i class="pi pi-plus"></i> Add Thought</button>
                </div>
              </div>
            </div>
          </div>

          <!-- STEP 3: Meditation & Wellness Practices -->
          <div class="wizard-step-pane" *ngIf="activeStep() === 2">
            <div class="practices-grid">
              <!-- Meditation Minutes -->
              <div class="practice-card">
                <div class="pane-header">
                  <i class="pi pi-moon"></i>
                  <div>
                    <h3>Meditation Minutes</h3>
                    <p>How many minutes did you meditate?</p>
                  </div>
                </div>
                <div class="big-counter-display">
                  <strong>{{ entry.meditationMinutes }}</strong>
                  <span>Minutes</span>
                </div>
                <input type="range" min="0" max="60" step="5" [(ngModel)]="entry.meditationMinutes" name="meditationMinutes" class="purple-slider">
                <div class="range-marks"><span>0</span><span>15</span><span>30</span><span>45</span><span>60</span></div>
                <label class="field-label">Type (Optional)</label>
                <select [(ngModel)]="entry.meditationType" name="meditationType">
                  <option *ngFor="let mt of meditationTypes" [value]="mt">{{ mt }}</option>
                </select>
              </div>

              <!-- Breathing Exercises -->
              <div class="practice-card">
                <div class="pane-header">
                  <i class="pi pi-compass"></i>
                  <div>
                    <h3>Breathing Exercises</h3>
                    <p>How many sessions today?</p>
                  </div>
                </div>
                <div class="big-counter-display">
                  <strong>{{ entry.breathingExerciseSessions }}</strong>
                  <span>Sessions</span>
                </div>
                <input type="range" min="0" max="8" step="1" [(ngModel)]="entry.breathingExerciseSessions" name="breathingSessions" class="teal-slider">
                <div class="range-marks"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span></div>
                <label class="field-label">Duration (Total)</label>
                <select [(ngModel)]="entry.breathingDuration" name="breathingDuration">
                  <option [value]="5">5 Minutes</option>
                  <option [value]="10">10 Minutes</option>
                  <option [value]="15">15 Minutes</option>
                  <option [value]="20">20 Minutes</option>
                  <option [value]="30">30 Minutes</option>
                </select>
              </div>

              <!-- Screen Time -->
              <div class="practice-card">
                <div class="pane-header">
                  <i class="pi pi-mobile"></i>
                  <div>
                    <h3>Screen Time</h3>
                    <p>Total screen time today</p>
                  </div>
                </div>
                <div class="time-spinner-row">
                  <div class="spin-box">
                    <input type="number" min="0" max="24" [(ngModel)]="entry.screenTimeHours" name="screenHours">
                    <label>Hours</label>
                  </div>
                  <div class="spin-box">
                    <input type="number" min="0" max="59" [(ngModel)]="entry.screenTimeMinutes" name="screenMins">
                    <label>Minutes</label>
                  </div>
                </div>
                <label class="field-label">Most Used For</label>
                <select [(ngModel)]="entry.screenTimeMostUsedFor" name="screenMostUsed">
                  <option *ngFor="let c of screenCategories" [value]="c">{{ c }}</option>
                </select>
              </div>

              <!-- Digital Detox -->
              <div class="practice-card">
                <div class="pane-header">
                  <i class="pi pi-leaf"></i>
                  <div>
                    <h3>Digital Detox</h3>
                    <p>Time away from screens</p>
                  </div>
                </div>
                <div class="time-spinner-row">
                  <div class="spin-box">
                    <input type="number" min="0" max="24" [(ngModel)]="entry.digitalDetoxHours" name="detoxHours">
                    <label>Hours</label>
                  </div>
                  <div class="spin-box">
                    <input type="number" min="0" max="59" [(ngModel)]="entry.digitalDetoxMinutes" name="detoxMins">
                    <label>Minutes</label>
                  </div>
                </div>
                <label class="field-label">Activities During Detox</label>
                <input type="text" [(ngModel)]="entry.detoxActivities" name="detoxActivities" placeholder="Reading, Walk, Family Time">
              </div>
            </div>
          </div>

          <!-- STEP 4: Growth & Learning -->
          <div class="wizard-step-pane" *ngIf="activeStep() === 3">
            <div class="growth-grid">
              <!-- Books Read -->
              <div class="growth-card">
                <div class="pane-header">
                  <i class="pi pi-book"></i>
                  <div>
                    <h3>Books Read</h3>
                    <p>How many books did you read today?</p>
                  </div>
                </div>
                <div class="counter-row">
                  <button type="button" class="counter-btn" (click)="entry.booksRead = Math.max(0, entry.booksRead - 1)">-</button>
                  <strong class="count-num">{{ entry.booksRead }}</strong>
                  <button type="button" class="counter-btn" (click)="entry.booksRead = entry.booksRead + 1">+</button>
                </div>
              </div>

              <!-- Learning Hours -->
              <div class="growth-card">
                <div class="pane-header">
                  <i class="pi pi-graduation-cap"></i>
                  <div>
                    <h3>Learning Hours</h3>
                    <p>Total learning time today</p>
                  </div>
                </div>
                <div class="time-spinner-row">
                  <div class="spin-box">
                    <input type="number" min="0" max="24" [(ngModel)]="entry.learningHours" name="learnHours">
                    <label>Hours</label>
                  </div>
                  <div class="spin-box">
                    <input type="number" min="0" max="59" [(ngModel)]="entry.learningMinutes" name="learnMins">
                    <label>Minutes</label>
                  </div>
                </div>
              </div>

              <!-- Personal Notes -->
              <div class="growth-card span-2">
                <div class="pane-header">
                  <i class="pi pi-file-edit"></i>
                  <div>
                    <h3>Notes (Optional)</h3>
                    <p>Any additional notes about your mental wellness...</p>
                  </div>
                </div>
                <textarea
                  class="notes-textarea"
                  [(ngModel)]="entry.personalNotes"
                  name="personalNotes"
                  placeholder="Write any thoughts, lessons, or notes here..."
                  maxlength="300"></textarea>
                <small class="char-count">{{ entry.personalNotes.length || 0 }}/300</small>
              </div>
            </div>
          </div>

          <!-- STEP 5: Review & Save -->
          <div class="wizard-step-pane" *ngIf="activeStep() === 4">
            <div class="review-pane">
              <div class="review-header-card">
                <div class="score-ring-large">
                  <strong>{{ computedWellnessScore() }}</strong>
                  <small>/100 Score</small>
                </div>
                <div class="review-copy">
                  <h3>Entry Review Summary</h3>
                  <p>Check your mental wellness metrics before saving.</p>
                  <button type="button" class="ai-summary-btn" (click)="generateAISummary()"><i class="pi pi-sparkles"></i> Generate AI Wellness Summary</button>
                </div>
              </div>

              <div class="review-details-grid">
                <div class="review-block">
                  <h4><i class="pi pi-face-smile"></i> Emotional Well-being</h4>
                  <p><strong>Happiness:</strong> {{ entry.happinessScore }}/10</p>
                  <p><strong>Anxiety:</strong> {{ entry.anxietyLevel }}/10</p>
                  <p><strong>Stress:</strong> {{ entry.stressLevel }}/10</p>
                  <p><strong>Mood:</strong> {{ entry.mood }}</p>
                </div>
                <div class="review-block">
                  <h4><i class="pi pi-moon"></i> Practices & Digital</h4>
                  <p><strong>Meditation:</strong> {{ entry.meditationMinutes }} min</p>
                  <p><strong>Breathing:</strong> {{ entry.breathingExerciseSessions }} sessions</p>
                  <p><strong>Screen Time:</strong> {{ entry.screenTimeHours }}h {{ entry.screenTimeMinutes }}m</p>
                  <p><strong>Detox:</strong> {{ entry.digitalDetoxHours }}h {{ entry.digitalDetoxMinutes }}m</p>
                </div>
                <div class="review-block span-2">
                  <h4><i class="pi pi-book"></i> Journal & Reflections</h4>
                  <p><strong>Gratitude Entries:</strong> {{ entry.gratitudeEntries.length }} item(s)</p>
                  <p><strong>Positive Thoughts:</strong> {{ entry.positiveThoughts.length }} thought(s)</p>
                  <p><strong>Reflection:</strong> {{ entry.dailyReflection || 'No reflection provided.' }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Wizard Sticky Footer Controls -->
          <footer class="mww-footer">
            <button type="button" class="footer-btn secondary" routerLink="../"><i class="pi pi-times"></i> Cancel</button>
            <button type="button" class="footer-btn secondary" (click)="saveDraft()"><i class="pi pi-save"></i> Save Draft</button>
            <div class="right-buttons">
              <button type="button" class="footer-btn secondary" (click)="prevStep()" [disabled]="activeStep() === 0"><i class="pi pi-arrow-left"></i> Back</button>
              <button type="button" class="footer-btn primary" (click)="nextStep()" *ngIf="activeStep() < steps.length - 1">Next <i class="pi pi-arrow-right"></i></button>
              <button type="submit" class="footer-btn primary submit-gradient" *ngIf="activeStep() === steps.length - 1"><i class="pi pi-check"></i> Submit Entry</button>
            </div>
          </footer>
        </form>

        <!-- Right Sidebar: Daily Snapshot -->
        <aside class="mww-snapshot-sidebar">
          <div class="snapshot-card">
            <div class="snapshot-header">
              <i class="pi pi-bookmark"></i>
              <h3>Daily Snapshot</h3>
            </div>
            <div class="snapshot-score-row">
              <div>
                <span class="label">Overall Wellness Score</span>
                <strong class="big-score">{{ computedWellnessScore() }} <small>/100</small></strong>
              </div>
              <span class="status-chip success">{{ service.getWellnessStatus(computedWellnessScore()) }}</span>
            </div>
            <div class="score-bar"><span [style.width.%]="computedWellnessScore()"></span></div>

            <div class="snapshot-metrics-list">
              <div class="snap-item">
                <i class="pi pi-heart red"></i>
                <span>Positive Thoughts</span>
                <strong>{{ entry.positiveThoughts.length }} thoughts</strong>
              </div>
              <div class="snap-item">
                <i class="pi pi-moon purple"></i>
                <span>Meditation Minutes</span>
                <strong>{{ entry.meditationMinutes }} min</strong>
              </div>
              <div class="snap-item">
                <i class="pi pi-mobile blue"></i>
                <span>Screen Time</span>
                <strong>{{ entry.screenTimeHours }}h {{ entry.screenTimeMinutes }}m</strong>
              </div>
              <div class="snap-item">
                <i class="pi pi-leaf green"></i>
                <span>Digital Detox</span>
                <strong>{{ entry.digitalDetoxHours }}h {{ entry.digitalDetoxMinutes }}m</strong>
              </div>
            </div>

            <!-- AI Wellness Insight Preview -->
            <div class="ai-insight-box">
              <div class="ai-head">
                <i class="pi pi-sparkles"></i>
                <span>AI Wellness Insight</span>
              </div>
              <p>{{ aiInsightPreview() }}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      color: var(--text-primary);
    }

    .mww-page {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* ── Header ── */
    .mww-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .mww-header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .back-link {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      background: var(--surface-card);
      color: var(--text-primary);
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    .mww-header-title h2 {
      margin: 0;
      font-size: 1.45rem;
      line-height: 1.2;
    }

    .mww-header-title p {
      margin: 2px 0 0;
      font-size: 0.84rem;
      color: var(--text-secondary);
    }

    .mww-header-meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .date-field {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 6px 12px;
      font-size: 0.82rem;
      color: var(--text-secondary);
    }

    .date-field input {
      border: 0;
      background: transparent;
      color: var(--text-primary);
      font-weight: 700;
    }

    .help-btn {
      border: 1px solid var(--border-color);
      background: var(--surface-card);
      border-radius: 14px;
      padding: 8px 14px;
      font-weight: 700;
      font-size: 0.82rem;
      color: var(--accent-primary);
      cursor: pointer;
    }

    /* ── Stepper ── */
    .mww-stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: color-mix(in srgb, var(--surface-card) 88%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 14px 20px;
      backdrop-filter: blur(20px);
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      flex: 1;
      position: relative;
    }

    .step-badge {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-weight: 900;
      font-size: 0.9rem;
      display: grid;
      place-items: center;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .step-item.active .step-badge {
      background: var(--accent-gradient);
      color: #fff;
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
    }

    .step-item.completed .step-badge {
      background: #10b981;
      color: #fff;
    }

    .step-copy {
      display: flex;
      flex-direction: column;
    }

    .step-copy strong {
      font-size: 0.85rem;
      line-height: 1.1;
    }

    .step-copy small {
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .step-connector {
      height: 2px;
      background: var(--border-color);
      flex: 1;
      margin: 0 10px;
    }

    /* ── Main Layout ── */
    .mww-main-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 18px;
    }

    .mww-form-area {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .wizard-step-pane {
      background: color-mix(in srgb, var(--surface-card) 88%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 22px;
      padding: 22px;
      backdrop-filter: blur(20px);
      min-height: 440px;
    }

    .pane-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }

    .pane-header i {
      font-size: 1.2rem;
      color: var(--accent-primary);
    }

    .pane-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
    }

    .pane-header p {
      margin: 2px 0 0;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    /* ── Step 1: Metrics ── */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .metric-slider-card, .metric-select-card {
      background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .card-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .icon-label {
      font-size: 0.85rem;
      font-weight: 800;
    }

    .val-label {
      font-size: 1.3rem;
      font-weight: 900;
    }

    .val-label small {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .feeling-tag {
      font-size: 0.75rem;
      font-weight: 700;
      color: #10b981;
    }

    .feeling-tag.info { color: #3b82f6; }
    .feeling-tag.warning { color: #f59e0b; }

    input[type="range"] {
      width: 100%;
      accent-color: var(--accent-primary);
    }

    .range-marks {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .metric-select-card select {
      width: 100%;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-weight: 700;
    }

    .select-desc {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* ── Step 2: Journal ── */
    .journal-grid, .practices-grid, .growth-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .span-2 {
      grid-column: span 2;
    }

    .journal-card, .practice-card, .growth-card {
      background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .input-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .list-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .list-row .num {
      font-size: 0.8rem;
      font-weight: 900;
      color: var(--text-secondary);
    }

    .list-row input {
      flex: 1;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.85rem;
    }

    .remove-btn {
      border: 0;
      background: transparent;
      color: var(--danger);
      cursor: pointer;
    }

    .add-more-btn {
      border: 0;
      background: var(--accent-surface);
      color: var(--accent-primary);
      border-radius: 10px;
      padding: 8px 14px;
      font-weight: 800;
      font-size: 0.82rem;
      cursor: pointer;
      align-self: flex-start;
    }

    .reflection-textarea, .notes-textarea {
      width: 100%;
      height: 120px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      padding: 12px;
      font-family: inherit;
      font-size: 0.85rem;
      resize: vertical;
    }

    .char-count {
      align-self: flex-end;
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .thoughts-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .thought-chip {
      background: var(--accent-surface);
      border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
      color: var(--accent-primary);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .thought-chip button {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .add-thought-row {
      display: flex;
      gap: 8px;
    }

    .add-thought-row input {
      flex: 1;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    /* ── Step 3: Practices ── */
    .big-counter-display {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .big-counter-display strong {
      font-size: 2.2rem;
      line-height: 1;
      font-weight: 900;
    }

    .big-counter-display span {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .field-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-secondary);
      margin-top: 6px;
    }

    .practice-card select, .practice-card input[type="text"] {
      width: 100%;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    .time-spinner-row {
      display: flex;
      gap: 12px;
    }

    .spin-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .spin-box input {
      width: 100%;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-weight: 800;
      font-size: 1.1rem;
    }

    .spin-box label {
      font-size: 0.72rem;
      color: var(--text-secondary);
    }

    /* ── Step 4: Growth ── */
    .counter-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .counter-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: var(--surface-card);
      color: var(--text-primary);
      font-size: 1.2rem;
      font-weight: 900;
      cursor: pointer;
    }

    .count-num {
      font-size: 1.8rem;
      font-weight: 900;
    }

    /* ── Step 5: Review ── */
    .review-header-card {
      display: flex;
      align-items: center;
      gap: 20px;
      background: color-mix(in srgb, var(--bg-tertiary) 70%, transparent);
      border-radius: 18px;
      padding: 18px;
      margin-bottom: 18px;
    }

    .score-ring-large {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      background: var(--accent-gradient);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 24px rgba(99, 102, 241, 0.3);
    }

    .score-ring-large strong {
      font-size: 2rem;
      line-height: 1;
      font-weight: 900;
    }

    .score-ring-large small {
      font-size: 0.68rem;
      opacity: 0.9;
    }

    .review-copy h3 {
      margin: 0;
      font-size: 1.2rem;
    }

    .review-copy p {
      margin: 2px 0 10px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .ai-summary-btn {
      border: 0;
      background: linear-gradient(135deg, #a78bfa, #8b5cf6);
      color: #fff;
      border-radius: 10px;
      padding: 8px 14px;
      font-weight: 800;
      font-size: 0.82rem;
      cursor: pointer;
    }

    .review-details-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .review-block {
      background: color-mix(in srgb, var(--bg-tertiary) 50%, transparent);
      border-radius: 14px;
      padding: 14px;
    }

    .review-block h4 {
      margin: 0 0 8px;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .review-block p {
      margin: 4px 0;
      font-size: 0.82rem;
      color: var(--text-secondary);
    }

    /* ── Sticky Footer ── */
    .mww-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: color-mix(in srgb, var(--surface-card) 92%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 12px 18px;
      backdrop-filter: blur(20px);
      position: sticky;
      bottom: 12px;
      z-index: 10;
    }

    .right-buttons {
      display: flex;
      gap: 10px;
    }

    .footer-btn {
      border-radius: 12px;
      padding: 8px 18px;
      font-weight: 800;
      font-size: 0.88rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border-color);
      transition: all var(--transition-fast);
    }

    .footer-btn.secondary {
      background: var(--surface-card);
      color: var(--text-primary);
    }

    .footer-btn.primary {
      background: var(--accent-gradient);
      color: #fff;
      border: 0;
    }

    .footer-btn.submit-gradient {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    /* ── Right Snapshot Sidebar ── */
    .mww-snapshot-sidebar {
      display: flex;
      flex-direction: column;
    }

    .snapshot-card {
      background: color-mix(in srgb, var(--surface-card) 88%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 22px;
      padding: 18px;
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: sticky;
      top: 18px;
    }

    .snapshot-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .snapshot-header i {
      color: var(--accent-primary);
    }

    .snapshot-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 800;
    }

    .snapshot-score-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .snapshot-score-row .label {
      font-size: 0.72rem;
      color: var(--text-secondary);
      font-weight: 700;
      display: block;
    }

    .big-score {
      font-size: 1.8rem;
      line-height: 1;
      font-weight: 900;
    }

    .big-score small {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .score-bar {
      height: 7px;
      background: var(--bg-tertiary);
      border-radius: 999px;
      overflow: hidden;
    }

    .score-bar span {
      display: block;
      height: 100%;
      background: var(--accent-gradient);
      border-radius: inherit;
    }

    .snapshot-metrics-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .snap-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.82rem;
    }

    .snap-item i { font-size: 1rem; }
    .snap-item i.red { color: #f43f5e; }
    .snap-item i.purple { color: #8b5cf6; }
    .snap-item i.blue { color: #3b82f6; }
    .snap-item i.green { color: #10b981; }

    .snap-item strong {
      margin-left: auto;
    }

    .ai-insight-box {
      background: color-mix(in srgb, var(--accent-surface) 60%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ai-head {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--accent-primary);
      font-size: 0.8rem;
      font-weight: 800;
    }

    .ai-insight-box p {
      margin: 0;
      font-size: 0.78rem;
      line-height: 1.35;
      color: var(--text-secondary);
    }

    /* ── Responsive ── */
    @media (max-width: 1100px) {
      .mww-main-layout {
        grid-template-columns: 1fr;
      }
      .mww-snapshot-sidebar {
        display: none;
      }
    }

    @media (max-width: 760px) {
      .metrics-grid, .journal-grid, .practices-grid, .growth-grid, .review-details-grid {
        grid-template-columns: 1fr;
      }
      .span-2 {
        grid-column: span 1;
      }
      .mww-stepper {
        overflow-x: auto;
      }
      .step-copy {
        display: none;
      }
    }
  `],
})
export class MentalWellnessWizardComponent implements OnInit {
  service = inject(MentalWellnessService);
  router = inject(Router);

  activeStep = signal(0);
  steps = [
    { title: 'Wellness Metrics', subtitle: 'Track your scores' },
    { title: 'Journal & Reflection', subtitle: 'Write your thoughts' },
    { title: 'Practices', subtitle: 'Meditation & Breathing' },
    { title: 'Growth & Learning', subtitle: 'Books & Learning' },
    { title: 'Review & Save', subtitle: 'Confirm & Save' },
  ];

  entry: MentalWellnessEntry = createBlankEntry();

  moodOptions = MOOD_OPTIONS;
  emotionalControlOptions = EMOTIONAL_CONTROL_OPTIONS;
  meditationTypes = MEDITATION_TYPES;
  screenCategories = SCREEN_TIME_CATEGORIES;
  detoxActivitiesList = DETOX_ACTIVITIES;

  Math = Math;
  newThoughtText = '';

  computedWellnessScore = computed(() => this.service.computeScore(this.entry));

  aiInsightPreview = computed(() => {
    const score = this.computedWellnessScore();
    if (score >= 80) return 'Great job! Your mental wellness score is high and your meditation routine is strong. 🌟';
    if (score >= 60) return 'Good balance. Try adding 5 more minutes of breathing exercise before sleep for better rest. ✨';
    return 'Your stress level is moderate today. Try a short walk or 10-minute meditation to restore balance.';
  });

  ngOnInit() {
    // Check if draft exists
    const draft = this.service.loadDraft();
    if (draft) {
      this.entry = draft;
    } else {
      // Ensure initial list defaults match design reference
      this.entry.gratitudeEntries = [
        'My family and their love',
        'Good health and energy',
        'Opportunities to learn and grow',
      ];
      this.entry.positiveThoughts = [
        'I am getting better every day',
        'I choose calm and peace',
        'I trust the process',
        'I am strong and capable',
      ];
      this.entry.meditationMinutes = 25;
      this.entry.breathingExerciseSessions = 3;
      this.entry.screenTimeHours = 3;
      this.entry.screenTimeMinutes = 15;
      this.entry.digitalDetoxHours = 2;
      this.entry.digitalDetoxMinutes = 0;
      this.entry.booksRead = 1;
      this.entry.learningHours = 1;
      this.entry.learningMinutes = 30;
    }
  }

  goToStep(step: number) {
    this.activeStep.set(step);
  }

  nextStep() {
    if (this.activeStep() < this.steps.length - 1) {
      this.activeStep.set(this.activeStep() + 1);
    }
  }

  prevStep() {
    if (this.activeStep() > 0) {
      this.activeStep.set(this.activeStep() - 1);
    }
  }

  addGratitude() {
    this.entry.gratitudeEntries.push('');
  }

  removeGratitude(index: number) {
    this.entry.gratitudeEntries.splice(index, 1);
  }

  addThought() {
    if (!this.newThoughtText.trim()) return;
    this.entry.positiveThoughts.push(this.newThoughtText.trim());
    this.newThoughtText = '';
  }

  removeThought(index: number) {
    this.entry.positiveThoughts.splice(index, 1);
  }

  getHappinessLabel(score: number): string {
    if (score >= 8) return 'Great / Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Moderate';
    return 'Low';
  }

  getAnxietyLabel(score: number): string {
    if (score <= 3) return 'Low';
    if (score <= 6) return 'Mild';
    return 'High';
  }

  getStressLabel(score: number): string {
    if (score <= 3) return 'Low';
    if (score <= 6) return 'Moderate';
    return 'High';
  }

  generateAISummary() {
    alert(`✨ AI Wellness Summary Generated!\n\nOverall Score: ${this.computedWellnessScore()}/100 (${this.service.getWellnessStatus(this.computedWellnessScore())})\nRecommendation: Your mood is ${this.entry.mood.toLowerCase()} and stress is ${this.getStressLabel(this.entry.stressLevel).toLowerCase()}. Maintain your ${this.entry.meditationMinutes} minutes of meditation and continue journaling.`);
  }

  saveDraft() {
    this.service.saveDraft(this.entry);
    alert('Draft saved successfully!');
  }

  submitEntry() {
    this.service.addEntry(this.entry);
    this.service.clearDraft();
    this.router.navigate(['/life-tracker/mental-wellness']);
  }
}
