import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StandupNoteService, CalendarCategory, CalendarEvent } from '../standup-note.service';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface DayGridItem {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

@Component({
  selector: 'app-office-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="calendar-container">
      <!-- Top Actions & Toolbar -->
      <div class="calendar-toolbar glass-card">
        <div class="toolbar-left">
          <button class="btn btn-secondary btn-nav" (click)="navigatePeriod(-1)">◀ Prev</button>
          <button class="btn btn-secondary btn-today" (click)="goToToday()">Today</button>
          <button class="btn btn-secondary btn-nav" (click)="navigatePeriod(1)">Next ▶</button>
          <h2 class="current-period-label">{{ getPeriodLabel() }}</h2>
        </div>

        <div class="toolbar-center">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search events..."
              [(ngModel)]="searchQuery"
              (ngModelChange)="onFilterChange()"
            />
          </div>
          <div class="filter-box">
            <select [(ngModel)]="filterCategory" (change)="onFilterChange()">
              <option value="">All Categories</option>
              <option *ngFor="let cat of categories" [value]="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="toolbar-right">
          <div class="view-selector">
            <button
              class="btn-view"
              [class.active]="currentView === 'month'"
              (click)="setView('month')"
            >
              Month
            </button>
            <button
              class="btn-view"
              [class.active]="currentView === 'week'"
              (click)="setView('week')"
            >
              Week
            </button>
            <button
              class="btn-view"
              [class.active]="currentView === 'day'"
              (click)="setView('day')"
            >
              Day
            </button>
            <button
              class="btn-view"
              [class.active]="currentView === 'agenda'"
              (click)="setView('agenda')"
            >
              Agenda
            </button>
          </div>
          <button class="btn btn-primary" (click)="openAddEventModal()">
            ➕ Add Event
          </button>
          <button class="btn btn-secondary" (click)="openManageCategoriesModal()">
            ⚙️ Categories
          </button>
        </div>
      </div>

      <!-- Core Views -->
      <div class="calendar-content">
        <!-- Month View -->
        <div *ngIf="currentView === 'month'" class="month-view-grid glass-card animate-fade">
          <div class="weekday-header" *ngFor="let day of weekDays">
            {{ day }}
          </div>
          <div
            *ngFor="let item of monthDays"
            class="day-cell"
            [class.different-month]="!item.isCurrentMonth"
            [class.today]="item.isToday"
            (click)="selectDay(item.date)"
          >
            <div class="day-number">{{ item.date.getDate() }}</div>
            <div class="day-events">
              <div
                *ngFor="let evt of item.events"
                class="event-pill"
                [style.border-left-color]="getCategoryColor(evt.categoryId)"
                [style.background]="getCategoryColorAlpha(evt.categoryId, 0.15)"
                (click)="openEditEventModal(evt, $event)"
              >
                <span class="event-time" *ngIf="evt.time">{{ evt.time }}</span>
                <span class="event-title">{{ evt.title }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Week View -->
        <div *ngIf="currentView === 'week'" class="week-view glass-card animate-fade">
          <div class="week-grid">
            <div class="week-col" *ngFor="let day of weekDaysData">
              <div class="week-col-header" [class.today]="day.isToday">
                <span class="day-lbl">{{ day.label }}</span>
                <span class="day-num">{{ day.date.getDate() }}</span>
              </div>
              <div class="week-col-events" (click)="selectDay(day.date)">
                <div *ngIf="day.events.length === 0" class="empty-col-text">No events</div>
                <div
                  *ngFor="let evt of day.events"
                  class="event-card"
                  [style.border-left-color]="getCategoryColor(evt.categoryId)"
                  [style.background]="getCategoryColorAlpha(evt.categoryId, 0.1)"
                  (click)="openEditEventModal(evt, $event)"
                >
                  <div class="ec-time" *ngIf="evt.time">⏰ {{ evt.time }}</div>
                  <div class="ec-title">{{ evt.title }}</div>
                  <div class="ec-desc" *ngIf="evt.description">{{ evt.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Day View -->
        <div *ngIf="currentView === 'day'" class="day-view glass-card animate-fade">
          <div class="day-view-header">
            <h3>{{ selectedDate | date:'EEEE, MMMM d, y' }}</h3>
          </div>
          <div class="day-timeline">
            <div class="timeline-slot" *ngFor="let slot of timelineSlots">
              <div class="slot-time">{{ slot }}</div>
              <div class="slot-events">
                <div
                  *ngFor="let evt of getEventsForTimeSlot(slot)"
                  class="event-card-horizontal"
                  [style.border-left-color]="getCategoryColor(evt.categoryId)"
                  [style.background]="getCategoryColorAlpha(evt.categoryId, 0.15)"
                  (click)="openEditEventModal(evt, $event)"
                >
                  <div class="ech-details">
                    <span class="ech-title">{{ evt.title }}</span>
                    <span class="ech-desc" *ngIf="evt.description">- {{ evt.description }}</span>
                  </div>
                  <span class="ech-category badge" [style.background]="getCategoryColor(evt.categoryId)">
                    {{ getCategoryName(evt.categoryId) }}
                  </span>
                </div>
              </div>
            </div>
            <!-- All day / time-less events -->
            <div class="timeline-slot untimed-slot">
              <div class="slot-time">All Day / Other</div>
              <div class="slot-events">
                <div *ngIf="getUntimedEvents().length === 0" class="no-untimed">No untimed events today.</div>
                <div
                  *ngFor="let evt of getUntimedEvents()"
                  class="event-card-horizontal"
                  [style.border-left-color]="getCategoryColor(evt.categoryId)"
                  [style.background]="getCategoryColorAlpha(evt.categoryId, 0.15)"
                  (click)="openEditEventModal(evt, $event)"
                >
                  <div class="ech-details">
                    <span class="ech-title">{{ evt.title }}</span>
                    <span class="ech-desc" *ngIf="evt.description">- {{ evt.description }}</span>
                  </div>
                  <span class="ech-category badge" [style.background]="getCategoryColor(evt.categoryId)">
                    {{ getCategoryName(evt.categoryId) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Agenda View -->
        <div *ngIf="currentView === 'agenda'" class="agenda-view glass-card animate-fade">
          <div *ngIf="agendaGroups.length === 0" class="empty-state">
            No upcoming events match your search/filter criteria.
          </div>
          <div class="agenda-group" *ngFor="let group of agendaGroups">
            <div class="agenda-group-header">
              <h4>{{ group.dateStr | date:'EEEE, MMMM d, y' }}</h4>
            </div>
            <div class="agenda-items">
              <div
                class="agenda-item"
                *ngFor="let evt of group.events"
                (click)="openEditEventModal(evt, $event)"
              >
                <div class="agenda-time">
                  <span class="bullet" [style.background]="getCategoryColor(evt.categoryId)"></span>
                  {{ evt.time || 'All Day' }}
                </div>
                <div class="agenda-details">
                  <div class="agenda-title">{{ evt.title }}</div>
                  <div class="agenda-desc" *ngIf="evt.description">{{ evt.description }}</div>
                </div>
                <div class="agenda-category">
                  <span class="badge" [style.background]="getCategoryColor(evt.categoryId)">
                    {{ getCategoryName(evt.categoryId) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Color Legend below Calendar -->
      <div class="calendar-legend glass-card">
        <span class="legend-title">Categories Legend:</span>
        <div class="legend-items">
          <div class="legend-item" *ngFor="let cat of categories">
            <span class="legend-color" [style.background]="cat.color"></span>
            <span class="legend-label">{{ cat.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Form Modal (Add / Edit) -->
    <div class="modal-overlay" *ngIf="isEventModalOpen">
      <div class="modal-content glass-card animate-zoom">
        <div class="modal-header">
          <h3>{{ editingEvent?.id ? 'Edit Calendar Event' : 'Add Calendar Event' }}</h3>
          <button class="btn-close" (click)="closeEventModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full-width">
              <label>Event Title *</label>
              <input type="text" [(ngModel)]="eventForm.title" placeholder="Sprint Review, Launch Party..." class="form-input" />
            </div>

            <div class="form-group full-width">
              <label>Description</label>
              <textarea [(ngModel)]="eventForm.description" placeholder="A brief description of this event..." class="form-input" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>Date *</label>
              <input type="date" [(ngModel)]="eventForm.date" class="form-input" />
            </div>

            <div class="form-group">
              <label>Time (Optional)</label>
              <input type="time" [(ngModel)]="eventForm.time" class="form-input" />
            </div>

            <div class="form-group full-width">
              <label>Category *</label>
              <select [(ngModel)]="eventForm.categoryId" class="form-input">
                <option value="">Select Category</option>
                <option *ngFor="let cat of categories" [value]="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-danger text-white btn-delete" *ngIf="editingEvent?.id" (click)="deleteEvent()">
            🗑️ Delete
          </button>
          <div class="footer-actions-right">
            <button class="btn btn-secondary" (click)="closeEventModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveEvent()">Save Event</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Categories Management Modal -->
    <div class="modal-overlay" *ngIf="isCategoriesModalOpen">
      <div class="modal-content glass-card max-w-lg animate-zoom">
        <div class="modal-header">
          <h3>⚙️ Manage Event Categories</h3>
          <button class="btn-close" (click)="closeCategoriesModal()">×</button>
        </div>
        <div class="modal-body">
          <!-- Create/Edit Category Box -->
          <div class="category-form-box">
            <h4>{{ editingCategory?.id ? 'Edit Category' : 'Create New Category' }}</h4>
            <div class="cat-form-row">
              <input
                type="text"
                placeholder="Category name..."
                [(ngModel)]="categoryForm.name"
                class="form-input"
              />
              <div class="color-picker-wrap">
                <input
                  type="color"
                  [(ngModel)]="categoryForm.color"
                  title="Choose Category Color"
                  class="color-input"
                />
              </div>
              <button class="btn btn-primary" (click)="saveCategory()">
                {{ editingCategory?.id ? 'Save' : 'Create' }}
              </button>
              <button
                class="btn btn-secondary"
                *ngIf="editingCategory?.id"
                (click)="cancelCategoryEdit()"
              >
                Cancel
              </button>
            </div>
            <!-- Predefined harmonic color helpers -->
            <div class="predefined-colors">
              <span class="color-help-label">Quick select:</span>
              <button
                *ngFor="let col of harmonicColors"
                class="color-dot-btn"
                [style.background]="col"
                [title]="col"
                (click)="categoryForm.color = col"
              ></button>
            </div>
          </div>

          <!-- Existing Categories List -->
          <div class="categories-list-box">
            <h4>Existing Categories</h4>
            <div class="categories-list">
              <div class="category-row" *ngFor="let cat of categories">
                <div class="cat-info">
                  <span class="cat-color-badge" [style.background]="cat.color"></span>
                  <span class="cat-name">{{ cat.name }}</span>
                </div>
                <div class="cat-actions">
                  <button class="btn-icon-sm" (click)="editCategory(cat)" title="Edit">✏️</button>
                  <button
                    class="btn-icon-sm btn-icon-danger"
                    (click)="deleteCategory(cat.id)"
                    title="Delete"
                    [disabled]="categories.length <= 1"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeCategoriesModal()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      animation: fadeInUp 0.4s ease-out;
    }

    /* Toolbar styling */
    .calendar-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .current-period-label {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0.5rem;
      min-width: 140px;
    }

    .toolbar-center {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      max-width: 500px;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.4rem 0.6rem;
      flex: 1;
    }

    .search-box input {
      background: transparent;
      border: none;
      color: var(--text-primary);
      outline: none;
      font-size: 0.85rem;
      margin-left: 0.4rem;
      width: 100%;
    }

    .filter-box select {
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
      outline: none;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .view-selector {
      display: flex;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 2px;
    }

    .btn-view {
      border: none;
      background: none;
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-view:hover {
      color: var(--text-primary);
    }

    .btn-view.active {
      background: var(--accent-primary);
      color: #fff !important;
    }

    /* Views Common */
    .calendar-content {
      min-height: 500px;
      display: flex;
      flex-direction: column;
    }

    /* Month view styling */
    .month-view-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      grid-auto-rows: minmax(100px, 1fr);
      border-collapse: collapse;
      overflow: hidden;
      padding: 0.5rem;
    }

    .weekday-header {
      text-align: center;
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--text-secondary);
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .day-cell {
      border-right: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      padding: 0.4rem;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: background 0.15s;
      min-height: 100px;
    }

    .day-cell:nth-child(7n) {
      border-right: none;
    }

    .day-cell:hover {
      background: var(--bg-tertiary);
    }

    .day-cell.different-month {
      opacity: 0.4;
    }

    .day-cell.today {
      background: var(--accent-surface);
    }

    .day-cell.today .day-number {
      background: var(--accent-primary);
      color: #fff;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }

    .day-number {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.4rem;
      align-self: flex-start;
    }

    .day-events {
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow-y: auto;
      flex: 1;
      max-height: 110px;
    }

    .event-pill {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      border-left: 3px solid transparent;
      color: var(--text-primary);
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: transform 0.1s;
    }

    .event-pill:hover {
      transform: translateX(2px);
      filter: brightness(1.1);
    }

    .event-time {
      font-size: 0.65rem;
      opacity: 0.75;
      font-weight: 700;
    }

    /* Week view styling */
    .week-view {
      padding: 0.5rem;
    }

    .week-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
      min-height: 450px;
    }

    .week-col {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-color);
      padding: 0.25rem;
    }

    .week-col:last-child {
      border-right: none;
    }

    .week-col-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 0.5rem;
    }

    .week-col-header.today {
      background: var(--accent-surface);
      border-radius: 8px;
      color: var(--accent-primary);
      font-weight: 700;
    }

    .week-col-header .day-lbl {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-secondary);
    }

    .week-col-header .day-num {
      font-size: 1.2rem;
      font-weight: 700;
    }

    .week-col-events {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-height: 380px;
      cursor: pointer;
    }

    .empty-col-text {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-style: italic;
      margin-top: 1rem;
    }

    .event-card {
      border-left: 4px solid transparent;
      padding: 0.5rem;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.15s;
      box-shadow: var(--shadow-sm);
    }

    .event-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      filter: brightness(1.05);
    }

    .ec-time {
      font-size: 0.7rem;
      font-weight: 700;
      opacity: 0.8;
    }

    .ec-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .ec-desc {
      font-size: 0.72rem;
      color: var(--text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Day view styling */
    .day-view {
      padding: 1rem;
    }

    .day-view-header {
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }

    .day-view-header h3 {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .day-timeline {
      display: flex;
      flex-direction: column;
    }

    .timeline-slot {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      min-height: 48px;
      align-items: center;
    }

    .slot-time {
      width: 80px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      padding-right: 1rem;
      border-right: 1px solid var(--border-color);
      height: 100%;
      display: flex;
      align-items: center;
    }

    .slot-events {
      flex: 1;
      padding-left: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      justify-content: center;
    }

    .event-card-horizontal {
      border-left: 4px solid transparent;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: background 0.15s;
    }

    .event-card-horizontal:hover {
      filter: brightness(1.05);
    }

    .ech-details {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .ech-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .ech-desc {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .ech-category {
      font-size: 0.7rem;
      color: #fff;
      padding: 2px 6px;
    }

    .untimed-slot {
      margin-top: 1rem;
      background: var(--bg-tertiary);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .no-untimed {
      font-size: 0.78rem;
      color: var(--text-secondary);
      font-style: italic;
    }

    /* Agenda View */
    .agenda-view {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .agenda-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .agenda-group-header {
      padding-bottom: 0.25rem;
      border-bottom: 1px solid var(--border-color);
    }

    .agenda-group-header h4 {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--accent-primary);
    }

    .agenda-items {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .agenda-item {
      display: grid;
      grid-template-columns: 100px 1fr 100px;
      align-items: center;
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .agenda-item:hover {
      background: var(--bg-tertiary);
    }

    .agenda-time {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .agenda-time .bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .agenda-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .agenda-desc {
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    .agenda-category {
      justify-self: end;
    }

    .agenda-category .badge {
      color: #fff;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
      font-style: italic;
    }

    /* Legend */
    .calendar-legend {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 1rem;
      flex-wrap: wrap;
    }

    .legend-title {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-secondary);
    }

    .legend-items {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 4px;
    }

    .legend-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    /* Modal Overlay */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 15, 26, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      animation: fadeIn 0.2s ease-out;
    }

    .modal-content {
      width: 100%;
      max-width: 550px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
    }

    .modal-content.max-w-lg {
      max-width: 500px;
    }

    .modal-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-header h3 {
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0;
    }

    .btn-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      color: var(--text-secondary);
      cursor: pointer;
    }

    .modal-body {
      padding: 1rem;
      max-height: 70vh;
      overflow-y: auto;
    }

    .modal-footer {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-actions-right {
      display: flex;
      gap: 0.5rem;
      margin-left: auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-group.full-width {
      grid-column: span 2;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .form-input {
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      font-size: 0.88rem;
      outline: none;
      width: 100%;
    }

    .form-input:focus {
      border-color: var(--accent-primary);
    }

    textarea.form-input {
      resize: vertical;
    }

    .btn-delete {
      margin-right: auto;
    }

    /* Category modal details */
    .category-form-box {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.75rem;
      margin-bottom: 1rem;
    }

    .category-form-box h4 {
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .cat-form-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .color-picker-wrap {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .color-input {
      width: 56px;
      height: 56px;
      border: none;
      padding: 0;
      background: none;
      cursor: pointer;
    }

    .predefined-colors {
      margin-top: 0.5rem;
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }

    .color-help-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .color-dot-btn {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.2);
      cursor: pointer;
      padding: 0;
    }

    .color-dot-btn:hover {
      transform: scale(1.15);
    }

    .categories-list-box h4 {
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .categories-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .category-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0.5rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
    }

    .cat-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .cat-color-badge {
      width: 14px;
      height: 14px;
      border-radius: 4px;
    }

    .cat-name {
      font-size: 0.88rem;
      font-weight: 600;
    }

    .cat-actions {
      display: flex;
      gap: 0.25rem;
    }

    .btn-icon-sm {
      border: none;
      background: none;
      cursor: pointer;
      font-size: 0.9rem;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .btn-icon-sm:hover {
      background: var(--bg-input);
    }

    .btn-icon-danger:hover {
      background: rgba(239,68,68,0.15);
    }

    .badge {
      border-radius: 20px;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
    }

    /* Animations */
    .animate-fade {
      animation: fadeIn 0.25s ease-out;
    }
    .animate-zoom {
      animation: zoomIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes zoomIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    /* Responsive adjustments */
    @media (max-width: 900px) {
      .calendar-toolbar {
        flex-direction: column;
        align-items: stretch;
      }
      .toolbar-left, .toolbar-center, .toolbar-right {
        max-width: none;
        justify-content: space-between;
      }
      .month-view-grid {
        grid-template-columns: repeat(7, 1fr);
      }
    }

    @media (max-width: 600px) {
      .week-grid {
        grid-template-columns: 1fr;
        min-height: auto;
      }
      .week-col {
        border-right: none;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 1rem;
      }
      .week-col-events {
        min-height: auto;
      }
      .agenda-item {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }
      .agenda-category {
        justify-self: start;
      }
    }
  `],
})
export class OfficeCalendarComponent implements OnInit {
  private svc = inject(StandupNoteService);

  currentView: CalendarView = 'month';
  currentDate = new Date();
  selectedDate = new Date();

  // Search & Filter state
  searchQuery = '';
  filterCategory = '';

  // Data arrays
  categories: CalendarCategory[] = [];
  allEvents: CalendarEvent[] = [];
  filteredEvents: CalendarEvent[] = [];

  // Month days mapping
  monthDays: DayGridItem[] = [];
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Form states
  isEventModalOpen = false;
  editingEvent: CalendarEvent | null = null;
  eventForm = {
    title: '',
    description: '',
    date: '',
    time: '',
    categoryId: '',
  };

  isCategoriesModalOpen = false;
  editingCategory: CalendarCategory | null = null;
  categoryForm = {
    name: '',
    color: '#6366f1',
  };

  // Modern Predefined Colors helper
  readonly harmonicColors = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#ef4444', // Red
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
  ];

  timelineSlots: string[] = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  ngOnInit() {
    this.svc.state$.subscribe((state) => {
      this.categories = state.calendarCategories || [];
      this.allEvents = state.calendarEvents || [];
      this.onFilterChange();
    });
  }

  // --- View Handling ---
  setView(view: CalendarView) {
    this.currentView = view;
    this.generateViewData();
  }

  getPeriodLabel(): string {
    if (this.currentView === 'month') {
      return this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (this.currentView === 'week') {
      const startOfWeek = this.getStartOfWeek(this.currentDate);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short' })} ${startOfWeek.getFullYear()}`;
      } else {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short' })} ${startOfWeek.getFullYear()}`;
      }
    } else if (this.currentView === 'day') {
      return this.selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return 'Agenda List';
  }

  navigatePeriod(direction: number) {
    if (this.currentView === 'month') {
      const d = new Date(this.currentDate);
      d.setMonth(d.getMonth() + direction);
      this.currentDate = d;
    } else if (this.currentView === 'week') {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + direction * 7);
      this.currentDate = d;
    } else if (this.currentView === 'day') {
      const d = new Date(this.selectedDate);
      d.setDate(d.getDate() + direction);
      this.selectedDate = d;
      this.currentDate = d;
    }
    this.generateViewData();
  }

  goToToday() {
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.generateViewData();
  }

  selectDay(date: Date) {
    this.selectedDate = date;
    this.currentDate = date;
    // Auto shift to Day view on cell click (adds great user experience!)
    this.setView('day');
  }

  // --- Filters ---
  onFilterChange() {
    const query = this.searchQuery.toLowerCase().trim();
    const catFilter = this.filterCategory;

    this.filteredEvents = this.allEvents.filter((e) => {
      const matchesQuery =
        !query ||
        e.title.toLowerCase().includes(query) ||
        (e.description && e.description.toLowerCase().includes(query));
      const matchesCat = !catFilter || e.categoryId === catFilter;
      return matchesQuery && matchesCat;
    });

    this.generateViewData();
  }

  // --- View Data Generators ---
  generateViewData() {
    if (this.currentView === 'month') {
      this.generateMonthDays();
    } else if (this.currentView === 'week') {
      this.generateWeekDaysData();
    }
  }

  private generateMonthDays() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = firstDayOfMonth.getDay(); // 0 is Sun

    const lastDayOfMonth = new Date(year, month + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    const days: DayGridItem[] = [];

    // Prev month padding
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      days.push(this.createGridDayItem(d, false));
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push(this.createGridDayItem(d, true));
    }

    // Next month padding
    const remainingSlots = 42 - days.length; // 6 rows of 7
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      days.push(this.createGridDayItem(d, false));
    }

    this.monthDays = days;
  }

  private createGridDayItem(date: Date, isCurrentMonth: boolean): DayGridItem {
    const dateStr = this.formatDateString(date);
    const dayEvents = this.filteredEvents.filter((e) => e.date === dateStr);
    const todayStr = this.formatDateString(new Date());
    return {
      date,
      isCurrentMonth,
      isToday: dateStr === todayStr,
      events: dayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    };
  }

  // Week View Data helper
  weekDaysData: { label: string; date: Date; isToday: boolean; events: CalendarEvent[] }[] = [];
  private generateWeekDaysData() {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const todayStr = this.formatDateString(new Date());

    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = this.formatDateString(d);
      const dayEvents = this.filteredEvents.filter((e) => e.date === dateStr);
      result.push({
        label: this.weekDays[i],
        date: d,
        isToday: dateStr === todayStr,
        events: dayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || '')),
      });
    }
    this.weekDaysData = result;
  }

  // Agenda View grouping
  get agendaGroups() {
    const groups: { [key: string]: CalendarEvent[] } = {};
    const sorted = [...this.filteredEvents].sort((a, b) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return (a.time || '').localeCompare(b.time || '');
    });

    sorted.forEach((e) => {
      if (!groups[e.date]) {
        groups[e.date] = [];
      }
      groups[e.date].push(e);
    });

    return Object.keys(groups).map((key) => ({
      dateStr: key,
      events: groups[key],
    }));
  }

  // Day View helper
  getEventsForTimeSlot(slot: string): CalendarEvent[] {
    const dateStr = this.formatDateString(this.selectedDate);
    return this.filteredEvents.filter((e) => {
      if (e.date !== dateStr) return false;
      if (!e.time) return false;
      const hour = e.time.split(':')[0] + ':00';
      return hour === slot;
    });
  }

  getUntimedEvents(): CalendarEvent[] {
    const dateStr = this.formatDateString(this.selectedDate);
    return this.filteredEvents.filter((e) => e.date === dateStr && !e.time);
  }

  // --- Helpers ---
  private formatDateString(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // adjust when day is sunday
    return new Date(d.setDate(diff));
  }

  getCategoryColor(catId: string): string {
    return this.categories.find((c) => c.id === catId)?.color || '#94a3b8';
  }

  getCategoryName(catId: string): string {
    return this.categories.find((c) => c.id === catId)?.name || 'General';
  }

  getCategoryColorAlpha(catId: string, opacity: number): string {
    const color = this.getCategoryColor(catId);
    // Convert hex to rgba
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
  }

  // --- Category Management ---
  openManageCategoriesModal() {
    this.isCategoriesModalOpen = true;
    this.editingCategory = null;
    this.categoryForm = { name: '', color: '#6366f1' };
  }

  closeCategoriesModal() {
    this.isCategoriesModalOpen = false;
  }

  editCategory(cat: CalendarCategory) {
    this.editingCategory = cat;
    this.categoryForm = { name: cat.name, color: cat.color };
  }

  cancelCategoryEdit() {
    this.editingCategory = null;
    this.categoryForm = { name: '', color: '#6366f1' };
  }

  saveCategory() {
    if (!this.categoryForm.name.trim()) return;

    if (this.editingCategory) {
      // Edit mode
      const updated: CalendarCategory = {
        ...this.editingCategory,
        name: this.categoryForm.name.trim(),
        color: this.categoryForm.color,
      };
      this.svc.updateCalendarCategory(updated);
    } else {
      // Add mode
      const newCat: CalendarCategory = {
        id: this.svc.generateId('CAT', this.categories),
        name: this.categoryForm.name.trim(),
        color: this.categoryForm.color,
      };
      this.svc.addCalendarCategory(newCat);
    }

    this.cancelCategoryEdit();
  }

  deleteCategory(id: string) {
    if (confirm('Are you sure you want to delete this category? All events linked to this category will also be deleted.')) {
      this.svc.deleteCalendarCategory(id);
      this.cancelCategoryEdit();
    }
  }

  // --- Event Management ---
  openAddEventModal() {
    this.editingEvent = null;
    this.eventForm = {
      title: '',
      description: '',
      date: this.formatDateString(this.selectedDate),
      time: '',
      categoryId: this.categories.length > 0 ? this.categories[0].id : '',
    };
    this.isEventModalOpen = true;
  }

  openEditEventModal(evt: CalendarEvent, event: Event) {
    event.stopPropagation(); // prevent grid cell click trigger
    this.editingEvent = evt;
    this.eventForm = {
      title: evt.title,
      description: evt.description,
      date: evt.date,
      time: evt.time || '',
      categoryId: evt.categoryId,
    };
    this.isEventModalOpen = true;
  }

  closeEventModal() {
    this.isEventModalOpen = false;
    this.editingEvent = null;
  }

  saveEvent() {
    if (!this.eventForm.title.trim() || !this.eventForm.date || !this.eventForm.categoryId) {
      alert('Event title, date and category are required.');
      return;
    }

    if (this.editingEvent) {
      // Edit
      const updated: CalendarEvent = {
        ...this.editingEvent,
        title: this.eventForm.title.trim(),
        description: this.eventForm.description.trim(),
        date: this.eventForm.date,
        time: this.eventForm.time || undefined,
        categoryId: this.eventForm.categoryId,
      };
      this.svc.updateCalendarEvent(updated);
    } else {
      // Add
      const newEvt: CalendarEvent = {
        id: this.svc.generateId('EVT', this.allEvents),
        title: this.eventForm.title.trim(),
        description: this.eventForm.description.trim(),
        date: this.eventForm.date,
        time: this.eventForm.time || undefined,
        categoryId: this.eventForm.categoryId,
      };
      this.svc.addCalendarEvent(newEvt);
    }

    this.closeEventModal();
  }

  deleteEvent() {
    if (this.editingEvent && confirm('Are you sure you want to delete this event?')) {
      this.svc.deleteCalendarEvent(this.editingEvent.id);
      this.closeEventModal();
    }
  }
}
