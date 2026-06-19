import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CommonModule],
  template: `
    <app-navbar *ngIf="!isFullScreen" />
    <main class="main-content" [class.full-screen]="isFullScreen">
      <router-outlet />
    </main>
  `,
  styles: [`
    .main-content {
      padding-top: 5rem;
      min-height: 100vh;
    }
    .main-content.full-screen {
      padding-top: 0;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    @media (max-width: 768px) {
      .main-content:not(.full-screen) {
        padding-top: 6rem;
      }
    }
  `],
})
export class App {
  isFullScreen = false;
  router = inject(Router);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isFullScreen = event.urlAfterRedirects.includes('/free-billing');
    });
  }
}
