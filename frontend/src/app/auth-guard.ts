import { UsersService } from './users.service';
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const service = inject(UsersService);

  return service.autoLogin();
};