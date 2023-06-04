import { Component } from '@angular/core';
import { CalendarOptions } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { buildCalendarVacationDays } from "../shared/helpers";
import { UsersService } from "../services/users.service";
import { OrganizationsService } from "../services/organizations.service";
import { Organization } from "../models/organization";

@Component({
  selector: 'app-vacation-days',
  templateUrl: './vacation-days.component.html',
  styleUrls: ['./vacation-days.component.scss']
})
export class VacationDaysComponent {
  organization: Organization | undefined;
  vacationDays: string[] = [];
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    weekends: true,
    editable: true,
    selectable: true,
    select: this.handleDateClick.bind(this),
    firstDay: 1,
    datesSet: async () => {
      buildCalendarVacationDays(this.vacationDays);
    }
  }

  constructor(private usersService: UsersService, private organizationsService: OrganizationsService) {
    this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
      this.organization = organization;
      this.usersService.getVacationDays(this.organization.key).then((vacationDays: string[])=> {
        this.vacationDays = vacationDays;
        buildCalendarVacationDays(this.vacationDays);
      });
    });
  }

  async handleDateClick(arg: any) {
    const includesIndex = this.vacationDays.indexOf(arg.startStr);
    // if clicked date is already included, remove it from there
    if (includesIndex !== -1) {
      this.vacationDays.splice(includesIndex, 1);
    } else {
      // if not, add it
      this.vacationDays.push(arg.startStr);
    }
    buildCalendarVacationDays(this.vacationDays);
    await this.usersService.setVacationDays(this.organization!.key, this.vacationDays);
  }
}
