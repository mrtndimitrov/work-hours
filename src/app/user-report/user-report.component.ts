import { Component } from '@angular/core';
import { EventsService } from '../services/events.service';
import { UsersService } from '../services/users.service';
import { User } from '../models/user';
import { monthYearToText } from '../shared/helpers';

@Component({
  selector: 'app-report',
  templateUrl: './user-report.component.html',
  styleUrls: ['./user-report.component.scss']
})
export class UserReportComponent {
  months: any[] = [];
  groupedEvents: any = {};
  selectedMonth: string = '';
  constructor(private eventsService: EventsService, private usersService: UsersService) {
    this.usersService.getCurrentUser().then((user: User) => {
      this.eventsService.getEventsPerMonths(user.uid).then((data: any) => {
        this.groupedEvents = data;
        const monthKeys = Object.keys(data);
        if (monthKeys.length > 0) {
          for (const monthKey of monthKeys) {
            this.months.push({key: monthKey, value: monthYearToText(monthKey)})
          }
          this.selectedMonth = monthKeys[0];
        }
      });
    });
  }
}
