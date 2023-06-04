import { AbstractControl, UntypedFormArray, UntypedFormControl, UntypedFormGroup, ValidatorFn } from '@angular/forms';
import { EventsService } from "../services/events.service";
import { User } from "../models/user";

export function validateAllFormFields(formGroup: UntypedFormGroup) {
  Object.keys(formGroup.controls).forEach(field => {
    const control = formGroup.get(field);
    if (control instanceof UntypedFormControl) {
      control.markAsTouched({ onlySelf: true });
    } else if (control instanceof UntypedFormGroup) {
      validateAllFormFields(control);
    } else if (control instanceof UntypedFormArray) {
      for (const child of control.controls) {
        if (child instanceof UntypedFormControl) {
          child.markAsTouched({ onlySelf: true });
        } else if (child instanceof UntypedFormGroup) {
          validateAllFormFields(<UntypedFormGroup>child);
        }
      }
    }
  });
}

export function PasswordMatchValidator(formControl: AbstractControl): ValidatorFn {
  return (confirmPassword: AbstractControl): { [key: string]: any } | null => {
    if (!confirmPassword.value) {
      return null;
    }
    const password = formControl.get('password1');
    if (password!.pristine || confirmPassword.pristine) {
      return null;
    }
    return password && confirmPassword && password.value !== confirmPassword.value ? {misMatch: {value: true}} : null;
  };
}

export function buildCalendarHolidays(holidays: any) {
  if (!holidays.includes) {
    return;
  }
  // remove all first
  document.querySelectorAll(`td.holiday`).forEach((element: Element) => {
    element.classList.remove('holiday');
  });
  // lets do weekends first
  document.querySelectorAll(`td.fc-day-sat, td.fc-day-sun`).forEach((element: Element) => {
    element.classList.add('holiday');
  });
  // now add the manually included dates
  for (const stringDate of holidays.includes) {
    document.querySelectorAll(`[data-date="${stringDate}"]`).forEach((element: Element) => {
      element.classList.add('holiday');
    });
  }
  // now remove the manually excluded dates
  for (const stringDate of holidays.excludes) {
    document.querySelectorAll(`[data-date="${stringDate}"]`).forEach((element: Element) => {
      element.classList.remove('holiday');
    });
  }
}

export function buildCalendarVacationDays(vacationDays: string[]) {
  if (!vacationDays) {
    return;
  }
  // remove all vacation days first
  document.querySelectorAll(`td.vacation-day`).forEach((element: Element) => {
    element.classList.remove('vacation-day');
  });
  // now add the manually included vacation days
  for (const vacationDay of vacationDays) {
    document.querySelectorAll(`[data-date="${vacationDay}"]`).forEach((element: Element) => {
      element.classList.add('vacation-day');
    });
  }
}

export function buildCalendarIllnessDays(illnessDays: string[]) {
  if (!illnessDays) {
    return;
  }
  // remove all illness days first
  document.querySelectorAll(`td.illness-day`).forEach((element: Element) => {
    element.classList.remove('illness-day');
  });
  // now add the manually included illness days
  for (const illnessDay of illnessDays) {
    document.querySelectorAll(`[data-date="${illnessDay}"]`).forEach((element: Element) => {
      element.classList.add('illness-day');
    });
  }
}

export function monthYearToText(monthKey: string) {
  const [year, month] = monthKey.split('-');
  switch (month) {
    case '01': return `Януари, ${year} г.`;
    case '02': return `Февруари, ${year} г.`;
    case '03': return `Март, ${year} г.`;
    case '04': return `Април, ${year} г.`;
    case '05': return `Май, ${year} г.`;
    case '06': return `Юни, ${year} г.`;
    case '07': return `Юли, ${year} г.`;
    case '08': return `Август, ${year} г.`;
    case '09': return `Септември, ${year} г.`;
    case '10': return `Октомври, ${year} г.`;
    case '11': return `Ноември, ${year} г.`;
    case '12': return `Декември, ${year} г.`;
    default: return `${year} г.`;
  }
}
