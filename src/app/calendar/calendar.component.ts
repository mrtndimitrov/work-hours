import { Component } from '@angular/core';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Router } from '@angular/router';
import { EventsService } from '../services/events.service';
import { Event } from '../models/event';
import { buildCalendarHolidays, buildCalendarIllnessDays, buildCalendarVacationDays } from '../shared/helpers';
import { OrganizationsService } from '../services/organizations.service';
import { Organization } from '../models/organization';
import { UsersService } from "../services/users.service";

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  events: Event[] = [];
  holidays: any = {};
  vacationDays: string[] = [];
  illnessDays: string[] = [];
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    weekends: true,
    editable: true,
    selectable: true,
    select: this.handleDateClick.bind(this),
    eventClick: this.handleEventClick.bind(this),
    firstDay: 1,
    displayEventTime : false,
    datesSet: async () => {
      buildCalendarVacationDays(this.vacationDays);
      buildCalendarHolidays(this.holidays);
    }
  };

  constructor(private router: Router, private eventsService: EventsService,
              private organizationsService: OrganizationsService, private usersService: UsersService) {
    this.eventsService.listEvents().then((events: Event[]) => {
      this.events = events;
      this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
        this.holidays = organization.holidays;
        buildCalendarHolidays(this.holidays);
        this.usersService.getVacationDays(organization.key).then((vacationDays: string[]) => {
          this.vacationDays = vacationDays;
          buildCalendarVacationDays(this.vacationDays);
          this.usersService.getIllnessDays(organization.key).then((illnessDays: string[]) => {
            this.illnessDays = illnessDays;
            buildCalendarIllnessDays(this.illnessDays);
          });
        });
      });
    });
  }

  handleDateClick(arg: any) {
    this.router.navigate(['new-event'], { queryParams: { date: arg.startStr } });
  }

  handleEventClick(info: EventClickArg) {
    this.router.navigate([`event/${info.event._def.publicId}`]);
  }
}
