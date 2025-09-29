import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';
import { HomeComponent } from './home/home.component';
import { authGuard } from './auth-guard';
import { SingleAnnotationReportComponent } from './single-annotation-report/single-annotation-report.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegistrationComponent },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  {
    path: 'single-annotation',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: HomeComponent
      },
      {
        path: 'report',
        component: SingleAnnotationReportComponent
      },
    ]
  },
];
