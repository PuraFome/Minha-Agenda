import { Component, inject, signal } from '@angular/core';
import { MissionService } from '../game/mission.service';
import { TaskFormComponent } from './task-form.component';
import { Difficulty, Mission, XP_TABLE } from '../game/game.types';

@Component({
  selector: 'app-task-list',
  imports: [TaskFormComponent],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent {
  private readonly missionService = inject(MissionService);

  readonly pendingTasks = this.missionService.pendingTasks;
  readonly completedTasks = this.missionService.completedTasks;

  readonly xpTable = XP_TABLE;

  readonly difficultyLabels: Record<Difficulty, string> = {
    facil: 'Fácil',
    media: 'Média',
    dificil: 'Difícil',
    'muito-dificil': 'Muito difícil',
    epica: 'Épica',
  };

  readonly showForm = signal(false);
  readonly editingMission = signal<Mission | null>(null);

  startCreate(): void {
    this.editingMission.set(null);
    this.showForm.set(true);
  }

  startEdit(mission: Mission): void {
    this.editingMission.set(mission);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingMission.set(null);
  }

  completeMission(id: string): void {
    this.missionService.completeMission(id);
  }

  undoCompleteMission(id: string): void {
    this.missionService.undoCompleteMission(id);
  }

  deleteMission(id: string): void {
    this.missionService.deleteMission(id);
  }

  /** Converte 'YYYY-MM-DD' em 'DD/MM/YYYY' para exibição. */
  formatDueDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
}