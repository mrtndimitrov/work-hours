import { Injectable } from '@angular/core';
import { AngularFireDatabase } from "@angular/fire/compat/database";
import { child, equalTo, get, getDatabase, orderByChild, push, query, ref, remove, update } from "@angular/fire/database";
import { Organization } from "../models/organization";
import { OrganizationsService } from "./organizations.service";

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  constructor(private db: AngularFireDatabase, private organizationsService: OrganizationsService) { }

  async getInvites(refresh: boolean = false) {
    const organization: Organization = await this.organizationsService.getCurrentOrganization(refresh);
    return organization.invites;
  }

  async getUsers(refresh: boolean = false) {
    const organization: Organization = await this.organizationsService.getCurrentOrganization(refresh);
    const dbRef = ref(getDatabase());
    const snapshot = await get(query(child(dbRef, 'users'), orderByChild('name'), equalTo(organization.key)));
    console.log(snapshot.val())
    return organization.invites;
  }

  async addInvite(email: string, role: string) {
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    for (const invite of organization.invites) {
      if (invite.email === email) {
        return {error: 'invite_exists'};
      }
    }
    const db = getDatabase();
    const newKey = push(child(ref(db), `organizations/${organization.key}/invites`)).key;
    const updates: any = {};
    updates[`organizations/${organization.key}/invites/${newKey}`] = {email, role};
    await update(ref(db), updates);
    return {success: newKey};
  }

  async deleteInvite(key: string) {
    const db = getDatabase();
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    await remove(ref(db, `organizations/${organization.key}/invites/${key}`));
    return {success: true};
  }
}
