import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { InvitationsService } from '../services/invitations.service';
import { Invitation } from '../models/invitation';
import { AppComponent } from '../app.component';
import { validateAllFormFields } from '../shared/helpers';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-invitations',
  templateUrl: './invitations.component.html',
  styleUrls: ['./invitations.component.scss']
})
export class InvitationsComponent {
  invitations: Invitation[] = [];
  roles: any[] = [{name: 'потребител', value: 'user'}, {name: 'администратор', value: 'admin'}];
  newInvitationForm = new FormGroup({
    'email': new FormControl('', [Validators.required, Validators.email]),
    'role': new FormControl('', [Validators.required]),
  });

  constructor(private invitationsService: InvitationsService, private messageService: MessageService) {
    this.getInvitations();
  }

  private getInvitations() {
    this.invitationsService.getInvitations().then((invitations: any) => this.invitations = invitations);
  }

  async deleteInvitation(invitation: Invitation) {
    AppComponent.toggleProgressBar();
    await this.invitationsService.deleteInvitation(invitation.key);
    this.messageService.add({
      severity: 'success',
      summary: 'Покана',
      detail: 'Поканата беше успешно изтрита!',
      key: 'app-toast'
    });
    this.getInvitations();
    AppComponent.toggleProgressBar();
  }

  async newInvitation() {
    if (this.newInvitationForm.invalid) {
      validateAllFormFields(this.newInvitationForm);
      return;
    }
    AppComponent.toggleProgressBar();
    const role: any = this.newInvitationForm.get('role')!.value!;
    const response = await this.invitationsService.addInvitation(this.newInvitationForm.get('email')!.value!, role.value);
    if (response.success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Покана',
        detail: 'Поканата беше успешно изпратена!',
        key: 'app-toast'
      });
      this.getInvitations();
    } else if (response.error === 'invite_exists') {
      this.messageService.add({
        severity: 'error',
        summary: 'Покана',
        detail: 'Вече има покана на посочения имейл!',
        key: 'app-toast'
      });
    }
    AppComponent.toggleProgressBar();
  }
}
