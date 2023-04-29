import { Component } from '@angular/core';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { OrganizationsService } from '../services/organizations.service';
import { Organization } from '../models/organization';
import { handleHolidays } from '../shared/helpers';

@Component({
  selector: 'app-holidays',
  templateUrl: './holidays.component.html',
  styleUrls: ['./holidays.component.scss']
})
export class HolidaysComponent {
  holidays: any = {};
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    weekends: true,
    editable: true,
    selectable: true,
    select: this.handleDateClick.bind(this),
    firstDay: 1,
    datesSet: () => {
      handleHolidays(this.holidays);
    }
  };

  constructor(private organizationsService: OrganizationsService) {
    this.organizationsService.getCurrentOrganization().then((organization: Organization) => {
      this.holidays = organization.holidays;
      handleHolidays(this.holidays);
    });
  }

  async handleDateClick(arg: any) {
    const includesIndex = this.holidays.includes.indexOf(arg.startStr);
    // if clicked date is in the included list, remove it from there
    if (includesIndex !== -1) {
      this.holidays.includes.splice(includesIndex, 1);
    } else {
      // it is not in the included list but is it a weekend date?
      if (arg.start.getDay() === 0 || arg.start.getDay() === 6) {
        // ok. it is weekend. is it already excluded?
        const excludesIndex = this.holidays.excludes.indexOf(arg.startStr);
        if (excludesIndex !== -1) {
          // yes, it is. remove it so the weekend day will be considered such
          this.holidays.excludes.splice(excludesIndex, 1);
        } else {
          // exclude this weekend day
          this.holidays.excludes.push(arg.startStr)
        }
      } else {
        // no. it is not weekend. just add it to the included list
        this.holidays.includes.push(arg.startStr)
      }
    }
    handleHolidays(this.holidays);
    await this.organizationsService.setHolidays(this.holidays);
  }
}
