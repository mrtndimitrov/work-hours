import { Component } from '@angular/core';
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {Router} from "@angular/router";
import {validateAllFormFields} from "../shared/helpers";
import {AppComponent} from "../app.component";
import {UsersService} from "../services/users.service";
import {MessageService} from "primeng/api";

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent {
  isUsers: boolean = true;
  roles: any[] = [{name: 'потребител', value: 'user'}, {name: 'администратор', value: 'admin'}];
  usersForm = new FormGroup({
    'defaultOrganization': new FormControl('', Validators.required)
  });
  newInvitationForm = new FormGroup({
    'email': new FormControl('', [Validators.required, Validators.email]),
    'role': new FormControl('', [Validators.required]),
  });
  users: any[] = [];

  constructor(private router: Router, private usersService: UsersService, private messageService: MessageService) {
    if (this.router.url.indexOf('users') !== -1) {
      this.usersService.getUsers().then((invites: any) => this.users = invites);
      this.isUsers = true;
    } else if (this.router.url.indexOf('invites') !== -1) {
      this.usersService.getInvites().then((invites: any) => this.users = invites);
      this.isUsers = false;
    }
  }

  async delete(user: any, mode: string) {
    AppComponent.toggleProgressBar();
    if (mode === 'invite') {
      await this.usersService.deleteInvite(user.key);
      this.messageService.add({
        severity: 'success',
        summary: 'Покана',
        detail: 'Поканата беше успешно изтрита!',
        key: 'app-toast'
      });
      this.usersService.getInvites(true).then((invites: any) => this.users = invites);
    }
    AppComponent.toggleProgressBar();
  }

  async newInvitation() {
    if (this.newInvitationForm.invalid) {
      validateAllFormFields(this.newInvitationForm);
      return;
    }
    AppComponent.toggleProgressBar();
    const role: any = this.newInvitationForm.get('role')!.value!;
    const response = await this.usersService.addInvite(this.newInvitationForm.get('email')!.value!, role.value);
    if (response.success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Покана',
        detail: 'Поканата беше успешно изпратена!',
        key: 'app-toast'
      });
      this.usersService.getInvites(true).then((invites: any) => this.users = invites);
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
