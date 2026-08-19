import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from '../game/game.service';
import { HeroClass, HERO_CLASSES } from '../game/game.types';

@Component({
  selector: 'app-hero-setup',
  imports: [FormsModule],
  templateUrl: './hero-setup.component.html',
  styleUrl: './hero-setup.component.scss',
})
export class HeroSetupComponent {
  private readonly gameService = inject(GameService);

  readonly heroClasses = HERO_CLASSES;

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

  readonly name = signal('');
  readonly selectedClass = signal<HeroClass | null>(null);

  readonly trimmedName = computed(() => this.name().trim());
  readonly isNameValid = computed(() => this.trimmedName().length > 0);
  readonly isClassValid = computed(() => this.selectedClass() !== null);
  readonly canSubmit = computed(() => this.isNameValid() && this.isClassValid());

  selectClass(heroClass: HeroClass): void {
    this.selectedClass.set(heroClass);
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.gameService.createHero(this.trimmedName(), this.selectedClass()!);
  }
}