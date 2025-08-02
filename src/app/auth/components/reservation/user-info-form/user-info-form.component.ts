import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';

@Component({
  selector: 'app-user-info-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <div class="form-group">
        <label>Imię lub pseudonim</label>
        <input class="form-control" formControlName="name" />
      </div>

      <div class="form-group">
        <label>Numer telefonu</label>
        <input class="form-control" formControlName="phone" />
      </div>

      <div class="form-check mt-3">
        <input type="checkbox" class="form-check-input" id="isMember" formControlName="isMember" />
        <label class="form-check-label" for="isMember">
          Członek Klubu Gier Fabularnych
        </label>
      </div>
    </form>
  `
})
export class UserInfoFormComponent implements OnInit, OnDestroy {
  private readonly store = inject(ReservationStoreService);
  private readonly fb = inject(FormBuilder);

  form!: FormGroup;
  private sub = new Subscription();

  ngOnInit(): void {
    this.form = this.fb.group({
      name: this.store.externalName(),
      phone: this.store.externalPhone(),
      isMember: this.store.externalIsClubMember(),
    });

    this.sub.add(
      this.form.get('name')!.valueChanges.subscribe(value => {
        this.store.externalName.set(value);
      })
    );
    this.sub.add(
      this.form.get('phone')!.valueChanges.subscribe(value => {
        this.store.externalPhone.set(value);
      })
    );
    this.sub.add(
      this.form.get('isMember')!.valueChanges.subscribe(value => {
        this.store.externalIsClubMember.set(value);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
