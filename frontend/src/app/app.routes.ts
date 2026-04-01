import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'compare',
    loadComponent: () =>
      import('./features/compare/compare.component').then(
        (m) => m.CompareComponent
      ),
  },
  {
    path: 'tax-calculator',
    loadComponent: () =>
      import('./features/tax-calculator/tax-calculator.component').then(
        (m) => m.TaxCalculatorComponent
      ),
  },
  {
    path: 'content-video',
    loadComponent: () =>
      import('./features/content-video/content-video.component').then(
        (m) => m.ContentVideoComponent
      ),
  },
  {
    path: 'content-creator',
    loadComponent: () =>
      import('./features/content-creator/content-creator.component').then(
        (m) => m.ContentCreatorComponent
      ),
  },
  {
    path: 'html-viewer',
    loadComponent: () =>
      import('./features/html-viewer/html-viewer.component').then(
        (m) => m.HtmlViewerComponent
      ),
  },
  {
    path: 'work-tracker',
    loadComponent: () =>
      import('./features/work-tracker/work-tracker.component').then(
        (m) => m.WorkTrackerComponent
      ),
  },
  {
    path: 'estimator',
    loadComponent: () =>
      import('./features/estimator/estimator.component').then(
        (m) => m.EstimatorComponent
      ),
  },
  {
    path: 'real-life-steps',
    loadComponent: () =>
      import('./features/real-life-steps/real-life-steps.component').then(
        (m) => m.RealLifeStepsComponent
      ),
  },
  {
    path: 'controls-to-excel',
    loadComponent: () =>
      import('./features/controls-to-excel/controls-to-excel.component').then(
        (m) => m.ControlsToExcelComponent
      ),
  },
  {
    path: 'unit-test-tracker',
    loadComponent: () =>
      import('./features/unit-test-tracker/unit-test-tracker.component').then(
        (m) => m.UnitTestTrackerComponent
      ),
  },
  {
    path: 'standup-note',
    loadComponent: () =>
      import('./features/standup-note/standup-note.component').then(
        (m) => m.StandupNoteComponent
      ),
  },
  {
    path: 'office-fun',
    loadComponent: () =>
      import('./features/office-fun/office-fun.component').then(
        (m) => m.OfficeFunComponent
      ),
  },
  {
    path: 'image-navigator',
    loadComponent: () =>
      import('./features/image-navigator/image-navigator.component').then(
        (m) => m.ImageNavigatorComponent
      ),
  },
  {
    path: 'life-tracker',
    loadChildren: () =>
      import('./features/life-tracker/life-tracker.routes').then(
        (m) => m.LIFE_TRACKER_ROUTES
      ),
  },
  {
    path: 'easy-documents',
    loadComponent: () =>
      import('./features/easy-documents/easy-documents.component').then(
        (m) => m.EasyDocumentsComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
