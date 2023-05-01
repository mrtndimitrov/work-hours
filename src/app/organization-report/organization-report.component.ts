import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { OrganizationsService } from '../services/organizations.service';
import { Organization } from '../models/organization';
import { validateAllFormFields } from '../shared/helpers';
import { AppComponent } from '../app.component';
import { ConfirmationService, MessageService } from 'primeng/api';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-organization-report',
  templateUrl: './organization-report.component.html',
  styleUrls: ['./organization-report.component.scss']
})
export class OrganizationReportComponent {
  googleSheetForm = new FormGroup({
    'sheetId': new FormControl('', Validators.required)
  });
  organization: Organization | null = null;

  constructor(private organizationsService: OrganizationsService, private messageService: MessageService,
              private confirmationService: ConfirmationService) {
    this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
      this.organization = organization;
      this.googleSheetForm.get('sheetId')?.setValue(organization.sheetId ? organization.sheetId : null);
    });
  }

  changeGoogleSheet() {
    if (this.googleSheetForm.invalid) {
      validateAllFormFields(this.googleSheetForm);
      return;
    }
    AppComponent.toggleProgressBar();
    const {sheetId} = this.googleSheetForm.value;
    this.confirmationService.confirm({
      header: 'Промяна на Google Sheet Id',
      message: `Моля първо добавете WorkHours ${environment.serviceEmail} service-а към редакторите на Google Sheet-a`,
      key: 'app-confirm',
      accept: async () => {
        AppComponent.toggleProgressBar();
        const response: any = await this.organizationsService.setSheetId(sheetId!);
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Промяна на Google Sheet Id',
            detail: 'Успешно е променено Google Sheet Id на организацията!',
            key: 'app-toast'
          });
        } else if (response.error === 'not_authorized') {
          this.googleSheetForm.get('sheetId')?.setValue('');
          this.messageService.add({
            severity: 'error',
            summary: 'Промяна на Google Sheet Id',
            detail: 'Нямате достъп до дадения Google Sheet!',
            key: 'app-toast'
          });
        } else {
          this.googleSheetForm.get('sheetId')?.setValue('');
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
        this.googleSheetForm.get('sheetId')?.setValue('');
      }
    });
  }
}
