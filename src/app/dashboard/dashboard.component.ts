import { Component, OnDestroy, OnInit } from '@angular/core';
import { User } from '../models/user';
import { monthYearToText } from '../shared/helpers';
import { EventsService } from '../services/events.service';
import { UsersService } from '../services/users.service';
import { NavigationEnd, Router } from "@angular/router";
import { Subscription } from "rxjs";

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  subscription: Subscription | null = null;
  data: any;
  options: any;

  constructor(private eventsService: EventsService, private usersService: UsersService, private router: Router) {}

  async ngOnInit() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    const user: User = await this.usersService.getCurrentUser();
    let data: any = await this.eventsService.getEventsPerMonths(user.uid);
    if (!data) {
      return;
    }
    data = Object.keys(data).sort().reduce(
      (obj: any, key) => {
        obj[key] = data[key];
        return obj;
      },
      {}
    );
    const months: string[] = [];
    const holidayHours: number[] = [];
    const workingDayHours: number[] = [];
    for (const [k, v] of Object.entries(data)) {
      const obj: any = v;
      months.push(monthYearToText(k));
      holidayHours.push(obj.holiday_hours);
      workingDayHours.push(obj.workday_hours);
    }

    this.data = {
      labels: months,
      datasets: [
        {
          label: 'Часове в работни дни',
          backgroundColor: documentStyle.getPropertyValue('--blue-500'),
          borderColor: documentStyle.getPropertyValue('--blue-500'),
          data: workingDayHours
        },
        {
          label: 'Часове в почивни дни',
          backgroundColor: documentStyle.getPropertyValue('--pink-500'),
          borderColor: documentStyle.getPropertyValue('--pink-500'),
          data: holidayHours
        }
      ]
    };

    this.options = {
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          labels: {
            color: textColor
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColorSecondary,
            font: {
              weight: 500
            }
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false
          }
        },
        y: {
          ticks: {
            color: textColorSecondary
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false
          }
        }

      }
    };
    if (!this.subscription) {
      this.subscription = this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.ngOnInit();
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
