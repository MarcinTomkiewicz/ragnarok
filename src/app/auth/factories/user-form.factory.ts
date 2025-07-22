import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export function createUserForm(
  fb: FormBuilder,
  includeAuthFields = false
): FormGroup {
  const controls: any = {
    firstName: [''],
    phoneNumber: [''],
    city: [''],
    street: [''],
    houseNumber: [''],
    apartmentNumber: [''],
    postalCode: [''],
    age: [null],
    shortDescription: [''],
    longDescription: [''],
    extendedDescription: [''],
  };

  if (includeAuthFields) {
    controls.email = ['', [Validators.required, Validators.email]];
    controls.password = ['', [Validators.required, Validators.minLength(6)]];
  }

  return fb.group(controls);
}
