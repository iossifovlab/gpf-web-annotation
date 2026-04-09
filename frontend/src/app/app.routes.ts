import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';
import { AnnotationJobsWrapperComponent } from './annotation-jobs-wrapper/annotation-jobs-wrapper.component';
import { AboutPageComponent } from './about-page/about-page.component';

export const routes: Routes = [
  { path: '', component: AnnotationJobsWrapperComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegistrationComponent },
  { path: 'about', component: AboutPageComponent },
];
