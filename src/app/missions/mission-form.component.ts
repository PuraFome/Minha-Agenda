import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MissionService } from '../game/mission.service';
import { DIFFICULTIES, Difficulty, Mission, XP_TABLE } from '../game/game.types';

@Component({
  selector: 'app-mission-form',
  imports: [FormsModule],
  templateUrl: './mission-form.component.html',
  styleUrl: './mission-form.component.scss',
})
export class MissionFormComponent {
  private readonly missionService = inject(MissionService);

  /** Missão pendente em edição. Quando ausente, o formulário cria uma nova missão. */
  readonly task = input<Mission | null>(null);

  /** Emitido após salvar (criar ou editar). */
  readonly saved = output<void>();

  readonly difficulties = DIFFICULTIES;
  readonly xpTable = XP_TABLE;

  readonly difficultyLabels: Record<Difficulty, string> = {
    facil: 'Fácil',
    media: 'Média',
    dificil: 'Difícil',
    'muito-dificil': 'Muito difícil',
    epica: 'Épica',
  };

  readonly title = signal('');
  readonly difficulty = signal<Difficulty>('facil');
  readonly dueDate = signal('');

  readonly isEditing = computed(() => this.task() !== null);
  readonly trimmedTitle = computed(() => this.title().trim());
  readonly canSubmit = computed(() => this.trimmedTitle().length > 0);

  onDifficultyChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Difficulty;
    this.difficulty.set(value);
  }

  constructor() {
    // Pré-preenche o formulário ao entrar em modo de edição; zera no modo de criação.
    effect(() => {
      const current = this.task();
      if (current) {
        this.title.set(current.title);
        this.difficulty.set(current.difficulty);
        this.dueDate.set(current.dueDate ?? '');
      } else {
        this.title.set('');
        this.difficulty.set('facil');
        this.dueDate.set('');
      }
    });
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      return;
    }
    const due = this.dueDate().trim() || null;
    const current = this.task();
    if (current) {
      this.missionService.editMission(current.id, {
        title: this.trimmedTitle(),
        difficulty: this.difficulty(),
        dueDate: due,
      });
    } else {
      this.missionService.addMission(this.trimmedTitle(), this.difficulty(), due);
    }
    this.saved.emit();
  }
}