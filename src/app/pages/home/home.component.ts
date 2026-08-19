import { Component, inject } from '@angular/core';
import { GameService } from '../../game/game.service';
import { LevelUpComponent } from '../../game/level-up.component';
import { HeroCardComponent } from '../../hero/hero-card.component';
import { HeroSetupComponent } from '../../hero/hero-setup.component';
import { TaskFormComponent } from '../../tasks/task-form.component';
import { TaskListComponent } from '../../tasks/task-list.component';

@Component({
  selector: 'app-home',
  imports: [
    HeroSetupComponent,
    HeroCardComponent,
    TaskFormComponent,
    TaskListComponent,
    LevelUpComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly gameService = inject(GameService);

  /** Herói atual — null no primeiro acesso (mostra o setup). */
  readonly hero = this.gameService.hero;
}