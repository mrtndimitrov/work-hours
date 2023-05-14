import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app.layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CalendarComponent } from './calendar/calendar.component';
import { EventComponent } from './event/event.component';
import { LoginComponent } from './login/login.component';
import { AuthGuard } from './guards/auth.guard';
import { SettingsComponent } from './settings/settings.component';
import { UsersComponent } from "./users/users.component";
import { InvitationsComponent } from './invitations/invitations.component';
import { HolidaysComponent } from './holidays/holidays.component';
import { UserReportComponent } from './user-report/user-report.component';
import { OrganizationReportComponent } from './organization-report/organization-report.component';

const routes: Routes = [
  {
    path: '', component: AppLayoutComponent, canActivate: [AuthGuard], children: [
      {path: '', component: DashboardComponent},
      {path: 'settings', component: SettingsComponent},
      {path: 'calendar', component: CalendarComponent},
      {path: 'new-event', component: EventComponent},
      {path: 'user-report', component: UserReportComponent},
      {path: 'event/:eventId', component: EventComponent},
      {path: 'users', component: UsersComponent},
      {path: 'invitations', component: InvitationsComponent},
      {path: 'holidays', component: HolidaysComponent},
      {path: 'organization-report', component: OrganizationReportComponent}]
  },
  {path: 'login', component: LoginComponent},
  {path: 'register', component: LoginComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {onSameUrlNavigation: 'reload'})],
  exports: [RouterModule]
})
export class AppRoutingModule {}
