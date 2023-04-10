import { Component, OnInit } from '@angular/core';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Router } from '@angular/router';
import { EventsService } from '../services/events.service';
import { Event } from '../models/event';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit{
  events: Event[] = [];
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    weekends: true,
    editable: true,
    selectable: true,
    select: this.handleDateClick.bind(this),
    eventClick: this.handleEventClick.bind(this),
  };

  constructor(private router: Router, private eventsService: EventsService) {}

  async ngOnInit() {
    this.events = await this.eventsService.listEvents();
    console.log(this.events)
  }

  handleDateClick(arg: any) {
    this.router.navigate(['new-event'], { queryParams: { date: arg.startStr } });
  }

  handleEventClick(info: EventClickArg) {
    this.router.navigate([`event/${info.event._def.publicId}`]);
  }
}
