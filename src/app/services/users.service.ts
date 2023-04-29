import { Injectable } from '@angular/core';
import { AngularFireDatabase } from "@angular/fire/compat/database";
import {
  child,
  equalTo,
  get,
  getDatabase,
  orderByChild,
  query,
  ref,
  set, update,
} from "@angular/fire/database";
import { AuthenticationService } from './authentication.service';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  currentUser: User | null = null;

  constructor(private db: AngularFireDatabase, private authService: AuthenticationService) { }

  async registerUser(key: string, email: string) {
    const db = getDatabase();
    await set(ref(db, `users/${key}`), {email});
  }

  invalidateCurrentUser() {
    this.currentUser = null;
  }

  async getCurrentUser() {
    if (!this.currentUser) {
      const temp = await this.authService.getCurrentUser();
      this.currentUser = await this.getUser(temp.uid);
    }
    return this.currentUser;
  }

  async getUser(uid: string) {
    const dbRef = ref(getDatabase());
    const snapshot = await get(child(dbRef, `users/${uid}`));
    const user: User = snapshot.val();
    if (user) {
      user.uid = uid;
    }
    return user;
  }

  async setUserData(uid: string, data: any) {
    const db = getDatabase();
    const updates: any = {};
    updates[`users/${uid}`] = data;
    await update(ref(db), updates);
  }

  async getUsers(organizationKey: string) {
    const users: User[] = [];
    const dbRef = ref(getDatabase());
    const snapshot = await get(query(child(dbRef, 'users_organizations'), orderByChild('organization'), equalTo(organizationKey)));
    if (snapshot.exists()) {
      for (const item of Object.entries(snapshot.val())) {
        const [key, value]: [string, any] = item;
        const user: User = await this.getUser(value.user);
        user.organization = value.organization;
        user.role = value.role;
        users.push(user);
      }
    }
    return users;
  }
}
