import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '../../game/game.service';
import { MissionService } from '../../game/mission.service';
import { SettingsService } from '../../game/settings.service';
import { HeroCardComponent } from '../../hero/hero-card.component';
import { HeroSetupComponent } from '../../hero/hero-setup.component';

@Component({
  selector: 'app-perfil',
  imports: [HeroSetupComponent, HeroCardComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private readonly gameService = inject(GameService);
  private readonly missionService = inject(MissionService);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);

  readonly hero = this.gameService.hero;
  readonly level = this.gameService.level;
  readonly totalXp = computed(() => this.hero()?.totalXp ?? 0);
  readonly completedCount = computed(() => this.missionService.completedTasks().length);
  readonly retentionDays = this.settingsService.retentionDays;

  readonly retentionOptions = [
    { days: 0, label: 'Nunca' },
    { days: 7, label: '7 dias' },
    { days: 30, label: '30 dias' },
    { days: 60, label: '60 dias' },
    { days: 90, label: '90 dias' },
  ] as const;

  onHeroCreated(): void {
    this.router.navigate(['/']);
  }

  onRetentionChange(event: Event): void {
    const days = Number((event.target as HTMLSelectElement).value);
    this.settingsService.setRetentionDays(days);
    this.missionService.purgeExpired();
  }
}