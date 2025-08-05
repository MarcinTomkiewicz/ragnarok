import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TeamService } from '../../core/services/team/team.service';
import { ITeam } from '../../../core/interfaces/teams/i-team';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth/auth.service';
import { stringToSlug } from '../../../core/utils/type-mappers';
import { IGmData, IGmProfile } from '../../../core/interfaces/i-gm-profile';
import { GmService } from '../../core/services/gm/gm.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';

@Component({
  selector: 'app-create-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-team.component.html',
  styleUrl: './create-team.component.scss',
})
export class CreateTeamComponent {
  readonly teamForm: FormGroup;
  private readonly fb = inject(FormBuilder);
  private readonly teamService = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly gmService = inject(GmService)

  readonly user = this.auth.user;
  gmsList = signal<IGmData[]>([]);

  constructor() {
    this.teamForm = this.fb.group({
      name: ['', Validators.required],
      gmId: [null],
      startProgram: [false],
      finishedProgram: [false],
      notes: [''],
      isOpen: [true],
      isForBeginners: [false],
    });
  }

    ngOnInit(): void {
    this.gmService.getAllGms().subscribe((gms) => {
      this.gmsList.set(gms)
      console.log(this.gmsList());
      
    });
  }

  isReceptionField(): boolean {
    if (!this.user) return false;
    return hasMinimumCoworkerRole(this.user(), CoworkerRoles.Reception);
  }

  onSubmit() {
    
    if (this.teamForm.valid) {
      const slug = stringToSlug(this.teamForm.get('name')?.value);
      const teamData: Partial<ITeam> = {...this.teamForm.value, slug, ownerId: this.user()?.id}
      console.log(teamData);
      
      this.teamService.createTeam(teamData).subscribe({
        next: (team) => console.log('Utworzono drużynę:', team),
        error: (err) => console.error('Błąd podczas tworzenia drużyny:', err),
      });
    }
  }
}
