import { Routes } from '@angular/router';

export const REAL_LIFE_STEPS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'game',
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./real-life-steps.component').then((m) => m.RealLifeStepsComponent),
  },
  {
    path: 'custom-board-creator',
    loadComponent: () =>
      import('./custom-board-creator/custom-board-creator.component').then(
        (m) => m.CustomBoardCreatorComponent
      ),
  },
];

