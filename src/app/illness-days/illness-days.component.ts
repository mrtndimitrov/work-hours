import { Component } from '@angular/core';
import { Organization } from "../models/organization";
import { CalendarOptions } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { buildCalendarIllnessDays } from "../shared/helpers";
import { UsersService } from "../services/users.service";
import { OrganizationsService } from "../services/organizations.service";

@Component({
  selector: 'app-illness-days',
  templateUrl: './illness-days.component.html',
  styleUrls: ['./illness-days.component.scss']
})
export class IllnessDaysComponent {
  organization: Organization | undefined;
  illnessDays: string[] = [];
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    weekends: true,
    editable: true,
    selectable: true,
    select: this.handleDateClick.bind(this),
    firstDay: 1,
    datesSet: async () => {
      buildCalendarIllnessDays(this.illnessDays);
    }
  }

  constructor(private usersService: UsersService, private organizationsService: OrganizationsService) {
    this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
      this.organization = organization;
      this.usersService.getIllnessDays(this.organization.key).then((illnessDays: string[])=> {
        this.illnessDays = illnessDays;
        buildCalendarIllnessDays(this.illnessDays);
      });
    });
  }

  async handleDateClick(arg: any) {
    const includesIndex = this.illnessDays.indexOf(arg.startStr);
    // if clicked date is already included, remove it from there
    if (includesIndex !== -1) {
      this.illnessDays.splice(includesIndex, 1);
    } else {
      // if not, add it
      this.illnessDays.push(arg.startStr);
    }
    buildCalendarIllnessDays(this.illnessDays);
    await this.usersService.setIllnessDays(this.organization!.key, this.illnessDays);
  }
}
