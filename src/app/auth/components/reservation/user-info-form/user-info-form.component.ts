import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject, combineLatest, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, startWith, tap, shareReplay } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { IUser } from '../../../../core/interfaces/i-user';
import { IParty } from '../../../../core/interfaces/parties/i-party';
import { CoworkerRoles } from '../../../../core/enums/roles';

@Component({
  selector: 'app-user-info-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDropdownModule],
  templateUrl: './user-info-form.component.html',
  styleUrl: './user-info-form.component.scss',
})
export class UserInfoFormComponent implements OnInit, OnDestroy {
  private readonly store = inject(ReservationStoreService);
  private readonly fb = inject(FormBuilder);
  private readonly backend = inject(BackendService);

  readonly CoworkerRoles = CoworkerRoles;

  form!: FormGroup;
  private sub = new Subscription();

  private allUsers: IUser[] = [];
  private allParties: IParty[] = [];

  readonly userQ = new Subject<string>();
  readonly partyQ = new Subject<string>();

  private uniqById<T extends { id: string }>(arr: T[]): T[] {
    const map = new Map<string, T>();
    for (const x of arr) if (x?.id) map.set(x.id, x);
    return Array.from(map.values());
  }

  private readonly users$ = this.backend.getAll<IUser>('users').pipe(
    map((u) => this.uniqById(u)),
    tap((u) => (this.allUsers = u)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly parties$ = this.backend.getAll<IParty>('parties').pipe(
    map((p) => this.uniqById(p)),
    tap((p) => (this.allParties = p)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly userResults$ = combineLatest([
    this.users$,
    this.userQ.pipe(debounceTime(250), distinctUntilChanged(), startWith('')),
  ]).pipe(
    map(([users, q]) => {
      const ql = (q || '').toString().trim().toLowerCase();
      const filtered = ql
        ? users.filter((u) => {
            const name = this.displayUserName(u).toLowerCase();
            const phone = (u.phoneNumber || '').toLowerCase();
            return name.includes(ql) || phone.includes(ql);
          })
        : users;
      const sorted = [...filtered].sort((a, b) =>
        this.displayUserName(a).localeCompare(this.displayUserName(b), 'pl', { sensitivity: 'base' })
      );
      return this.uniqById(sorted);
    })
  );

  private readonly openParties$ = combineLatest([
    this.parties$,
    this.partyQ.pipe(debounceTime(250), distinctUntilChanged(), startWith('')),
  ]).pipe(
    map(([parties, q]) => {
      const ql = (q || '').toString().trim().toLowerCase();
      const list = parties.filter((p) => p.beginnersProgram === true);
      const filtered = ql ? list.filter((p) => p.name.toLowerCase().includes(ql)) : list;
      const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
      return this.uniqById(sorted);
    })
  );

  private readonly otherParties$ = combineLatest([
    this.parties$,
    this.partyQ.pipe(debounceTime(250), distinctUntilChanged(), startWith('')),
  ]).pipe(
    map(([parties, q]) => {
      const ql = (q || '').toString().trim().toLowerCase();
      const list = parties.filter((p) => p.beginnersProgram !== true);
      const filtered = ql ? list.filter((p) => p.name.toLowerCase().includes(ql)) : list;
      const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
      return this.uniqById(sorted);
    })
  );

  readonly userResults = toSignal(this.userResults$, { initialValue: [] as IUser[] });
  readonly openParties = toSignal(this.openParties$, { initialValue: [] as IParty[] });
  readonly otherParties = toSignal(this.otherParties$, { initialValue: [] as IParty[] });
  readonly partiesEmpty = toSignal(
    combineLatest([this.openParties$, this.otherParties$]).pipe(map(([a, b]) => a.length === 0 && b.length === 0)),
    { initialValue: false }
  );

  ngOnInit(): void {
    this.form = this.fb.group({
      name: this.store.externalName(),
      phone: this.store.externalPhone(),
      isMember: this.store.externalIsClubMember(),
    });

    this.sub.add(this.form.get('name')!.valueChanges.subscribe((v) => this.store.externalName.set(v)));
    this.sub.add(this.form.get('phone')!.valueChanges.subscribe((v) => this.store.externalPhone.set(v)));
    this.sub.add(this.form.get('isMember')!.valueChanges.subscribe((v) => this.store.externalIsClubMember.set(v)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  displayUserName(u: IUser): string {
    if (!u) return '';
    return u.useNickname && u.nickname ? u.nickname : (u.firstName || u.email || '');
  }

  isMember(u: IUser | null): boolean {
    if (!u) return false;
    return u.coworker === CoworkerRoles.Member || u.coworker === CoworkerRoles.Golden;
  }

  onPickUser(u: IUser) {
    const name = this.displayUserName(u);
    const phone = u.phoneNumber || '';

    this.store.selectedPartyId.set(null);
    this.store.externalName.set(name);
    this.store.externalPhone.set(phone);
    this.store.externalIsClubMember.set(this.isMember(u));
    this.store.saveToStorage();

    this.form.patchValue({ name, phone, isMember: this.isMember(u) }, { emitEvent: false });
  }

  onPickParty(p: IParty) {
    this.store.selectedPartyId.set(p.id);

    this.backend.getById<IUser>('users', p.ownerId).subscribe((owner) => {
      const name = owner ? this.displayUserName(owner) : '';
      const phone = owner?.phoneNumber || '';
      const member = owner ? this.isMember(owner) : false;

      this.store.externalName.set(name);
      this.store.externalPhone.set(phone);
      this.store.externalIsClubMember.set(member);
      this.store.saveToStorage();

      this.form.patchValue({ name, phone, isMember: member }, { emitEvent: false });
    });
  }
}
