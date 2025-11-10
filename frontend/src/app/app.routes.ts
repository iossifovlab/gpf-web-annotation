import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';
import { authGuard } from './auth-guard';
import { SingleAnnotationReportComponent } from './single-annotation-report/single-annotation-report.component';
import { SingleAnnotationComponent } from './single-annotation/single-annotation.component';
import { AnnotationWrapperComponent } from './annotation-wrapper/annotation-wrapper.component';

export const routes: Routes = [
  { path: '', redirectTo: 'single-annotation', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegistrationComponent },
  { path: 'jobs', component: AnnotationWrapperComponent, canActivate: [authGuard] },
  {
    path: 'single-annotation',
    children: [
      {
        path: '',
        component: SingleAnnotationComponent
      },
      {
        path: 'report',
        component: SingleAnnotationReportComponent
      },
    ]
  },
];
