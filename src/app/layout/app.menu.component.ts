import { OnInit } from '@angular/core';
import { Component } from '@angular/core';
import { Organization } from '../models/organization';
import { OrganizationsService } from '../services/organizations.service';

@Component({
  selector: 'app-menu',
  templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit {

  model: any[] = [];

  constructor(private organizationsService: OrganizationsService) {
  }

  async ngOnInit() {
    const currentOrganization: Organization = await this.organizationsService.getCurrentOrganization();
    this.buildMenu(currentOrganization);
    this.organizationsService.onOrganizationChangeSubscribe((organization: Organization) => {
      this.buildMenu(organization);
    });
  }

  private buildMenu(organization: Organization) {
    this.model = [
      {
        label: 'Начало',
        items: [
          {label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/']}
        ]
      },
      {
        label: 'Извънредни часове',
        items: [
          {label: 'Calendar', icon: 'pi pi-fw pi-calendar', routerLink: ['/calendar']},
          {label: 'Enter new', icon: 'pi pi-fw pi-check-square', routerLink: ['/new-event']},
        ]
      },
    ];
    if (organization && organization.myRole === 'admin') {
      this.model.push({
        label: 'Потребители',
        items: [
          {label: 'Активни', icon: 'pi pi-users', routerLink: ['/users']},
          {label: 'Поканени', icon: 'pi pi-user-plus', routerLink: ['/invites']},
        ]
      });
    }
  }
}
