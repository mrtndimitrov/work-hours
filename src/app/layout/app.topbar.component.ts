import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { LayoutService } from "./service/app.layout.service";
import { AuthenticationService } from '../services/authentication.service';
import { Router } from '@angular/router';
import { OrganizationsService } from '../services/organizations.service';
import { Organization } from '../models/organization';
import { UsersService } from '../services/users.service';

@Component({
  selector: 'app-topbar',
  templateUrl: './app.topbar.component.html'
})
export class AppTopBarComponent implements OnInit {

  items!: MenuItem[];
  organizations: Array<Organization> = [];
  selectedOrganization: Organization | null = null;

  @ViewChild('menubutton') menuButton!: ElementRef;

  @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;

  @ViewChild('topbarmenu') menu!: ElementRef;

  constructor(public layoutService: LayoutService, private router: Router,
              private authService: AuthenticationService, public organizationsService: OrganizationsService) {
  }

  async ngOnInit() {
    this.organizations = await this.organizationsService.listMyOrganizations();
    this.selectedOrganization = await this.organizationsService.getCurrentOrganization();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['login']);
  }
}
