import { EventEmitter, Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { child, get, getDatabase, ref, set } from '@angular/fire/database';
import { MessageService } from 'primeng/api';
import { AuthenticationService } from './authentication.service';
import { Organization } from '../models/organization';

@Injectable({
  providedIn: 'root'
})
export class OrganizationsService {
  currentOrganization: Organization | null = null;
  onOrganizationChange = new EventEmitter<Organization>();

  constructor(private db: AngularFireDatabase, private messageService: MessageService,
              private authService: AuthenticationService) {}

  async listMyOrganizations() {
    const user = await this.authService.getCurrentUser();
    const dbRef = ref(getDatabase());
    const snapshot = await get(child(dbRef, `users/${user!.uid}`));
    if (snapshot.exists()) {
      const organizations: Array<Organization> = [];
      for (const item of Object.entries(snapshot.val())) {
        const [key, value]: [string, any] = item;
        const organization: Organization = await this.getOrganization(key);
        organization.myRole = value.role;
        organization.isDefault = value.default;
        organization.invites = organization.invites ? Object.entries(organization.invites).map(([k, v]) => { return {key: k, ...v}}) : [];
        organization.users = organization.users ? Object.entries(organization.users).map(([k, v]) => { return {key: k, ...v}}) : [];
        organizations.push(organization);
      }
      return organizations;
    }
    return [];
  }

  private async getOrganization(key: string) {
    const dbRef = ref(getDatabase());
    const snapshot = await get(child(dbRef, `organizations/${key}`));
    return {key, ...snapshot.val()};
  }

  async addOrganization(organization: Organization) {
    try {
      const db = getDatabase();
      // check first if organization with such key exists
      const organizationKeys: Array<string> = await this.getOrganizationKeys();
      for (const key of organizationKeys) {
        if (key === organization.key) {
          this.messageService.add({
            severity: 'error',
            summary: 'Създаване на организация',
            detail: 'Вече има организация с този ключ!',
            key: 'app-toast'
          });
          return false;
        }
      }
      const user = await this.authService.getCurrentUser();
      await set(ref(db, `organizations/${organization.key}`), {name: organization.name});
      await set(ref(db, `users/${user!.uid}/${organization.key}`), {role: 'admin', default: 'false'});
      await this.setDefaultOrganization(organization.key);

      this.messageService.add({
        severity: 'success',
        summary: 'Създаване на организация',
        detail: 'Успешно създаване на организация',
        key: 'app-toast'
      });
      return true;
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: 'Създаване на организация',
        detail: 'Неуспешно създаване на организация',
        key: 'app-toast'
      });
      return false;
    }
  }

  private async getOrganizationKeys() {
    const dbRef = ref(getDatabase());
    const snapshot = await get(child(dbRef, 'organizations'));
    if (snapshot.exists()) {
      const organizationKeys: Array<string> = [];
      for (const item of Object.entries(snapshot.val())) {
        const [key, _value]: [string, any] = item;
        organizationKeys.push(key);
      }
      return organizationKeys;
    } else {
      return [];
    }
  }

  async setDefaultOrganization(key: string) {
    const dbRef = ref(getDatabase());
    const user = await this.authService.getCurrentUser();
    const organizations = await this.listMyOrganizations();
    for (const organization of organizations) {
      await set(child(dbRef, `users/${user!.uid}/${organization.key}/default`), organization.key === key);
    }
  }

  async getCurrentOrganization(refresh: boolean = false): Promise<Organization> {
    if (!this.currentOrganization || refresh) {
      const organizations: Organization[] = await this.listMyOrganizations();
      for (const organization of organizations) {
        if (organization.isDefault) {
          this.currentOrganization = organization;
          break;
        }
      }
    }
    return this.currentOrganization!;
  }

  setCurrentOrganization(organization: Organization) {
    this.currentOrganization = organization;
    this.onOrganizationChange.emit(organization);
  }

  onOrganizationChangeSubscribe(callback: Function) {
    this.onOrganizationChange.subscribe(callback);
  }
}
