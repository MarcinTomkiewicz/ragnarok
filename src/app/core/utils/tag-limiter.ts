import { FormArray, ValidatorFn } from "@angular/forms";

export const maxThreeStyles: ValidatorFn = (control) => {
    const array = control as FormArray;
    return array.length > 3 ? { maxTags: true } : null;
  };