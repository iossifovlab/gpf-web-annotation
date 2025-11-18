import { UsersService } from './users.service';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const service = inject(UsersService);
  const router = inject(Router);

  service.autoLogin().subscribe(isLoggedIn => {
    if (!isLoggedIn) {
      router.navigate(['/']);
    }
  });
  return service.autoLogin();
};