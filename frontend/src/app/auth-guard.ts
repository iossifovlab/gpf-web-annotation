import { UsersService } from './users.service';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const service = inject(UsersService);

  if (service.userData.value) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};