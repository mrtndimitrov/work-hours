import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppLayoutModule } from './layout/app.layout.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CalendarComponent } from './calendar/calendar.component';
import { EventComponent } from './event/event.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PanelModule } from 'primeng/panel';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressBarModule } from 'primeng/progressbar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { initializeApp,provideFirebaseApp } from '@angular/fire/app';
import { environment } from '../environments/environment';
import { provideAnalytics,getAnalytics,ScreenTrackingService,UserTrackingService } from '@angular/fire/analytics';
import { provideAuth,getAuth } from '@angular/fire/auth';
import { provideDatabase,getDatabase } from '@angular/fire/database';
import { provideFirestore,getFirestore } from '@angular/fire/firestore';
import { provideFunctions,getFunctions } from '@angular/fire/functions';
import { provideMessaging,getMessaging } from '@angular/fire/messaging';
import { providePerformance,getPerformance } from '@angular/fire/performance';
import { provideRemoteConfig,getRemoteConfig } from '@angular/fire/remote-config';
import { provideStorage,getStorage } from '@angular/fire/storage';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { ConfirmationService, MessageService } from 'primeng/api';
import { LoginComponent } from './login/login.component';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { AuthGuard } from './guards/auth.guard';
import { SettingsComponent } from './settings/settings.component';
import { TableModule } from 'primeng/table';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { UsersComponent } from './users/users.component';
import { InvitationsComponent } from './invitations/invitations.component';
import { HolidaysComponent } from './holidays/holidays.component';
import { UserReportComponent } from './user-report/user-report.component';
import { ChartModule } from 'primeng/chart';
import { OrganizationReportComponent } from './organization-report/organization-report.component';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { VacationDaysComponent } from './vacation-days/vacation-days.component';
import { IllnessDaysComponent } from './illness-days/illness-days.component';


@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    CalendarComponent,
    EventComponent,
    LoginComponent,
    SettingsComponent,
    UsersComponent,
    InvitationsComponent,
    HolidaysComponent,
    UserReportComponent,
    OrganizationReportComponent,
    VacationDaysComponent,
    IllnessDaysComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AppLayoutModule,
    FullCalendarModule,
    InputTextareaModule,
    PanelModule,
    InputNumberModule,
    CalendarModule,
    ButtonModule,
    MenuModule,
    ToastModule,
    CheckboxModule,
    ProgressBarModule,
    TableModule,
    ReactiveFormsModule,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAnalytics(() => getAnalytics()),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions()),
    provideMessaging(() => getMessaging()),
    providePerformance(() => getPerformance()),
    provideRemoteConfig(() => getRemoteConfig()),
    provideStorage(() => getStorage()),
    InputTextModule,
    RippleModule,
    RadioButtonModule,
    ConfirmDialogModule,
    DropdownModule,
    FormsModule,
    ChartModule,
    AutoCompleteModule
  ],
  providers: [
    ScreenTrackingService,
    UserTrackingService,
    {provide: FIREBASE_OPTIONS, useValue: environment.firebase},
    MessageService,
    AuthGuard,
    ConfirmationService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
