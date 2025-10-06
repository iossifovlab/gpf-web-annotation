import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';
import { JobsTableComponent } from './jobs-table/jobs-table.component';
import { authGuard } from './auth-guard';
import { SingleAnnotationReportComponent } from './single-annotation-report/single-annotation-report.component';
import { SingleAnnotationComponent } from './single-annotation/single-annotation.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegistrationComponent },
  { path: 'home', component: JobsTableComponent, canActivate: [authGuard] },
  {
    path: 'single-annotation',
    canActivate: [authGuard],
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
