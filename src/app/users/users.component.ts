import { Component } from '@angular/core';
import { UsersService } from "../services/users.service";
import { ConfirmationService, MessageService } from "primeng/api";
import { OrganizationsService } from '../services/organizations.service';
import { Organization } from '../models/organization';
import { User } from '../models/user';
import { AppComponent } from '../app.component';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent {
  users: User[] = [];
  currentUser: User | null = null;
  roles: any[] = [{name: 'потребител', value: 'user'}, {name: 'администратор', value: 'admin'}];

  constructor(private usersService: UsersService, private messageService: MessageService,
              private organizationsService: OrganizationsService, private confirmationService: ConfirmationService) {
    this.usersService.getCurrentUser().then((user: User) => {
      this.currentUser = user;
      this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
        this.usersService.getUsers(organization.key).then((users: any) => {
          this.users = users;
        });
      });
    });
  }

  deleteUser(user: any) {
    this.confirmationService.confirm({
      header: 'Изтриване на потребител',
      message: 'Наистина ли искате да изтриете потребителя? Така няма да има достъп до организацията и всички негови събития ще бъдат изтрити.',
      key: 'app-confirm',
      accept: async () => {
        AppComponent.toggleProgressBar();
        await this.organizationsService.deleteUserFromOrganization(user.organization, user.uid);
        this.messageService.add({
          severity: 'success',
          summary: 'Потребител',
          detail: 'Потребителят беше успешно изтрит!',
          key: 'app-toast'
        });
        AppComponent.toggleProgressBar();
      }
    });
  }

  async changeRole(user: User) {
    AppComponent.toggleProgressBar();
    await this.organizationsService.setUserRole(user.uid, user.organization, user.role);
    this.messageService.add({
      severity: 'success',
      summary: 'Потребител',
      detail: 'Ролята на потребителя беше успешно променена!',
      key: 'app-toast'
    });
    AppComponent.toggleProgressBar();
  }
}
