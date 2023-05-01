import { EventEmitter, Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import {
  child, equalTo,
  get,
  getDatabase, orderByChild, query,
  ref, remove,
  set
} from '@angular/fire/database';
import { MessageService } from 'primeng/api';
import { Organization } from '../models/organization';
import { User } from '../models/user';
import { UsersService } from './users.service';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from '@angular/fire/functions';
import { getApp } from '@angular/fire/app';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrganizationsService {
  currentOrganization: Organization | null = null;
  onOrganizationChange = new EventEmitter<Organization>();
  onMyOrganizationsChange = new EventEmitter<null>();

  constructor(private db: AngularFireDatabase, private messageService: MessageService,
              private usersService: UsersService) {}

  async listMyOrganizations() {
    const user: User = await this.usersService.getCurrentUser();
    const dbRef = ref(getDatabase());
    const snapshot = await get(query(child(dbRef, 'users_organizations'),
      orderByChild('user'), equalTo(user.uid)));
    if (snapshot.exists()) {
      const organizations: Array<Organization> = [];
      const items: any = snapshot.val();
      for (const temp of Object.values(items)) {
        // TODO: how to avoid this
        const item: any = temp;
        const organization: Organization = await this.getOrganization(item.organization);
        organization.myRole = item.role;
        organization.isDefault = item.default;
        organization.holidays = organization.holidays ? JSON.parse(organization.holidays) : {includes: [], excludes: []};
        organization.invitations = [];
        organization.users = [];
        organizations.push(organization);
      }
      return organizations;
    }
    return [];
  }

  async getName(key: string) {
    const dbRef = ref(getDatabase());
    const snapshot = await get(child(dbRef, `organizations/${key}/name`));
    return snapshot.val();
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
      const user: User = await this.usersService.getCurrentUser();
      await set(ref(db, `organizations/${organization.key}`), {name: organization.name});
      await set(ref(db, `users_organizations/${user.uid}_${organization.key}`),
        {user: user!.uid, organization: organization.key, role: 'admin', default: false});
      await this.setDefaultOrganization(organization.key);
      this.onMyOrganizationsChange.emit();

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
      for (const [key, _value] of Object.entries(snapshot.val())) {
        organizationKeys.push(key);
      }
      return organizationKeys;
    } else {
      return [];
    }
  }

  async setDefaultOrganization(key: string) {
    const dbRef = ref(getDatabase());
    const user: User = await this.usersService.getCurrentUser();
    const organizations = await this.listMyOrganizations();
    for (const organization of organizations) {
      await set(child(dbRef, `users_organizations/${user.uid}_${organization.key}/default`), organization.key === key);
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

  invalidateCurrentOrganization() {
    this.currentOrganization = null;
  }

  setCurrentOrganization(organization: Organization) {
    this.currentOrganization = organization;
    this.onOrganizationChange.emit(organization);
  }

  onOrganizationChangeSubscribe(callback: Function) {
    this.onOrganizationChange.subscribe(callback);
  }

  onMyOrganizationsChangeSubscribe(callback: Function) {
    this.onMyOrganizationsChange.subscribe(callback);
  }

  async deleteUserFromOrganization(organizationKey: string, uid: string | null = null) {
    if (!uid) {
      const currentUser: User = await this.usersService.getCurrentUser();
      uid = currentUser.uid;
    }
    const db = getDatabase();
    await remove(ref(db, `users_organizations/${uid}_${organizationKey}`));
    await remove(ref(db, `events/${organizationKey}/${uid}`));
  }

  async addUserToOrganization(organizationKey: string, role: string) {
    const db = getDatabase();
    const user: User = await this.usersService.getCurrentUser();
    await set(ref(db, `users_organizations/${user.uid}_${organizationKey}`),
      {user: user!.uid, organization: organizationKey, role: role, default: false});
    await this.setDefaultOrganization(organizationKey);
    this.onMyOrganizationsChange.emit();
  }

  async setUserRole(uid: string, organizationKey: string, role: string) {
    const db = getDatabase();
    await set(ref(db, `users_organizations/${uid}_${organizationKey}/role`), role);
  }

  async setHolidays(holidays: any) {
    const db = getDatabase();
    const currentOrganization: Organization = await this.getCurrentOrganization();
    currentOrganization.holidays = holidays;
    await set(ref(db, `organizations/${currentOrganization.key}/holidays`), JSON.stringify(holidays));
  }

  async setSheetId(sheetId: string) {
    const db = getDatabase();
    const currentOrganization: Organization = await this.getCurrentOrganization();
    const functions = getFunctions(getApp());
    if (!environment.production) {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
    const authorizeSheet = httpsCallable(functions, 'authorizeSheet');
    return authorizeSheet({
      organization: currentOrganization.key,
      sheetId: sheetId
    }).then(async (result) => {
      currentOrganization.sheetId = sheetId;
      await set(ref(db, `organizations/${currentOrganization.key}/sheetId`), sheetId);
      return result.data;
    })
    .catch((error) => {
      return {error};
    });
  }
}
