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
  SPECIAL_DAY_NONE = 0;
  SPECIAL_DAY_ILLNESS = 1;
  SPECIAL_DAY_VACATION = 2;

  eventsPerUser: any = {};

  constructor(private db: AngularFireDatabase, private organizationsService: OrganizationsService,
              private usersService: UsersService) {}

  async listEvents(uid: string | null = null) {
    const dbRef = ref(getDatabase());
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    if (!organization) {
      return [];
    }
    if (!uid) {
      const user: User = await this.usersService.getCurrentUser();
      uid = user.uid;
    }
    if (this.eventsPerUser[`${uid}_${organization.key}`]) {
      return this.eventsPerUser[`${uid}_${organization.key}`];
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
      this.eventsPerUser[`${uid}_${organization.key}`] = events;
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
    if (this.eventsPerUser[`${user.uid}_${organization.key}`]) {
      this.eventsPerUser[`${user.uid}_${organization.key}`].push(event);
    } else {
      this.eventsPerUser[`${user.uid}_${organization.key}`] = [event];
    }
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
    delete this.eventsPerUser[`${user.uid}_${organization.key}`];
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
    delete this.eventsPerUser[`${user.uid}_${organization.key}`];
  }

  async deleteEvents(organizationKey: string) {
    const db = getDatabase();
    const user: User = await this.usersService.getCurrentUser();
    await remove(ref(db, `events/${organizationKey}/${user.uid}`));
    delete this.eventsPerUser[`${user.uid}_${organizationKey}`];
  }

  constructTitle(event: Event) {
    return `${event.workDone.length > 20 ? `${event.workDone.substring(0, 20)}...` : event.workDone} - ${event.hours} часа`;
  }

  async getEventsPerMonths(uid: string) {
    const organization: Organization = await this.organizationsService.getCurrentOrganization();
    const vacationDays = await this.usersService.getVacationDays(organization.key, uid);
    const illnessDays = await this.usersService.getIllnessDays(organization.key, uid);
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
        for (const excludedDate of organization.holidays.parsed_excludes) {
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
        } else {
          // it is a weekend day and it is not excluded so consider it holiday
          event.holiday = true;

        }
      } else {
        // ok. it is a working day. check if it is not included in holidays
        let included = false;
        for (const includedDate of organization.holidays.parsed_includes) {
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
        } else {
          // it is just a working day
          event.holiday = false;
        }
      }
      // if the event is not during holidays, check if it is not during a special for this user day
      if (event.holiday) {
        months[key].holiday_hours += event.hours;
      } else {
        const keyDate = `${key}-${event.date.getUTCDate() > 9 ? event.date.getUTCDate() : `0${event.date.getUTCDate()}`}`;
        if (vacationDays.indexOf(keyDate) !== -1) {
          event.specialDay = this.SPECIAL_DAY_VACATION;
          months[key].holiday_hours += event.hours;
        } else if (illnessDays.indexOf(keyDate) !== -1) {
          event.specialDay = this.SPECIAL_DAY_ILLNESS;
          months[key].holiday_hours += event.hours;
        } else {
          months[key].workday_hours += event.hours;
        }
      }
      months[key].events.push(event);
    }
    for (const month of Object.values(months)) {
      // @ts-ignore
      month.events.sort((a: Event, b: Event) => {
        return a.date.getTime() - b.date.getTime();
      });
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
    const functions = getFunctions(getApp(), 'europe-west1');
    let production = false; // TODO: set it to true when fixing the queue
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

  printHolidayString(event: Event) {
    if (event.holiday) {
      return 'Да';
    }
    if (event.specialDay === this.SPECIAL_DAY_VACATION) {
      return 'Да (отпуск)';
    }
    if (event.specialDay === this.SPECIAL_DAY_ILLNESS) {
      return 'Да (болничен)';
    }
    return 'Не';
  }
}
