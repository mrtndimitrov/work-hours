import { AbstractControl, UntypedFormArray, UntypedFormControl, UntypedFormGroup, ValidatorFn } from '@angular/forms';

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
