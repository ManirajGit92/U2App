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
    path: 'content-video',
    loadComponent: () =>
      import('./features/content-video/content-video.component').then(
        (m) => m.ContentVideoComponent
      ),
  },
  {
    path: 'html-viewer',
    loadComponent: () =>
      import('./features/html-viewer/html-viewer.component').then(
        (m) => m.HtmlViewerComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
