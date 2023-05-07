import {Component, OnInit} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { OrganizationsService } from '../services/organizations.service';
import { Organization } from '../models/organization';
import {monthYearToText, validateAllFormFields} from '../shared/helpers';
import { AppComponent } from '../app.component';
import { ConfirmationService, MessageService } from 'primeng/api';
import { environment } from '../../environments/environment';
import {UsersService} from "../services/users.service";
import {EventsService} from "../services/events.service";
import {User} from "../models/user";

@Component({
  selector: 'app-organization-report',
  templateUrl: './organization-report.component.html',
  styleUrls: ['./organization-report.component.scss']
})
export class OrganizationReportComponent implements OnInit {
  googleSpreadsheetForm = new FormGroup({
    'spreadsheetId': new FormControl('', Validators.required)
  });
  organization: Organization | null = null;
  months: any[] = [];
  selectedMonth: string = '';
  usersGroupedEvents: any[] = [];

  constructor(private organizationsService: OrganizationsService, private messageService: MessageService,
              private confirmationService: ConfirmationService, private usersService: UsersService, private eventsService: EventsService) {
  }

  async ngOnInit() {
    this.organization = await this.organizationsService.getCurrentOrganization();
    this.googleSpreadsheetForm.get('spreadsheetId')?.setValue(this.organization.spreadsheetId ? this.organization.spreadsheetId : null);
    const users: User[] = await this.usersService.getUsers(this.organization.key);
    for (const user of users) {
      const data: any = await this.eventsService.getEventsPerMonths(user.uid);
      this.usersGroupedEvents.push({user, grouped_events: data});
      const monthKeys = Object.keys(data);
      if (monthKeys.length > 0) {
        for (const monthKey of monthKeys) {
          let found = false;
          for (const m of this.months) {
            if (m.key === monthKey) {
              found = true;
              break;
            }
          }
          if (!found) {
            this.months.push({key: monthKey, value: monthYearToText(monthKey), date: new Date(monthKey)});
          }
        }
      }
    }
    this.months.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
    this.selectedMonth = this.months[0].key;
  }

  changeGoogleSheet() {
    if (this.googleSpreadsheetForm.invalid) {
      validateAllFormFields(this.googleSpreadsheetForm);
      return;
    }
    const { spreadsheetId } = this.googleSpreadsheetForm.value;
    this.confirmationService.confirm({
      header: 'Промяна на Google Sheet Id',
      message: `Моля първо добавете WorkHours ${environment.serviceEmail} service-а към редакторите на Google Sheet-a`,
      key: 'app-confirm',
      accept: async () => {
        AppComponent.toggleProgressBar();
        const response: any = await this.organizationsService.setSpreadsheetId(spreadsheetId!);
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Промяна на Google Sheet Id',
            detail: 'Успешно е променено Google Sheet Id на организацията!',
            key: 'app-toast'
          });
        } else if (response.error === 'not_authorized') {
          this.googleSpreadsheetForm.get('spreadsheetId')?.setValue('');
          this.messageService.add({
            severity: 'error',
            summary: 'Промяна на Google Sheet Id',
            detail: 'Нямате достъп до дадения Google Sheet!',
            key: 'app-toast'
          });
        } else {
          this.googleSpreadsheetForm.get('spreadsheetId')?.setValue('');
          this.messageService.add({
            severity: 'error',
            summary: 'Промяна на Google Sheet Id',
            detail: 'Възникна грешка. Опитайте пак по-късно.',
            key: 'app-toast'
          });
        }
        AppComponent.toggleProgressBar();
      },
      reject: () => {
        this.googleSpreadsheetForm.get('spreadsheetId')?.setValue('');
      }
    });
  }

  async createReport() {
    AppComponent.toggleProgressBar();
    await this.eventsService.reportEvents(this.selectedMonth);
    this.messageService.add({
      severity: 'success',
      summary: 'Отчет в Google Sheet',
      detail: 'Заявката за изготвяне на отчет е подадена!',
      key: 'app-toast'
    });
    AppComponent.toggleProgressBar();
  }
}
