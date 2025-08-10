import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export function createUserForm(
  fb: FormBuilder,
  includeEmail = false,
  includePassword = false
): FormGroup {
  const controls: Record<string, any> = {
    firstName: [''],
    nickname: [''],
    useNickname: [false],
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

  if (includeEmail) {
    controls['email'] = ['', [Validators.required, Validators.email]];
  }

  if (includePassword) {
    controls['password'] = ['', [Validators.required, Validators.minLength(6)]];
  }

  return fb.group(controls);
}
