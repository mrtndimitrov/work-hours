import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList, AngularFireObject } from '@angular/fire/compat/database';
import { Event } from '../models/event'
import { map } from 'rxjs/operators';
import { Organization } from '../models/organization';
import { OrganizationsService } from './organizations.service';
import { child, get, getDatabase, push, ref, remove, update } from '@angular/fire/database';
import { AuthenticationService } from './authentication.service';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  constructor(private db: AngularFireDatabase, private organizationsService: OrganizationsService,
              private authenticationService: AuthenticationService) {}

  async listEvents() {
    const dbRef = ref(getDatabase());
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const user = await this.authenticationService.getCurrentUser();
    const snapshot = await get(child(dbRef, `events/${organization.key}/${user!.uid}`));
    if (snapshot.exists()) {
      const events: Array<Event> = [];
      for (const item of Object.entries(snapshot.val())) {
        const [key, value]: [string, any] = item;
        const event: Event = value as Event;
        event.date = new Date(event.date);
        event.title = this.constructTitle(event);
        event.id = key;
        events.push(event);
      }
      return events;
    } else {
      return [];
    }
  }

  async addEvent(event: Event) {
    const month = event.date.getUTCMonth() + 1;
    const day = event.date.getUTCDate();
    const year = event.date.getUTCFullYear();

    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const user = await this.authenticationService.getCurrentUser();
    const db = getDatabase();
    // get a key for a new Event.
    const newEventKey = push(child(ref(db), `events/${organization.key}/${user!.uid}`)).key;
    const updates: any = {};
    updates[`events/${organization.key}/${user!.uid}/${newEventKey}`] = {
      date: `${year}-${month}-${day}`,
      hours: event.hours,
      workDone: event.workDone,
      reason: event.reason
    };
    await update(ref(db), updates);
    return newEventKey;
  }

  async updateEvent(event: Event) {
    const month = event.date.getUTCMonth() + 1;
    const day = event.date.getUTCDate();
    const year = event.date.getUTCFullYear();

    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const user = await this.authenticationService.getCurrentUser();
    const db = getDatabase();
    const updates: any = {};
    updates[`events/${organization.key}/${user!.uid}/${event.id}`] = {
      date: `${year}-${month}-${day}`,
      hours: event.hours,
      workDone: event.workDone,
      reason: event.reason
    };
    await update(ref(db), updates);
  }

  async getEvent(id: string) {
    const dbRef = ref(getDatabase());
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const user = await this.authenticationService.getCurrentUser();
    const snapshot = await get(child(dbRef, `events/${organization.key}/${user!.uid}/${id}`));
    const event: Event = snapshot.val();
    if (event) {
      event.id = id;
      event.date = new Date(event.date);
      event.title = `${event.workDone.length > 50 ? `${event.workDone.substring(0, 50)}...` : event.workDone} - ${event.hours} часа`;
    }
    return event;
  }

  async deleteEvent(id: string) {
    const db = getDatabase();
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const user = await this.authenticationService.getCurrentUser();
    remove(ref(db, `events/${organization.key}/${user!.uid}/${id}`));
  }

  constructTitle(event: Event) {
    return `${event.workDone.length > 20 ? `${event.workDone.substring(0, 20)}...` : event.workDone} - ${event.hours} часа`;
  }
}
