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
      {
        path: 'finance',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'overview',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'income-expense',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'investment',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'tax',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'profit-loss',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'assets-liabilities',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'goals',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'reports',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'reminders',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./finance/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent,
              ),
          },
        ],
      },
      {
        path: 'work-tracker',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'overview',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'my-tasks',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'projects',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'meetings',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'time-tracking',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'team',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'notes-documents',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'reports',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'goals',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'reminders',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./work-tracker/work-tracker-dashboard.component').then(
                (m) => m.WorkTrackerDashboardComponent,
              ),
          },
        ],
      },
      { path: 'calendar', component: LifeTrackerCalendarComponent },
      { path: ':type', component: CategoryViewComponent },
    ],
  },
];
