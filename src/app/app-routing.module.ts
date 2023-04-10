import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app.layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CalendarComponent } from './calendar/calendar.component';
import { EventComponent } from './event/event.component';
import { LoginComponent } from './login/login.component';
import { AuthGuard } from './guards/auth.guard';
import { SettingsComponent } from './settings/settings.component';

const routes: Routes = [
  {
    path: '', component: AppLayoutComponent, canActivate: [AuthGuard], children: [
      {path: '', component: DashboardComponent},
      {path: 'settings', component: SettingsComponent},
      {path: 'calendar', component: CalendarComponent},
      {path: 'new-event', component: EventComponent},
      {path: 'event/:eventId', component: EventComponent}]
  },
  {path: 'login', component: LoginComponent},
  {path: 'register', component: LoginComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
