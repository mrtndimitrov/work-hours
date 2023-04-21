import { Component } from '@angular/core';
import {
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

  constructor(private router: Router, private route: ActivatedRoute, private eventsService: EventsService,
              private messageService: MessageService) {
    this.form = new FormGroup({
      'date': new FormControl('', Validators.required),
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
        this.form.get('hours')?.setValue(event.hours);
        this.form.get('hours')?.disable();
        this.form.get('reason')?.setValue(event.reason);
        this.form.get('reason')?.disable();
        this.form.get('workDone')?.setValue(event.workDone);
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
  }

  async onSubmit() {
    if (this.form.invalid) {
      validateAllFormFields(this.form);
      return;
    }
    AppComponent.toggleProgressBar();
    if (this.event) {
      this.event.date = this.form.get('date')?.value;
      this.event.hours = this.form.get('hours')?.value;
      this.event.reason = this.form.get('reason')?.value;
      this.event.workDone = this.form.get('workDone')?.value;
      await this.eventsService.updateEvent(this.event);
      this.messageService.add({severity:'success', summary:'Редактиране', detail:'Успешно редактирано събитие!', key: 'app-toast'});
    } else {
      this.event = {
        date: this.form.get('date')?.value,
        hours: this.form.get('hours')?.value,
        reason: this.form.get('reason')?.value,
        workDone: this.form.get('workDone')?.value,
      };
      this.event.title = this.eventsService.constructTitle(this.event);
      const newEventId = await this.eventsService.addEvent(this.event);
      this.event.id = newEventId!;
      this.messageService.add({severity:'success', summary:'Създаване', detail:'Успешно добавено събитие!', key: 'app-toast'});
    }
    this.toggleEditMode();
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
      this.form.get('hours')?.disable();
      this.form.get('reason')?.disable();
      this.form.get('workDone')?.disable();
      this.editMode = false;
    } else {
      this.form.get('date')?.enable();
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
}
