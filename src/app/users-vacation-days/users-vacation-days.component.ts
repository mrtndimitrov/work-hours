import { Component } from '@angular/core';
import { CalendarOptions } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { UsersService } from "../services/users.service";
import { OrganizationsService } from "../services/organizations.service";
import { Organization } from "../models/organization";
import { Event } from '../models/event';

@Component({
  selector: 'app-users-vacation-days',
  templateUrl: './users-vacation-days.component.html',
  styleUrls: ['./users-vacation-days.component.scss']
})
export class UsersVacationDaysComponent {
  organization: Organization | undefined;
  events: Event[] = [];
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    weekends: true,
    editable: false,
    selectable: false,
    firstDay: 1,
    displayEventTime: false
  };

  constructor(private usersService: UsersService, private organizationsService: OrganizationsService) {
    const temp: any[] = [];
    this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
      this.organization = organization;
      this.usersService.getUsers(this.organization.key).then(async (users: any) => {
        for (const user of users) {
          const vacationDays = await this.usersService.getVacationDays(this.organization!.key, user.uid);
          for (const vacationDay of vacationDays) {
            temp.push({
              hours: 0, reason: "", workDone: "",
              id: `${user.email}-${vacationDay}`,
              date: new Date(vacationDay),
              title: user.firstName ? `${user.firstName} ${user.lastName}` : user.email
            });
          }
        }
        this.events = temp;
      });
    });
  }
}
