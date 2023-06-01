import { Component, OnInit } from '@angular/core';
import { OrganizationsService } from '../services/organizations.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { validateAllFormFields } from '../shared/helpers';
import { Organization } from '../models/organization';
import { ConfirmationService, MessageService } from 'primeng/api';
import { UsersService } from '../services/users.service';
import { User } from '../models/user';
import { AppComponent } from '../app.component';
import { EventsService } from '../services/events.service';
import { InvitationsService } from '../services/invitations.service';
import { Invitation } from '../models/invitation';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit{
  personalDataForm = new FormGroup({
    'firstName': new FormControl('', Validators.required),
    'lastName': new FormControl('', Validators.required)
  });
  newForm = new FormGroup({
    'key': new FormControl('', Validators.required),
    'name': new FormControl('', Validators.required)
  });
  organizationsForm = new FormGroup({
    'defaultOrganization': new FormControl('', Validators.required)
  });
  organizations: Array<Organization> = [];
  user: User | null = null;
  invitations: Array<Invitation> = [];

  constructor(private organizationsService: OrganizationsService,
              private messageService: MessageService,
              private confirmationService: ConfirmationService,
              private usersService: UsersService,
              private eventsService: EventsService,
              private invitationsService: InvitationsService) {
    this.usersService.getCurrentUser().then((user: User) => {
      this.user = user;
      this.personalDataForm.get('firstName')?.setValue(this.user.firstName);
      this.personalDataForm.get('lastName')?.setValue(this.user.lastName);
    });
  }

  async ngOnInit() {
    await this.setOrganizations();
    await this.getInvitations();
  }

  private async setOrganizations() {
    this.organizations = await this.organizationsService.listMyOrganizations();
    for (const organization of this.organizations) {
      if (organization.isDefault) {
        this.organizationsForm.get('defaultOrganization')?.setValue(organization.key);
        break;
      }
    }
  }

  private async getInvitations() {
    this.invitations = await this.invitationsService.getUserInvitations();
    for (const invitation of this.invitations) {
      invitation.organizationName = await this.organizationsService.getName(invitation.organization);
    }
  }

  async changePersonalData() {
    if (this.personalDataForm.invalid) {
      validateAllFormFields(this.personalDataForm);
      return;
    }
    AppComponent.toggleProgressBar();
    const {firstName, lastName} = this.personalDataForm.value;
    await this.usersService.setUserData(this.user!.uid, {firstName, lastName, email: this.user?.email});
    this.personalDataForm.get('firstName')?.setValue(firstName!);
    this.personalDataForm.get('lastName')?.setValue(lastName!);
    this.messageService.add({
      severity: 'success',
      summary: 'Промяна на личните данни',
      detail: 'Успешно променихте личните си данни!',
      key: 'app-toast'
    });
    AppComponent.toggleProgressBar();
  }

  async newOrganization() {
    if (this.newForm.invalid) {
      validateAllFormFields(this.newForm);
      return;
    }
    AppComponent.toggleProgressBar();
    const {key, name} = this.newForm.value;
    await this.organizationsService.addOrganization({key: key!, name: name!, invitations: [], users: []});
    this.newForm.get('key')?.setValue('');
    this.newForm.get('name')?.setValue('');
    await this.setOrganizations();
    AppComponent.toggleProgressBar();
  }

  async changeDefaultOrganization() {
    AppComponent.toggleProgressBar();
    await this.organizationsService.setDefaultOrganization(this.organizationsForm.get('defaultOrganization')?.value!);
    await this.setOrganizations();
    this.messageService.add({
      severity: 'success',
      summary: 'Организация по подразбиране',
      detail: 'Успешно сменена организация по подразбиране',
      key: 'app-toast'
    });
    AppComponent.toggleProgressBar();
  }

  deleteOrganization(organization: Organization) {
    if (organization.myRole === 'admin') {
      this.confirmationService.confirm({
        header: 'Изтриване на организация',
        message: 'Наистина ли искате да изтриете цялата организация с всични нейни потребители и събития?',
        key: 'app-confirm',
        accept: () => {
          AppComponent.toggleProgressBar();
          // TODO
        }
      });
    } else {
      this.confirmationService.confirm({
        header: 'Напускане на организация',
        message: 'Ще бъдете премахнат като член на тази организация и всички Ваши събития ще бъдат изтрити. Продължи?',
        key: 'app-confirm',
        accept: async () => {
          AppComponent.toggleProgressBar();
          await this.eventsService.deleteEvents(organization.key);
          await this.organizationsService.deleteUserFromOrganization(organization.key);
          this.messageService.add({
            severity: 'success',
            summary: 'Напускане на организация',
            detail: 'Вие успешно напуснахте организацията!',
            key: 'app-toast'
          });
          await this.setOrganizations();
          AppComponent.toggleProgressBar();
        }
      });
    }
  }

  async acceptInvitation(invitation: Invitation) {
    AppComponent.toggleProgressBar();
    await this.organizationsService.addUserToOrganization(invitation.organization, invitation.role);
    await this.setOrganizations();
    await this.invitationsService.deleteInvitation(invitation.key);
    this.messageService.add({
      severity: 'success',
      summary: 'Покана',
      detail: 'Поканата беше успешно приета!',
      key: 'app-toast'
    });
    await this.getInvitations();
    AppComponent.toggleProgressBar();
  }

  deleteInvitation(invitation: Invitation) {
    this.confirmationService.confirm({
      header: 'Изтриване на покана',
      message: 'Наистина ли искате да изтриете поканата? Така няма да може да се присъедините към тази организация.',
      key: 'app-confirm',
      accept: async () => {
        AppComponent.toggleProgressBar();
        await this.invitationsService.deleteInvitation(invitation.key);
        this.messageService.add({
          severity: 'success',
          summary: 'Покана',
          detail: 'Поканата беше успешно изтрита!',
          key: 'app-toast'
        });
        await this.getInvitations();
        AppComponent.toggleProgressBar();
      }
    });
  }
}
