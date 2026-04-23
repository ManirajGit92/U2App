import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: { navLabel: 'Home', showInNav: true },
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'compare',
    data: { navLabel: 'Compare', showInNav: true },
    loadComponent: () =>
      import('./features/compare/compare.component').then(
        (m) => m.CompareComponent
      ),
  },
  {
    path: 'tax-calculator',
    data: { navLabel: 'Tax Calculator', showInNav: true },
    loadComponent: () =>
      import('./features/tax-calculator/tax-calculator.component').then(
        (m) => m.TaxCalculatorComponent
      ),
  },
  {
    path: 'content-video',
    data: { navLabel: 'Content Video', showInNav: true },
    loadComponent: () =>
      import('./features/content-video/content-video.component').then(
        (m) => m.ContentVideoComponent
      ),
  },
  {
    path: 'content-creator',
    data: { navLabel: 'Content Creator', showInNav: true },
    loadComponent: () =>
      import('./features/content-creator/content-creator.component').then(
        (m) => m.ContentCreatorComponent
      ),
  },
  {
    path: 'tanglish-voice',
    data: { navLabel: 'Tanglish Voice', showInNav: true },
    loadComponent: () =>
      import('./features/tanglish-voice').then(
        (m) => m.TanglishVoiceComponent
      ),
  },
  {
    path: 'html-viewer',
    data: { navLabel: 'HTML Viewer', showInNav: true },
    loadComponent: () =>
      import('./features/html-viewer/html-viewer.component').then(
        (m) => m.HtmlViewerComponent
      ),
  },
  {
    path: 'work-tracker',
    data: { navLabel: 'Work Tracker', showInNav: true },
    loadComponent: () =>
      import('./features/work-tracker/work-tracker.component').then(
        (m) => m.WorkTrackerComponent
      ),
  },
  {
    path: 'estimator',
    data: { navLabel: 'Estimator', showInNav: true },
    loadComponent: () =>
      import('./features/estimator/estimator.component').then(
        (m) => m.EstimatorComponent
      ),
  },
  {
    path: 'real-life-steps',
    data: { navLabel: 'Real Life Steps', showInNav: true },
    loadComponent: () =>
      import('./features/real-life-steps/real-life-steps.component').then(
        (m) => m.RealLifeStepsComponent
      ),
  },
  {
    path: 'controls-to-excel',
    data: { navLabel: 'Controls to Excel', showInNav: true },
    loadComponent: () =>
      import('./features/controls-to-excel/controls-to-excel.component').then(
        (m) => m.ControlsToExcelComponent
      ),
  },
  {
    path: 'excel-mapper',
    data: { navLabel: 'Excel Mapper', showInNav: true },
    loadComponent: () =>
      import('./features/excel-mapper/excel-mapper.component').then(
        (m) => m.ExcelMapperComponent
      ),
  },
  {
    path: 'unit-test-tracker',
    data: { navLabel: 'Unit Test Tracker', showInNav: true },
    loadComponent: () =>
      import('./features/unit-test-tracker/unit-test-tracker.component').then(
        (m) => m.UnitTestTrackerComponent
      ),
  },
  {
    path: 'standup-note',
    data: { navLabel: 'Standup Note', showInNav: true },
    loadComponent: () =>
      import('./features/standup-note/standup-note.component').then(
        (m) => m.StandupNoteComponent
      ),
  },
  {
    path: 'office-fun',
    data: { navLabel: 'Office Fun', showInNav: true },
    loadComponent: () =>
      import('./features/office-fun/office-fun.component').then(
        (m) => m.OfficeFunComponent
      ),
  },
  {
    path: 'image-navigator',
    data: { navLabel: 'Image Navigator', showInNav: true },
    loadComponent: () =>
      import('./features/image-navigator/image-navigator.component').then(
        (m) => m.ImageNavigatorComponent
      ),
  },
  {
    path: 'life-tracker',
    data: { navLabel: 'Life Tracker', showInNav: true },
    loadChildren: () =>
      import('./features/life-tracker/life-tracker.routes').then(
        (m) => m.LIFE_TRACKER_ROUTES
      ),
  },
  {
    path: 'youtube-manager',
    data: { navLabel: 'YouTube Video Manager', showInNav: true },
    loadComponent: () =>
      import('./features/youtube-manager/youtube-manager.component').then(
        (m) => m.YouTubeManagerComponent
      ),
  },
  {
    path: 'free-billing',
    data: { navLabel: 'Free Billing System', showInNav: true },
    loadComponent: () =>
      import('./features/free-billing/free-billing.component').then(
        (m) => m.FreeBillingComponent
      ),
  },
  {
    path: 'easy-documents',
    data: { navLabel: 'Easy Documents', showInNav: true },
    loadComponent: () =>
      import('./features/easy-documents/easy-documents.component').then(
        (m) => m.EasyDocumentsComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
