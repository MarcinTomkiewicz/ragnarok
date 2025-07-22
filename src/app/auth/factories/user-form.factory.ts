import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export function createUserForm(fb: FormBuilder): FormGroup {
  return fb.group({
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
  });
}
