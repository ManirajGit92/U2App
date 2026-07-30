import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MentalWellnessService } from './mental-wellness.service';

@Component({
  selector: 'app-mental-wellness-journal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="mwj-page">
      <header class="mwj-header">
        <div>
          <h2>Gratitude Journal & Daily Reflections</h2>
          <p>Explore your thoughts, affirmations, and lessons learned over time.</p>
        </div>
        <a routerLink="../add" class="action-btn primary"><i class="pi pi-plus"></i> New Reflection</a>
      </header>

      <!-- Filter Controls -->
      <div class="controls-card">
        <div class="search-field">
          <i class="pi pi-search"></i>
          <input type="text" [(ngModel)]="searchTerm" placeholder="Search entries, gratitude, or thoughts...">
        </div>
        <div class="chip-filters">
          <button type="button" class="chip" [class.active]="filterType() === 'all'" (click)="filterType.set('all')">All</button>
          <button type="button" class="chip" [class.active]="filterType() === 'gratitude'" (click)="filterType.set('gratitude')">Gratitude</button>
          <button type="button" class="chip" [class.active]="filterType() === 'reflection'" (click)="filterType.set('reflection')">Reflections</button>
          <button type="button" class="chip" [class.active]="filterType() === 'thoughts'" (click)="filterType.set('thoughts')">Positive Thoughts</button>
        </div>
      </div>

      <!-- Content Grid -->
      <section class="journal-feed">
        <article class="feed-card" *ngFor="let entry of filteredEntries()">
          <div class="card-date-badge">
            <i class="pi pi-calendar"></i>
            <span>{{ entry.date }}</span>
            <span class="mood-badge">{{ entry.mood }}</span>
          </div>

          <!-- Gratitude Section -->
          <div class="section-block" *ngIf="entry.gratitudeEntries.length && (filterType() === 'all' || filterType() === 'gratitude')">
            <h4 class="pink"><i class="pi pi-heart-fill"></i> Gratitude Entries</h4>
            <ul class="gratitude-bullets">
              <li *ngFor="let g of entry.gratitudeEntries"><span>{{ g }}</span></li>
            </ul>
          </div>

          <!-- Daily Reflection -->
          <div class="section-block" *ngIf="entry.dailyReflection && (filterType() === 'all' || filterType() === 'reflection')">
            <h4 class="purple"><i class="pi pi-book"></i> Daily Reflection</h4>
            <p class="reflection-body">{{ entry.dailyReflection }}</p>
          </div>

          <!-- Positive Thoughts -->
          <div class="section-block" *ngIf="entry.positiveThoughts.length && (filterType() === 'all' || filterType() === 'thoughts')">
            <h4 class="blue"><i class="pi pi-sun"></i> Positive Thoughts</h4>
            <div class="thought-tags">
              <span class="tag" *ngFor="let t of entry.positiveThoughts">{{ t }}</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .mwj-page { display: flex; flex-direction: column; gap: 18px; }
    .mwj-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .mwj-header h2 { margin: 0; font-size: 1.5rem; }
    .mwj-header p { margin: 2px 0 0; color: var(--text-secondary); font-size: 0.88rem; }
    .action-btn { border-radius: 12px; padding: 8px 16px; font-weight: 700; font-size: 0.85rem; border: 0; background: var(--accent-gradient); color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .controls-card { background: color-mix(in srgb, var(--surface-card) 88%, transparent); border: 1px solid var(--border-color); border-radius: 18px; padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .search-field { display: flex; align-items: center; gap: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 12px; padding: 6px 12px; min-width: 260px; }
    .search-field input { border: 0; background: transparent; color: var(--text-primary); outline: 0; width: 100%; }
    .chip-filters { display: flex; gap: 6px; }
    .chip { border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-secondary); border-radius: 999px; padding: 5px 14px; font-weight: 700; font-size: 0.8rem; cursor: pointer; }
    .chip.active { background: var(--accent-primary); color: #fff; border-color: var(--accent-primary); }
    .journal-feed { display: flex; flex-direction: column; gap: 16px; }
    .feed-card { background: color-mix(in srgb, var(--surface-card) 88%, transparent); border: 1px solid var(--border-color); border-radius: 20px; padding: 18px; backdrop-filter: blur(20px); display: flex; flex-direction: column; gap: 14px; }
    .card-date-badge { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 0.9rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
    .mood-badge { margin-left: auto; font-size: 0.75rem; background: var(--accent-surface); color: var(--accent-primary); padding: 3px 10px; border-radius: 999px; }
    .section-block h4 { margin: 0 0 8px; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
    .section-block h4.pink { color: #f43f5e; }
    .section-block h4.purple { color: #8b5cf6; }
    .section-block h4.blue { color: #3b82f6; }
    .gratitude-bullets { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .gratitude-bullets li { font-size: 0.85rem; color: var(--text-primary); }
    .reflection-body { margin: 0; font-size: 0.85rem; line-height: 1.45; color: var(--text-secondary); }
    .thought-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { background: color-mix(in srgb, var(--bg-tertiary) 80%, transparent); border: 1px solid var(--border-color); border-radius: 999px; padding: 4px 12px; font-size: 0.78rem; font-weight: 700; color: var(--text-primary); }
  `],
})
export class MentalWellnessJournalComponent implements OnInit {
  service = inject(MentalWellnessService);
  searchTerm = '';
  filterType = signal<'all' | 'gratitude' | 'reflection' | 'thoughts'>('all');

  filteredEntries = computed(() => {
    const term = this.searchTerm.toLowerCase();
    return this.service.getEntries().filter((e) => {
      if (!term) return true;
      return (
        e.date.includes(term) ||
        e.dailyReflection.toLowerCase().includes(term) ||
        e.gratitudeEntries.some((g) => g.toLowerCase().includes(term)) ||
        e.positiveThoughts.some((t) => t.toLowerCase().includes(term))
      );
    });
  });

  ngOnInit() {}
}
