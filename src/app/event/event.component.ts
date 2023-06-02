import { Component } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventsService } from '../services/events.service';
import { Event } from '../models/event';
import { MessageService } from 'primeng/api';
import { validateAllFormFields } from '../shared/helpers';
import {AppComponent} from "../app.component";

@Component({
  selector: 'app-event',
  templateUrl: './event.component.html',
  styleUrls: ['./event.component.scss']
})
export class EventComponent {
  event: Event | null = null;
  editMode: boolean = true;
  form: FormGroup;
  workDoneStrings: any[] = [];
  filteredWorkDoneStrings: any[] = [];
  reasonStrings: any[] = [];
  filteredReasonStrings: any[] = [];

  editEventMenuItems = [{
    label: 'Редактирай',
    icon: 'pi pi-file-edit',
    command: () => {
        this.toggleEditMode();
      }
  }, {
    label: 'Delete',
    icon: 'pi pi-trash',
    command: () => {
      this.deleteEvent();
    }
  }];

  constructor(private router: Router, private route: ActivatedRoute, public eventsService: EventsService,
              private messageService: MessageService) {
    this.form = new FormGroup({
      'date': new FormControl('', Validators.required),
      'specialDay': new FormControl(''),
      'hours': new FormControl('', Validators.required),
      'workDone': new FormControl('', Validators.required),
      'reason': new FormControl('', Validators.required),
    });
    this.route.params.subscribe(async (params: any) => {
      if (params.eventId) {
        this.editMode = false;
        const event: Event = await this.eventsService.getEvent(params.eventId);
        this.event = event;
        this.form.get('date')?.setValue(event.date);
        this.form.get('date')?.disable();
        this.form.get('specialDay')?.setValue(event.specialDay);
        this.form.get('specialDay')?.disable();
        this.form.get('hours')?.setValue(event.hours);
        this.form.get('hours')?.disable();
        this.form.get('reason')?.setValue({str: event.reason});
        this.form.get('reason')?.disable();
        this.form.get('workDone')?.setValue({str: event.workDone});
        this.form.get('workDone')?.disable();
      }
    });
    this.route.queryParams.subscribe((params: any) => {
      if (params.date) {
        this.form.get('date')?.setValue(new Date(params.date));
      } else {
        this.form.get('date')?.setValue(new Date());
      }
    });
    this.buildAutocompleteStrings();
  }

  async onSubmit() {
    if (this.form.invalid) {
      validateAllFormFields(this.form);
      return;
    }
    AppComponent.toggleProgressBar();
    const eventDate = this.form.get('date')?.value;
    // TODO: investigate why this is needed (when creating dates around midnight sometimes the day is changed so this "fix" was introduced)
    eventDate.setHours(11);
    const reasonControl: AbstractControl = this.form.get('reason')!;
    const workDoneControl: AbstractControl = this.form.get('workDone')!;
    if (this.event) {
      this.event.date = eventDate;
      this.event.specialDay = this.form.get('specialDay')?.value;
      this.event.hours = this.form.get('hours')?.value;
      this.event.reason = reasonControl.value.str ? reasonControl.value.str : reasonControl.value;
      this.event.workDone = workDoneControl.value.str ? workDoneControl.value.str : workDoneControl.value;
      await this.eventsService.updateEvent(this.event);
      this.messageService.add({severity:'success', summary:'Редактиране', detail:'Успешно редактирано събитие!', key: 'app-toast'});
    } else {
      this.event = {
        date: eventDate,
        specialDay: this.form.get('specialDay')?.value,
        hours: this.form.get('hours')?.value,
        reason: reasonControl.value.str ? reasonControl.value.str : reasonControl.value,
        workDone: workDoneControl.value.str ? workDoneControl.value.str : workDoneControl.value,
      };
      this.event.title = this.eventsService.constructTitle(this.event);
      const newEventId = await this.eventsService.addEvent(this.event);
      this.event.id = newEventId!;
      this.messageService.add({severity:'success', summary:'Създаване', detail:'Успешно добавено събитие!', key: 'app-toast'});
    }
    this.toggleEditMode();
    AppComponent.toggleProgressBar();
  }

  getTitle(): string {
    if (this.editMode) {
      return 'Редактирай събитието';
    } else if (this.event) {
      return `${this.event.title}`;
    } else {
      return 'Ново събитие';
    }
  }

  toggleEditMode() {
    if (this.editMode) {
      this.form.get('date')?.disable();
      this.form.get('specialDay')?.disable();
      this.form.get('hours')?.disable();
      this.form.get('reason')?.disable();
      this.form.get('workDone')?.disable();
      this.editMode = false;
    } else {
      this.form.get('date')?.enable();
      this.form.get('specialDay')?.enable();
      this.form.get('hours')?.enable();
      this.form.get('reason')?.enable();
      this.form.get('workDone')?.enable();
      this.editMode = true;
    }
  }

  async deleteEvent() {
    await this.eventsService.deleteEvent(this.event?.id!);
    this.messageService.add({severity:'success', summary:'Изтриване', detail:'Успешно изтрито събитие!', key: 'app-toast'});
    this.router.navigate(['/']);
  }

  filterWorkDoneString(query: string) {
    query = query.toLowerCase();
    let filtered: any[] = [];
    for (const workDoneString of this.workDoneStrings) {
      if (workDoneString.lowerCase.indexOf(query) == 0) {
        filtered.push(workDoneString);
      }
    }
    this.filteredWorkDoneStrings = filtered;
  }

  filterReasonString(query: string) {
    query = query.toLowerCase();
    let filtered: any[] = [];
    for (const reasonString of this.reasonStrings) {
      if (reasonString.lowerCase.indexOf(query) == 0) {
        filtered.push(reasonString);
      }
    }
    this.filteredReasonStrings = filtered;
  }

  private buildAutocompleteStrings() {
    this.workDoneStrings = [];
    this.filteredWorkDoneStrings = [];
    this.reasonStrings = [];
    this.filteredReasonStrings = [];
    this.eventsService.listEvents().then((events: Event[]) => {
      for (const event of events) {
        let found = false;
        const workDoneLowerCase = event.workDone.toLowerCase();
        for (const workDoneString of this.workDoneStrings) {
          if (workDoneString.lowerCase === workDoneLowerCase) {
            workDoneString.num++;
            found = true;
            break;
          }
        }
        if (!found) {
          this.workDoneStrings.push({str: event.workDone, lowerCase: workDoneLowerCase, num: 1});
        }
        found = false;
        const reasonLowerCase = event.reason.toLowerCase();
        for (const reasonString of this.reasonStrings) {
          if (reasonString.lowerCase === reasonLowerCase) {
            reasonString.num++;
            found = true;
            break;
          }
        }
        if (!found) {
          this.reasonStrings.push({str: event.reason, lowerCase: reasonLowerCase, num: 1});
        }
      }
      this.workDoneStrings.sort((a: any, b: any) => {
        return b.num - a.num;
      });
      this.reasonStrings.sort((a: any, b: any) => {
        return b.num - a.num;
      });
      this.filteredWorkDoneStrings = this.workDoneStrings.map((a: any) => ({...a}));
      this.filteredReasonStrings = this.reasonStrings.map((a: any) => ({...a}));
    });
  }
}
