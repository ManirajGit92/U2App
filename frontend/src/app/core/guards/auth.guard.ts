import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FirebaseAuthService } from '../services/firebase-auth.service';

/**
 * Route guard that redirects unauthenticated users to /login.
 * Used only for routes that strictly require authentication
 * (e.g., /profile).
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(FirebaseAuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
