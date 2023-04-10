import { Component, OnInit } from '@angular/core';
import { OrganizationsService } from '../services/organizations.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { validateAllFormFields } from '../shared/helpers';
import { Organization } from '../models/organization';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit{
  newForm = new FormGroup({
    'key': new FormControl('', Validators.required),
    'name': new FormControl('', Validators.required)
  });
  organizationsForm = new FormGroup({
    'defaultOrganization': new FormControl('', Validators.required)
  });
  organizations: Array<Organization> = [];

  constructor(private organizationsService: OrganizationsService,
              private messageService: MessageService,
              private confirmationService: ConfirmationService) {
  }

  async ngOnInit() {
    this.organizations = await this.organizationsService.listMyOrganizations();
    for (const organization of this.organizations) {
      if (organization.isDefault) {
        this.organizationsForm.get('defaultOrganization')?.setValue(organization.key);
        break;
      }
    }
  }

  async newOrganization() {
    if (this.newForm.invalid) {
      validateAllFormFields(this.newForm);
      return;
    }
    const {key, name} = this.newForm.value;
    await this.organizationsService.addOrganization({key: key!, name: name!});
    this.newForm.get('key')?.setValue('');
    this.newForm.get('name')?.setValue('');
  }

  async changeDefaultOrganization() {
    await this.organizationsService.setDefaultOrganization(this.organizationsForm.get('defaultOrganization')?.value!);
    this.messageService.add({
      severity: 'success',
      summary: 'Организация по подразбиране',
      detail: 'Успешно сменена организация по подразбиране',
      key: 'app-toast'
    });
  }

  deleteOrganization(organization: Organization) {
    if (organization.myRole === 'admin') {
      this.confirmationService.confirm({
        header: 'Изтриване на организация',
        message: 'Наистина ли искате да изтриете цялата организация с всични нейни потребители и събития?',
        key: 'app-confirm',
        accept: () => {
          //Actual logic to perform a confirmation
        }
      });
    } else {
      this.confirmationService.confirm({
        header: 'Напускане на организация',
        message: 'Ще бъдете премахнат като член на тази организация и всички Ваши събития ще бъдат изтрити. Продължи?',
        key: 'app-confirm',
        accept: () => {
          //Actual logic to perform a confirmation
        }
      });
    }
  }
}
