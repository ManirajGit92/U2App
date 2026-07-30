import { Routes } from '@angular/router';
import { LifeTrackerComponent } from './life-tracker.component';
import { LifeTrackerDashboardComponent } from './dashboard.component';
import { CategoryViewComponent } from './category-view.component';
import { LifeTrackerCalendarComponent } from './calendar.component';
import { HealthOverviewComponent } from './health-overview.component';
import { HealthRecordWizardComponent } from './health-record-wizard.component';

export const LIFE_TRACKER_ROUTES: Routes = [
  {
    path: '',
    component: LifeTrackerComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: LifeTrackerDashboardComponent },
      { path: 'health', component: HealthOverviewComponent },
      { path: 'health/add', component: HealthRecordWizardComponent },
      {
        path: 'mental-wellness',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-dashboard.component').then(
                (m) => m.MentalWellnessDashboardComponent,
              ),
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-wizard.component').then(
                (m) => m.MentalWellnessWizardComponent,
              ),
          },
          {
            path: 'trends',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-trends.component').then(
                (m) => m.MentalWellnessTrendsComponent,
              ),
          },
          {
            path: 'journal',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-journal.component').then(
                (m) => m.MentalWellnessJournalComponent,
              ),
          },
          {
            path: 'gratitude',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-journal.component').then(
                (m) => m.MentalWellnessJournalComponent,
              ),
          },
          {
            path: 'thoughts',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-journal.component').then(
                (m) => m.MentalWellnessJournalComponent,
              ),
          },
          {
            path: 'insights',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-insights.component').then(
                (m) => m.MentalWellnessInsightsComponent,
              ),
          },
          {
            path: 'reports',
            loadComponent: () =>
              import('./mental-wellness/mental-wellness-trends.component').then(
                (m) => m.MentalWellnessTrendsComponent,
              ),
          },
        ],
      },
      { path: 'calendar', component: LifeTrackerCalendarComponent },
      { path: ':type', component: CategoryViewComponent },
    ],
  },
];
