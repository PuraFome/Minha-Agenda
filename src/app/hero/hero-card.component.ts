import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from '../game/game.service';
import { HeroClass } from '../game/game.types';

@Component({
  selector: 'app-hero-card',
  imports: [FormsModule],
  templateUrl: './hero-card.component.html',
  styleUrl: './hero-card.component.scss',
})
export class HeroCardComponent {
  private readonly gameService = inject(GameService);

  readonly hero = this.gameService.hero;
  readonly level = this.gameService.level;
  readonly progress = this.gameService.progress;
  readonly xpForNextLevel = this.gameService.xpForNextLevel;

  readonly classIcons: Record<HeroClass, string> = {
    guerreiro: '⚔️',
    mago: '🔮',
    ladino: '🗡️',
    clerigo: '✨',
  };

  readonly classLabels: Record<HeroClass, string> = {
    guerreiro: 'Guerreiro',
    mago: 'Mago',
    ladino: 'Ladino',
    clerigo: 'Clérigo',
  };

  readonly isEditing = signal(false);
  readonly editName = signal('');

  readonly heroClass = computed(() => this.hero()?.heroClass ?? null);
  readonly heroName = computed(() => this.hero()?.name ?? '');
  readonly totalXp = computed(() => this.hero()?.totalXp ?? 0);

  startEditing(): void {
    this.editName.set(this.heroName());
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
    this.editName.set('');
  }

  saveName(): void {
    const trimmed = this.editName().trim();
    if (trimmed && trimmed !== this.heroName()) {
      this.gameService.updateHeroName(trimmed);
    }
    this.isEditing.set(false);
    this.editName.set('');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.saveName();
    } else if (event.key === 'Escape') {
      this.cancelEditing();
    }
  }
}