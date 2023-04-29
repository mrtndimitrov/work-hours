import { Injectable } from '@angular/core';
import {
  child,
  equalTo,
  get,
  getDatabase,
  orderByChild,
  push,
  query,
  ref,
  remove, set
} from '@angular/fire/database';
import { Invitation } from '../models/invitation';
import { OrganizationsService } from './organizations.service';
import { Organization } from '../models/organization';
import { User } from '../models/user';
import { em } from '@fullcalendar/core/internal-common';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root'
})
export class InvitationsService {

  constructor(private organizationsService: OrganizationsService, private usersService: UsersService) { }

  async getInvitations(organizationKey: string | null = null) {
    if (!organizationKey) {
      const currentOrganization: Organization = await this.organizationsService.getCurrentOrganization(true);
      organizationKey = currentOrganization.key;
    }
    const invitations: Invitation[] = [];
    const dbRef = ref(getDatabase());
    const snapshot = await get(query(child(dbRef, 'invitations'), orderByChild('organization'), equalTo(organizationKey)));
    if (snapshot.exists()) {
      for (const item of Object.entries(snapshot.val())) {
        const [key, value]: [string, any] = item;
        invitations.push({key, ...value});
      }
    }
    return invitations;
  }

  async addInvitation(email: string, role: string) {
    const invitations: Invitation[] = await this.getInvitations();
    for (const invite of invitations) {
      if (invite.email === email) {
        return {error: 'invite_exists'};
      }
    }
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const db = getDatabase();
    const newKey = push(child(ref(db), `invitations`)).key;
    await set(ref(db, `invitations/${newKey}`), {email, role, organization: organization.key});
    return {success: newKey};
  }

  async deleteInvitation(key: string) {
    const db = getDatabase();
    await remove(ref(db, `invitations/${key}`));
    return {success: true};
  }

  async getUserInvitations(email: string | null = null) {
    if (!email) {
      const user: User = await this.usersService.getCurrentUser();
      email = user.email;
    }
    const dbRef = ref(getDatabase());
    const snapshot = await get(query(child(dbRef, 'invitations'), orderByChild('email'), equalTo(email)));
    const invitations: Invitation[] = [];
    if (snapshot.exists()) {
      for (const item of Object.entries(snapshot.val())) {
        const [key, value]: [string, any] = item;
        invitations.push({key, ...value});
      }
    }
    return invitations;
  }
}
