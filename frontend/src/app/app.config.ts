import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withDebugTracing } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { UsersService } from './users.service';
import { JobsService } from './job-creation/jobs.service';
import { SingleAnnotationService } from './single-annotation.service';
import { provideMarkdown } from 'ngx-markdown';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withDebugTracing()),
    provideHttpClient(),
    UsersService,
    JobsService,
    SingleAnnotationService,
    provideMarkdown(),
  ]
};
