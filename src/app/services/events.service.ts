import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Event } from '../models/event'
import { Organization } from '../models/organization';
import { OrganizationsService } from './organizations.service';
import { child, get, getDatabase, push, ref, remove, update } from '@angular/fire/database';
import { User } from '../models/user';
import { UsersService } from './users.service';
import { environment } from '../../environments/environment';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from '@angular/fire/functions';
import { getApp } from '@angular/fire/app';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  constructor(private db: AngularFireDatabase, private organizationsService: OrganizationsService,
              private usersService: UsersService) {}

  async listEvents(uid: string | null = null) {
    const dbRef = ref(getDatabase());
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    if (!uid) {
      const user: User = await this.usersService.getCurrentUser();
      uid = user.uid;
    }
    const snapshot = await get(child(dbRef, `events/${organization.key}/${uid}`));
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
    const user: User = await this.usersService.getCurrentUser();
    const db = getDatabase();
    // get a key for a new Event.
    const newEventKey = push(child(ref(db), `events/${organization.key}/${user.uid}`)).key;
    const updates: any = {};
    updates[`events/${organization.key}/${user.uid}/${newEventKey}`] = {
      date: `${year}-${month > 9 ? month : `0${month}`}-${day > 9 ? day : `0${day}`}`,
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
    const user: User = await this.usersService.getCurrentUser();
    const db = getDatabase();
    const updates: any = {};
    updates[`events/${organization.key}/${user.uid}/${event.id}`] = {
      date: `${year}-${month > 9 ? month : `0${month}`}-${day > 9 ? day : `0${day}`}`,
      hours: event.hours,
      workDone: event.workDone,
      reason: event.reason
    };
    await update(ref(db), updates);
  }

  async getEvent(id: string) {
    const dbRef = ref(getDatabase());
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const user: User = await this.usersService.getCurrentUser();
    const snapshot = await get(child(dbRef, `events/${organization.key}/${user.uid}/${id}`));
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
    const user: User = await this.usersService.getCurrentUser();
    await remove(ref(db, `events/${organization.key}/${user.uid}/${id}`));
  }

  async deleteEvents(organizationKey: string) {
    const db = getDatabase();
    const user: User = await this.usersService.getCurrentUser();
    await remove(ref(db, `events/${organizationKey}/${user.uid}`));
  }

  constructTitle(event: Event) {
    return `${event.workDone.length > 20 ? `${event.workDone.substring(0, 20)}...` : event.workDone} - ${event.hours} часа`;
  }

  async getEventsPerMonths(uid: string) {
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const events: Event[] = await this.listEvents(uid);
    const months: any = {};
    for (const event of events) {
      const key = `${event.date.getUTCFullYear()}-${event.date.getUTCMonth() > 8 ?
        event.date.getUTCMonth() + 1 : `0${event.date.getUTCMonth() + 1}`}`;
      if (!months[key]) {
        months[key] = {workday_hours: 0, holiday_hours: 0, events: []};
      }
      // is it on weekend day or not?
      if (event.date.getDay() === 0 || event.date.getDay() === 6) {
        // ok. it is weekend but is it excluded?
        let excluded = false;
        for (const stringDate of organization.holidays.excludes) {
          const excludedDate = new Date(stringDate);
          if (excludedDate.getUTCFullYear() === event.date.getUTCFullYear() &&
              excludedDate.getUTCMonth() === event.date.getUTCMonth() &&
              excludedDate.getUTCDate() === event.date.getUTCDate()) {
            excluded = true;
            break;
          }
        }
        if (excluded) {
          // consider it working day
          event.holiday = false;
          months[key].workday_hours += event.hours;
        } else {
          // it is a weekend day and it is not excluded so consider it holiday
          event.holiday = true;
          months[key].holiday_hours += event.hours;
        }
      } else {
        // ok. it is a working day. check if it is not included in holidays
        let included = false;
        for (const stringDate of organization.holidays.includes) {
          const includedDate = new Date(stringDate);
          if (includedDate.getUTCFullYear() === event.date.getUTCFullYear() &&
            includedDate.getUTCMonth() === event.date.getUTCMonth() &&
            includedDate.getUTCDate() === event.date.getUTCDate()) {
            included = true;
            break;
          }
        }
        if (included) {
          // it is a working day but it is marked as holiday
          event.holiday = true;
          months[key].holiday_hours += event.hours;
        } else {
          // it is just a working day
          event.holiday = false;
          months[key].workday_hours += event.hours;
        }
      }
      months[key].events.push(event);
    }
    return Object.keys(months).sort().reverse().reduce(
      (obj: any, key) => {
        obj[key] = months[key];
        return obj;
      },
      {}
    );
  }

  async reportEvents(date: string) {
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const functions = getFunctions(getApp());
    let production = true;
    if (!environment.production) {
      production = false;
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
    const scheduleEventsReport = httpsCallable(functions, 'scheduleEventsReport');
    return scheduleEventsReport({
      organization: organization.key,
      date: date,
      prod: production
    }).then((result) => {
      return result.data;
    })
    .catch((error) => {
      return {error};
    });
  }
}
