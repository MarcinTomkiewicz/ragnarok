import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoworkerRoles } from '../../../core/enums/roles';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { EventService } from '../../../core/services/event/event.service';
import { EventFull } from '../../../core/interfaces/i-events';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';

@Component({
  selector: 'app-host-signup-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './host-signup-form.component.html',
})
export class HostSignupFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly events = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly backend = inject(BackendService);

  event = input.required<EventFull>();
  date = input.required<string>(); // 'YYYY-MM-DD'

  form = this.fb.nonNullable.group({
    roomName: ['' as string, []], // validator dołożymy warunkowo w ngOnInit
    title: ['', [Validators.required]],
    systemId: [''],
    description: [''],
    triggers: [[] as string[]],
    playstyleTags: [[] as string[]],
  });

  ngOnInit() {
    // WYMAGAJ salki tylko dla SESSION
    const ev = this.event();
    const roomCtrl = this.form.controls.roomName;
    if (ev.attractionType === 'SESSION') {
      roomCtrl.addValidators([Validators.required]);
    } else {
      roomCtrl.clearValidators();
    }
    roomCtrl.updateValueAndValidity({ emitEvent: false });
  }

  get canSignup(): boolean {
    const user = this.auth.user();
    if (!user) return false;
    const ev = this.event();
    if (ev.hostSignup === 'ANY') return true;
    return hasMinimumCoworkerRole(user, CoworkerRoles.Gm);
  }

  // ---- Handlery inputów tekstowych (bez rzutowań w HTML) ----
  onPlaystyleTagsInput(e: Event) {
    const raw = (e.target as HTMLInputElement | null)?.value ?? '';
    const tags = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.form.controls.playstyleTags.setValue(tags);
  }

  onTriggersInput(e: Event) {
    const raw = (e.target as HTMLInputElement | null)?.value ?? '';
    const arr = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.form.controls.triggers.setValue(arr);
  }

  submit() {
    if (!this.canSignup) return;

    const ev = this.event();
    if (ev.attractionType === 'SESSION' && !this.form.value.roomName) return;
    if (this.form.invalid) return;

    const user = this.auth.user()!;
    const v = this.form.getRawValue();

    const payload = {
      event_id: ev.id,
      occurrence_date: this.date(),
      room_name: ev.attractionType === 'SESSION' ? v.roomName : null,
      host_user_id: user.id,
      role: 'GM',
      title: v.title,
      system_id: v.systemId || null,
      description: v.description || null,
      triggers: v.triggers ?? [],
      playstyle_tags: v.playstyleTags ?? [],
      image_path: null,
    };

    this.backend.create('event_occurrence_hosts', payload).subscribe({
      next: () => {
        /* toast success */
      },
      error: (err) => {
        // np. konflikt unikalności (sala/termin zajęte) albo brak uprawnień (RLS)
        console.error('Nie udało się zapisać zgłoszenia', err);
      },
    });
  }
}
