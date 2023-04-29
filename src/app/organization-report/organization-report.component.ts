import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { OrganizationsService } from '../services/organizations.service';
import { Organization } from '../models/organization';
import { validateAllFormFields } from '../shared/helpers';
import { AppComponent } from '../app.component';
import { MessageService } from 'primeng/api';

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

  constructor(private organizationsService: OrganizationsService, private messageService: MessageService) {
    this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
      this.organization = organization;
      this.googleSheetForm.get('sheetId')?.setValue(organization.sheetId ? organization.sheetId : null);
    });
  }

  async changeGoogleSheet() {
    if (this.googleSheetForm.invalid) {
      validateAllFormFields(this.googleSheetForm);
      return;
    }
    AppComponent.toggleProgressBar();
    const {sheetId} = this.googleSheetForm.value;
    await this.organizationsService.setSheetId(sheetId!);
    this.messageService.add({
      severity: 'success',
      summary: 'Промяна на Google Sheet Id',
      detail: 'Успешно е променено Google Sheet Id на организацията!',
      key: 'app-toast'
    });
    AppComponent.toggleProgressBar();
  }
}
