import { Routes } from '@angular/router';
import { LifeTrackerComponent } from './life-tracker.component';
import { LifeTrackerDashboardComponent } from './dashboard.component';
import { CategoryViewComponent } from './category-view.component';
import { LifeTrackerCalendarComponent } from './calendar.component';

export const LIFE_TRACKER_ROUTES: Routes = [
  {
    path: '',
    component: LifeTrackerComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: LifeTrackerDashboardComponent },
      { path: 'calendar', component: LifeTrackerCalendarComponent },
      { path: ':type', component: CategoryViewComponent }
    ]
  }
];
