import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LifeTrackerService } from './life-tracker.service';

@Component({
  selector: 'app-health-record-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="record-page">
      <section class="record-hero">
        <div>
          <h2>Add New Health Record</h2>
          <p>Track your health. Stay healthy. Live better.</p>
        </div>
        <div class="hero-meta">
          <span><i class="pi pi-calendar"></i>Record Date <strong>{{ model.date }}</strong></span>
          <button type="button"><i class="pi pi-question-circle"></i>Need Help?</button>
        </div>
      </section>

      <section class="wizard-strip" aria-label="Health record steps">
        <button
          *ngFor="let step of steps; let i = index"
          type="button"
          [class.active]="activeStep() === i"
          [class.done]="activeStep() > i"
          (click)="activeStep.set(i)">
          <b>{{ i + 1 }}</b>
          <span>{{ step.title }}<small>{{ step.subtitle }}</small></span>
        </button>
      </section>

      <form class="wizard-content" (ngSubmit)="saveRecord()">
        <section class="form-grid" *ngIf="activeStep() === 0">
          <article class="form-panel span-2">
            <header><i class="pi pi-user"></i><h3>Personal Information</h3><label>Use existing profile <input type="checkbox" [(ngModel)]="model.useProfile" name="useProfile"></label></header>
            <div class="field-grid">
              <label>Full Name<input [(ngModel)]="model.fullName" name="fullName"></label>
              <label>Age<div class="input-unit"><input type="number" [(ngModel)]="model.age" name="age"><span>Years</span></div></label>
              <label>Gender<select [(ngModel)]="model.gender" name="gender"><option>Male</option><option>Female</option><option>Other</option></select></label>
              <label>Blood Group<select [(ngModel)]="model.bloodGroup" name="bloodGroup"><option>O+</option><option>O-</option><option>A+</option><option>B+</option><option>AB+</option></select></label>
              <label>Height<div class="input-unit"><input type="number" [(ngModel)]="model.height" name="height"><span>cm</span></div></label>
              <label>Weight<div class="input-unit"><input type="number" [(ngModel)]="model.weight" name="weight"><span>kg</span></div></label>
              <label>Date of Birth<input type="date" [(ngModel)]="model.dob" name="dob"></label>
              <label>Mobile<input [(ngModel)]="model.mobile" name="mobile"></label>
            </div>
          </article>

          <article class="form-panel">
            <header><i class="pi pi-bullseye"></i><h3>Health Goals</h3><span>Optional</span></header>
            <div class="field-grid compact">
              <label>Target Weight<div class="input-unit"><input type="number" [(ngModel)]="model.targetWeight" name="targetWeight"><span>kg</span></div></label>
              <label>Target Date<input type="date" [(ngModel)]="model.targetDate" name="targetDate"></label>
              <label>Primary Goal<select [(ngModel)]="model.primaryGoal" name="primaryGoal"><option>Lose Weight</option><option>Gain Weight</option><option>Improve Fitness</option><option>Sleep Better</option></select></label>
              <label>Weekly Goal<div class="input-unit"><input type="number" [(ngModel)]="model.weeklyGoal" name="weeklyGoal"><span>kg</span></div></label>
            </div>
            <div class="chip-grid">
              <label *ngFor="let goal of goalOptions"><input type="checkbox" [checked]="model.goals.includes(goal)" (change)="toggleGoal(goal)"><span>{{ goal }}</span></label>
            </div>
          </article>

          <article class="form-panel span-2">
            <header><i class="pi pi-chart-bar"></i><h3>Body Composition</h3><span>Optional</span></header>
            <div class="field-grid">
              <label>Body Fat %<div class="input-unit"><input type="number" [(ngModel)]="model.bodyFat" name="bodyFat"><span>%</span></div></label>
              <label>Muscle %<div class="input-unit"><input type="number" [(ngModel)]="model.muscle" name="muscle"><span>%</span></div></label>
              <label>Water %<div class="input-unit"><input type="number" [(ngModel)]="model.waterPercent" name="waterPercent"><span>%</span></div></label>
              <label>Visceral Fat<div class="input-unit"><input type="number" [(ngModel)]="model.visceralFat" name="visceralFat"><span>Level</span></div></label>
            </div>
          </article>

          <article class="form-panel">
            <header><i class="pi pi-phone"></i><h3>Emergency Contact</h3></header>
            <div class="field-grid single">
              <label>Contact Name<input [(ngModel)]="model.contactName" name="contactName"></label>
              <label>Relationship<select [(ngModel)]="model.relationship" name="relationship"><option>Wife</option><option>Parent</option><option>Friend</option><option>Doctor</option></select></label>
              <label>Phone Number<input [(ngModel)]="model.contactPhone" name="contactPhone"></label>
              <label>Medical Notes<textarea [(ngModel)]="model.medicalNotes" name="medicalNotes"></textarea></label>
            </div>
          </article>

          <article class="form-panel span-2 bmi-panel">
            <header><i class="pi pi-calculator"></i><h3>Weight & BMI Calculator</h3></header>
            <div class="bmi-layout">
              <div class="field-grid single">
                <label>Current Weight<div class="input-unit"><input type="number" [(ngModel)]="model.weight" name="bmiWeight"><span>kg</span></div></label>
                <label>Height<div class="input-unit"><input type="number" [(ngModel)]="model.height" name="bmiHeight"><span>cm</span></div></label>
              </div>
              <div class="bmi-score"><span>BMI</span><strong>{{ bmi() }}</strong><em>{{ bmiCategory() }}</em></div>
              <div class="bmi-scale"><span [style.left.%]="bmiNeedle()"></span></div>
            </div>
          </article>

          <article class="form-panel span-2">
            <header><i class="pi pi-sparkles"></i><h3>Lifestyle Information</h3></header>
            <div class="field-grid">
              <label>Activity Level<select [(ngModel)]="model.activityLevel" name="activityLevel"><option>Low</option><option>Moderate</option><option>High</option></select></label>
              <label>Occupation<input [(ngModel)]="model.occupation" name="occupation"></label>
              <label>Sleep Time<input type="time" [(ngModel)]="model.sleepTime" name="sleepTime"></label>
              <label>Wake Time<input type="time" [(ngModel)]="model.wakeTime" name="wakeTime"></label>
            </div>
            <div class="switch-row">
              <label>Smoke<input type="checkbox" [(ngModel)]="model.smoke" name="smoke"></label>
              <label>Alcohol<input type="checkbox" [(ngModel)]="model.alcohol" name="alcohol"></label>
              <label>Vegetarian<input type="checkbox" [(ngModel)]="model.vegetarian" name="vegetarian"></label>
              <label>Any Allergies<input [(ngModel)]="model.allergies" name="allergies"></label>
            </div>
          </article>
        </section>

        <section class="form-grid" *ngIf="activeStep() === 1">
          <article class="form-panel span-2">
            <header><i class="pi pi-heart"></i><h3>Vitals</h3></header>
            <div class="field-grid">
              <label>Blood Pressure<input [(ngModel)]="model.bloodPressure" name="bloodPressure"></label>
              <label>Heart Rate<div class="input-unit"><input type="number" [(ngModel)]="model.heartRate" name="heartRate"><span>bpm</span></div></label>
              <label>SpO2<div class="input-unit"><input type="number" [(ngModel)]="model.spo2" name="spo2"><span>%</span></div></label>
              <label>Temperature<div class="input-unit"><input type="number" [(ngModel)]="model.temperature" name="temperature"><span>C</span></div></label>
              <label>Blood Sugar<div class="input-unit"><input type="number" [(ngModel)]="model.bloodSugar" name="bloodSugar"><span>mg/dL</span></div></label>
              <label>Stress Level<select [(ngModel)]="model.stress" name="stress"><option>Low</option><option>Medium</option><option>High</option></select></label>
            </div>
          </article>
        </section>

        <section class="form-grid" *ngIf="activeStep() === 2">
          <article class="form-panel span-2">
            <header><i class="pi pi-bolt"></i><h3>Activity</h3></header>
            <div class="field-grid">
              <label>Workout Name<input [(ngModel)]="model.workout" name="workout"></label>
              <label>Duration<div class="input-unit"><input type="number" [(ngModel)]="model.duration" name="duration"><span>min</span></div></label>
              <label>Steps<input type="number" [(ngModel)]="model.steps" name="steps"></label>
              <label>Intensity<select [(ngModel)]="model.intensity" name="intensity"><option>Low</option><option>Medium</option><option>High</option></select></label>
            </div>
          </article>
        </section>

        <section class="form-grid" *ngIf="activeStep() === 3">
          <article class="form-panel span-2">
            <header><i class="pi pi-apple"></i><h3>Nutrition</h3></header>
            <div class="field-grid">
              <label>Meal Type<select [(ngModel)]="model.mealType" name="mealType"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label>
              <label>Food Items<input [(ngModel)]="model.food" name="food"></label>
              <label>Calories<input type="number" [(ngModel)]="model.calories" name="calories"></label>
              <label>Water<div class="input-unit"><input type="number" [(ngModel)]="model.water" name="water"><span>glasses</span></div></label>
            </div>
          </article>
        </section>

        <section class="form-grid" *ngIf="activeStep() === 4">
          <article class="form-panel span-2">
            <header><i class="pi pi-moon"></i><h3>Sleep & Mood</h3></header>
            <div class="field-grid">
              <label>Sleep Hours<input type="number" step="0.1" [(ngModel)]="model.sleepHours" name="sleepHours"></label>
              <label>Mood Score<input type="number" min="1" max="10" [(ngModel)]="model.mood" name="mood"></label>
              <label class="full">Sleep Notes<textarea [(ngModel)]="model.reflection" name="reflection"></textarea></label>
            </div>
          </article>
        </section>

        <section class="form-grid" *ngIf="activeStep() === 5">
          <article class="form-panel span-2">
            <header><i class="pi pi-briefcase"></i><h3>Medications & Reminders</h3></header>
            <div class="field-grid">
              <label>Medicine Name<input [(ngModel)]="model.medicine" name="medicine"></label>
              <label>Dosage<input [(ngModel)]="model.dosage" name="dosage"></label>
              <label>Time<input type="time" [(ngModel)]="model.medicineTime" name="medicineTime"></label>
              <label>Status<select [(ngModel)]="model.medicineStatus" name="medicineStatus"><option>Taken</option><option>Pending</option><option>Missed</option></select></label>
            </div>
          </article>
        </section>

        <section class="form-grid" *ngIf="activeStep() === 6">
          <article class="form-panel">
            <header><i class="pi pi-camera"></i><h3>Health Profile Photo</h3></header>
            <label class="upload-zone">
              <input type="file" accept="image/*" (change)="previewPhoto($event)">
              <i class="pi pi-cloud-upload"></i>
              <span>Drag & drop or click to upload</span>
              <small>JPG, PNG up to 5MB</small>
            </label>
            <img *ngIf="photoPreview()" [src]="photoPreview()" alt="Current health profile photo">
          </article>
          <article class="form-panel">
            <header><i class="pi pi-sparkles"></i><h3>AI Health Notes</h3><span>Optional</span></header>
            <textarea class="notes-area" [(ngModel)]="model.aiNotes" name="aiNotes" placeholder="Feeling good today. Energy is better than yesterday."></textarea>
            <button type="button" class="ai-button" (click)="generateInsights()"><i class="pi pi-sparkles"></i>Generate AI Insights</button>
          </article>
        </section>

        <footer class="wizard-footer">
          <button type="button" class="secondary" routerLink="../health"><i class="pi pi-times"></i>Cancel</button>
          <button type="button" class="secondary" (click)="activeStep.set(activeStep() - 1)" [disabled]="activeStep() === 0"><i class="pi pi-arrow-left"></i>Back</button>
          <button type="button" class="secondary" (click)="saveDraft()"><i class="pi pi-save"></i>Save Draft</button>
          <button *ngIf="activeStep() < steps.length - 1" type="button" class="primary" (click)="activeStep.set(activeStep() + 1)">Next <i class="pi pi-arrow-right"></i></button>
          <button *ngIf="activeStep() === steps.length - 1" type="submit" class="primary"><i class="pi pi-check"></i>Save Record</button>
        </footer>
      </form>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .record-page { display: flex; flex-direction: column; gap: 14px; }
    .record-hero, .wizard-strip, .form-panel, .wizard-footer { background: color-mix(in srgb, var(--surface-card) 90%, transparent); border: 1px solid var(--border-color); box-shadow: 0 18px 52px rgba(15, 23, 42, 0.08); backdrop-filter: blur(22px); }
    .record-hero { border-radius: 22px; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    h2 { margin: 0; font-size: clamp(1.45rem, 2.5vw, 2rem); line-height: 1.1; }
    p, small, header span { color: var(--text-secondary); }
    .hero-meta { display: flex; gap: 12px; flex-wrap: wrap; }
    .hero-meta span, .hero-meta button { min-height: 48px; border-radius: 14px; border: 1px solid var(--border-color); background: var(--surface-card); color: var(--text-primary); display: inline-flex; align-items: center; gap: 10px; padding: 0 14px; }
    .hero-meta span { flex-direction: column; align-items: flex-start; justify-content: center; gap: 0; font-size: 0.8rem; }
    .wizard-strip { border-radius: 20px; padding: 14px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
    .wizard-strip button { border: 0; background: transparent; color: var(--text-secondary); display: flex; align-items: center; gap: 9px; text-align: left; cursor: pointer; border-radius: 14px; padding: 8px; }
    .wizard-strip b { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--bg-tertiary); color: var(--text-primary); }
    .wizard-strip span { font-weight: 900; } .wizard-strip small { display: block; font-size: 0.68rem; font-weight: 700; }
    .wizard-strip button.active { background: var(--accent-surface); color: var(--text-primary); } .wizard-strip button.active b, .wizard-strip button.done b { color: #fff; background: linear-gradient(135deg, #4f46e5, #a855f7); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; animation: fadeUp 0.28s ease both; }
    .form-panel { border-radius: 18px; padding: 16px; }
    .span-2 { grid-column: span 1; }
    header { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 14px; }
    header h3 { margin: 0; font-size: 1rem; letter-spacing: 0; } header i { color: var(--accent-primary); } header label, header span { margin-left: auto; font-size: 0.78rem; }
    .field-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; } .field-grid.compact { grid-template-columns: repeat(2, 1fr); } .field-grid.single { grid-template-columns: 1fr; } .field-grid .full { grid-column: 1 / -1; }
    label { color: var(--text-secondary); font-size: 0.78rem; font-weight: 800; }
    input, select, textarea { width: 100%; min-height: 42px; margin-top: 6px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); padding: 0 11px; font: inherit; }
    textarea { min-height: 90px; padding: 10px 11px; resize: vertical; }
    .input-unit { display: flex; align-items: center; margin-top: 6px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-secondary); overflow: hidden; }
    .input-unit input { border: 0; margin: 0; border-radius: 0; } .input-unit span { padding: 0 10px; color: var(--text-secondary); font-size: 0.78rem; }
    .chip-grid { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 14px; }
    .chip-grid label { border: 1px solid var(--border-color); border-radius: 10px; padding: 8px 11px; display: inline-flex; align-items: center; gap: 8px; background: var(--bg-secondary); }
    input[type="checkbox"] { width: 18px; min-height: 18px; accent-color: var(--accent-primary); margin: 0; }
    .bmi-layout { display: grid; grid-template-columns: minmax(240px, 1fr) 140px minmax(220px, 1fr); gap: 20px; align-items: center; }
    .bmi-score { text-align: center; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color); padding: 14px; } .bmi-score strong { display: block; color: var(--success); font-size: 2rem; } .bmi-score em { color: var(--success); font-style: normal; font-weight: 900; }
    .bmi-scale { height: 10px; border-radius: 999px; background: linear-gradient(90deg, #0ea5e9, #22c55e, #f59e0b, #ef4444); position: relative; }
    .bmi-scale span { width: 16px; height: 16px; border-radius: 50%; background: var(--accent-primary); position: absolute; top: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 5px var(--accent-surface); }
    .switch-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 14px; }
    .upload-zone { min-height: 166px; border: 2px dashed color-mix(in srgb, var(--accent-primary) 35%, var(--border-color)); border-radius: 14px; display: grid; place-items: center; align-content: center; gap: 6px; cursor: pointer; }
    .upload-zone input { display: none; } .upload-zone i { color: var(--accent-primary); font-size: 2rem; }
    img { width: 110px; height: 110px; border-radius: 50%; object-fit: cover; margin: 14px auto 0; display: block; border: 4px solid var(--surface-card); box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16); }
    .notes-area { min-height: 156px; }
    .ai-button, .primary, .secondary { min-height: 44px; border-radius: 12px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; font-weight: 900; cursor: pointer; }
    .ai-button, .primary { color: #fff; background: linear-gradient(135deg, #4f46e5, #a855f7, #0ea5e9); border-color: transparent; } .ai-button { float: right; margin-top: 10px; }
    .secondary { background: var(--surface-card); color: var(--text-primary); } .secondary:disabled { opacity: 0.45; cursor: not-allowed; }
    .wizard-footer { position: sticky; bottom: 0; z-index: 4; border-radius: 20px; padding: 12px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    @media (max-width: 1200px) { .wizard-strip { grid-template-columns: repeat(4, 1fr); } .field-grid { grid-template-columns: repeat(2, 1fr); } .bmi-layout, .switch-row { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .record-hero { align-items: flex-start; flex-direction: column; } .wizard-strip, .form-grid, .field-grid, .field-grid.compact { grid-template-columns: 1fr; } .wizard-strip button { min-height: 58px; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class HealthRecordWizardComponent {
  private service = inject(LifeTrackerService);
  private router = inject(Router);

  activeStep = signal(0);
  photoPreview = signal<string | null>(null);
  steps = [
    { title: 'Personal Info', subtitle: 'Basic Information' },
    { title: 'Vitals', subtitle: 'Health Metrics' },
    { title: 'Activity', subtitle: 'Workout & Exercise' },
    { title: 'Nutrition', subtitle: 'Food & Calories' },
    { title: 'Sleep', subtitle: 'Sleep & Mood' },
    { title: 'Medications', subtitle: 'Reminders' },
    { title: 'Reports', subtitle: 'Uploads & Notes' },
  ];
  goalOptions = ['Lose Weight', 'Gain Weight', 'Improve Fitness', 'Increase Muscle', 'Reduce Stress', 'Sleep Better', 'Eat Healthy'];
  model: any = {
    date: new Date().toISOString().split('T')[0],
    useProfile: false,
    fullName: 'Maniraj T',
    age: 33,
    gender: 'Male',
    bloodGroup: 'O+',
    height: 175,
    weight: 72.5,
    dob: '1990-07-14',
    mobile: '+91 98765 43210',
    targetWeight: 68,
    targetDate: '2024-12-31',
    primaryGoal: 'Lose Weight',
    weeklyGoal: 0.5,
    goals: ['Improve Fitness', 'Reduce Stress', 'Sleep Better'],
    bodyFat: 18,
    muscle: 40,
    waterPercent: 54,
    visceralFat: 8,
    contactName: 'Kavitha T',
    relationship: 'Wife',
    contactPhone: '+91 91234 56789',
    medicalNotes: 'No major health issues.',
    activityLevel: 'Moderate',
    occupation: 'Software Developer',
    sleepTime: '22:00',
    wakeTime: '05:00',
    vegetarian: true,
    allergies: 'Peanuts, Dust',
    bloodPressure: '120/80',
    heartRate: 68,
    spo2: 98,
    temperature: 36.6,
    bloodSugar: 98,
    stress: 'Low',
    workout: 'Strength Training',
    duration: 45,
    steps: 7842,
    intensity: 'Medium',
    mealType: 'Lunch',
    food: 'Rice, dal, vegetables',
    calories: 650,
    water: 6,
    sleepHours: 7.3,
    mood: 8,
    reflection: 'Energy is steady and recovery feels good.',
    medicine: 'Vitamin D3',
    dosage: '1000 IU',
    medicineTime: '09:00',
    medicineStatus: 'Taken',
    aiNotes: '',
  };

  bmi = computed(() => {
    const heightMeters = Number(this.model.height || 0) / 100;
    if (!heightMeters) return '0.0';
    return (Number(this.model.weight || 0) / (heightMeters * heightMeters)).toFixed(1);
  });
  bmiCategory = computed(() => {
    const bmi = Number(this.bmi());
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  });
  bmiNeedle = computed(() => Math.min(96, Math.max(4, ((Number(this.bmi()) - 15) / 20) * 100)));

  toggleGoal(goal: string) {
    this.model.goals = this.model.goals.includes(goal) ? this.model.goals.filter((item: string) => item !== goal) : [...this.model.goals, goal];
  }

  previewPhoto(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(String(reader.result));
    reader.readAsDataURL(file);
  }

  generateInsights() {
    this.model.aiNotes = `BMI is ${this.bmi()} (${this.bmiCategory()}). Prioritize hydration, ${this.model.primaryGoal.toLowerCase()}, and consistent sleep around ${this.model.sleepTime}.`;
  }

  saveDraft() {
    localStorage.setItem('life-tracker-health-draft', JSON.stringify(this.model));
  }

  saveRecord() {
    this.service.addEntry('Fitness', {
      date: this.model.date,
      activity: this.model.workout,
      duration: Number(this.model.duration || 0),
      steps: Number(this.model.steps || 0),
      intensity: this.model.intensity,
    });
    this.service.addEntry('Diet', {
      date: this.model.date,
      type: this.model.mealType,
      food: this.model.food,
      calories: Number(this.model.calories || 0),
      water: Number(this.model.water || 0),
    });
    this.service.addEntry('MentalHealth', {
      date: this.model.date,
      mood: Number(this.model.mood || 0),
      sleep: Number(this.model.sleepHours || 0),
      reflection: `${this.model.reflection} ${this.model.aiNotes}`.trim(),
    });
    this.router.navigate(['/life-tracker/health']);
  }
}
