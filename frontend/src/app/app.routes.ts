import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';
import { AnnotationWrapperComponent } from './annotation-wrapper/annotation-wrapper.component';

export const routes: Routes = [
  { path: '', component: AnnotationWrapperComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegistrationComponent },
];
