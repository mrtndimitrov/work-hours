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
    ];
    if (organization) {
      this.model.push({
        label: 'Извънредни часове',
        items: [
          {label: 'Календар', icon: 'pi pi-fw pi-calendar', routerLink: ['/calendar']},
          {label: 'Въведи нов', icon: 'pi pi-fw pi-check-square', routerLink: ['/new-event']},
          {label: 'Отчет', icon: 'pi pi-fw pi-table', routerLink: ['/user-report']},
          {label: 'Отпуск', icon: 'pi pi-fw pi-table', routerLink: ['/vacation-days']},
          {label: 'Болнични дни', icon: 'pi pi-fw pi-table', routerLink: ['/illness-days']},
        ]
      });
      if (organization.myRole === 'admin') {
        this.model.push({
          label: 'Организация',
          items: [
            {label: 'Потребители', icon: 'pi pi-users', routerLink: ['/users']},
            {label: 'Поканени', icon: 'pi pi-user-plus', routerLink: ['/invitations']},
            {label: 'Почивни дни', icon: 'pi pi-calendar-times', routerLink: ['/holidays']},
            {label: 'Отчет', icon: 'pi pi-fw pi-table', routerLink: ['/organization-report']},
          ]
        });
      }
    }
  }
}
