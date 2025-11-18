import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';
import { authGuard } from './auth-guard';
import { AnnotationWrapperComponent } from './annotation-wrapper/annotation-wrapper.component';

export const routes: Routes = [
  { path: '', component: AnnotationWrapperComponent, canActivate: [authGuard], pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegistrationComponent },
];
