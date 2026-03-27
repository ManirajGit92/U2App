import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LifeTrackerService, CategoryType } from './life-tracker.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-life-tracker-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="calendar-container">
      <div class="calendar-card glass-card">
        <div class="calendar-header">
          <h3>📅 Lifestyle Calendar</h3>
          <div class="month-selector">
            <button class="icon-btn">◀</button>
            <span>{{ currentMonth }} {{ currentYear }}</span>
            <button class="icon-btn">▶</button>
          </div>
        </div>

        <div class="calendar-grid">
          <div class="day-label" *ngFor="let day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']">{{ day }}</div>
          <div class="day-cell" *ngFor="let d of days()" 
               [class.today]="isToday(d)" 
               [class.selected]="selectedDay() === d"
               (click)="selectDay(d)">
             <span class="day-num">{{ d }}</span>
             <div class="habit-dots">
                <span class="dot" *ngFor="let cat of getDayCategories(d)" [style.background]="getCategoryColor(cat)"></span>
             </div>
          </div>
        </div>
      </div>

      <!-- Day Details Modal/Section -->
      <div class="day-details glass-card" *ngIf="selectedDay()">
         <div class="details-header">
           <h4>Daily Log: {{ currentMonth }} {{ selectedDay() }}, {{ currentYear }}</h4>
           <button class="btn btn-secondary btn-sm" (click)="showAddForm = !showAddForm">
             {{ showAddForm ? '✖ Close' : '➕ Add Entry' }}
           </button>
         </div>

         <!-- Add Entry Form (Mini) -->
         <div class="mini-form" *ngIf="showAddForm">
            <select [(ngModel)]="activeCategory">
              <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
            </select>
            <button class="btn btn-primary btn-sm" (click)="goToCategory()">Go to Category Page to Add</button>
            <p class="text-tertiary" style="font-size: 0.75rem; margin-top: 0.5rem">Direct editing is coming soon. For now, use category pages.</p>
         </div>

         <div class="entries-list">
            <div class="entry-item" *ngFor="let entry of dayEntries()">
               <span class="cat-badge" [style.background]="getCategoryColor(entry.category)">{{ entry.category }}</span>
               <span class="entry-text">
                  <strong>{{ getEntryTitle(entry) }}</strong>
                  <small>{{ getEntrySub(entry) }}</small>
               </span>
               <button class="icon-btn" (click)="removeEntry(entry)">🗑️</button>
            </div>
            <div *ngIf="dayEntries().length === 0" class="empty-state">
               No entries for this date.
            </div>
         </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container { display: grid; grid-template-columns: 1fr 350px; gap: 1.5rem; }
    .calendar-card { padding: 1.5rem; }
    .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .month-selector { display: flex; align-items: center; gap: 1rem; font-weight: 700; }

    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border-color); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
    .day-label { background: var(--bg-secondary); text-align: center; font-weight: 700; color: var(--text-tertiary); font-size: 0.7rem; padding: 0.75rem; text-transform: uppercase; }
    .day-cell { height: 90px; background: var(--bg-primary); padding: 0.5rem; cursor: pointer; transition: all 0.2s; position: relative; border: 1px solid transparent; }
    .day-cell:hover { background: rgba(var(--accent-rgb), 0.05); }
    .day-cell.selected { background: rgba(var(--accent-rgb), 0.08); border-color: var(--accent-primary); z-index: 10; }
    .day-cell.today { background: rgba(var(--accent-rgb), 0.03); }
    .day-cell.today .day-num { color: var(--accent-primary); background: rgba(var(--accent-rgb), 0.1); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }

    .day-num { font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); }
    .habit-dots { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 0.5rem; }
    .dot { width: 6px; height: 6px; border-radius: 50%; }

    .day-details { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
    .details-header { display: flex; justify-content: space-between; align-items: center; }
    .details-header h4 { font-size: 0.95rem; }

    .mini-form { padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); }
    .mini-form select { width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); margin-bottom: 0.75rem; }

    .entries-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .entry-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(var(--accent-rgb), 0.02); border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.85rem; }
    .cat-badge { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 40px; color: white; width: 80px; text-align: center; flex-shrink: 0; }
    .entry-text { flex: 1; display: flex; flex-direction: column; }
    .entry-text small { color: var(--text-tertiary); font-size: 0.75rem; }

    .empty-state { text-align: center; padding: 2rem; color: var(--text-tertiary); font-style: italic; font-size: 0.85rem; }

    @media (max-width: 992px) {
      .calendar-container { grid-template-columns: 1fr; }
    }
  `]
})
export class LifeTrackerCalendarComponent implements OnInit {
  service = inject(LifeTrackerService);
  
  currentMonth = 'March';
  currentYear = 2026;
  days = signal<number[]>([]);
  selectedDay = signal<number | null>(27);
  dayEntries = signal<any[]>([]);
  showAddForm = false;
  activeCategory: CategoryType = 'Routines';
  categories: CategoryType[] = ['Routines', 'Expenses', 'Diet', 'Fitness', 'MentalHealth', 'Relationships', 'Investments'];

  allData: Record<string, any[]> = {};

  ngOnInit() {
    this.days.set(Array.from({ length: 31 }, (_, i) => i + 1));
    this.loadAllData();
    this.selectDay(27);
  }

  loadAllData() {
    this.service.routines$.subscribe(d => this.allData['Routines'] = d);
    this.service.expenses$.subscribe(d => this.allData['Expenses'] = d);
    this.service.diet$.subscribe(d => this.allData['Diet'] = d);
    this.service.fitness$.subscribe(d => this.allData['Fitness'] = d);
    this.service.mentalHealth$.subscribe(d => this.allData['MentalHealth'] = d);
    this.service.relationships$.subscribe(d => this.allData['Relationships'] = d);
    this.service.investments$.subscribe(d => this.allData['Investments'] = d);
  }

  isToday(d: number) { return d === 27; }

  selectDay(d: number) {
    this.selectedDay.set(d);
    const dateStr = `${this.currentYear}-03-${String(d).padStart(2, '0')}`;
    this.service.getEntriesForDate(dateStr).subscribe(entries => {
       this.dayEntries.set(entries);
    });
  }

  getDayCategories(d: number): string[] {
    const dateStr = `${this.currentYear}-03-${String(d).padStart(2, '0')}`;
    const cats = new Set<string>();
    Object.keys(this.allData).forEach(cat => {
       if (this.allData[cat].some((e: any) => e.date === dateStr)) cats.add(cat);
    });
    return Array.from(cats);
  }

  getCategoryColor(cat: string) {
    switch(cat) {
      case 'Routines': return '#10b981';
      case 'Expenses': return '#ef4444';
      case 'Diet': return '#f59e0b';
      case 'Fitness': return '#3b82f6';
      case 'MentalHealth': return '#a855f7';
      case 'Relationships': return '#ec4899';
      case 'Investments': return '#6366f1';
      default: return '#eee';
    }
  }

  getEntryTitle(entry: any) {
    return entry.task || entry.description || entry.food || entry.activity || entry.reflection || entry.name || entry.asset;
  }

  getEntrySub(entry: any) {
    if (entry.amount) return `$${entry.amount}`;
    if (entry.calories) return `${entry.calories} kcal`;
    if (entry.duration) return `${entry.duration} mins`;
    if (entry.mood) return `Mood: ${entry.mood}/10`;
    return entry.time || '';
  }

  removeEntry(entry: any) {
    if (confirm('Delete this entry?')) {
       this.service.removeEntry(entry.category, entry.id);
       this.selectDay(this.selectedDay()!);
    }
  }

  goToCategory() {
     window.location.hash = `/life-tracker/${this.activeCategory}`;
  }
}
