import { Component, inject, signal } from '@angular/core';
import { TaskService } from '../game/task.service';
import { TaskFormComponent } from './task-form.component';
import { Difficulty, Task, XP_TABLE } from '../game/game.types';

@Component({
  selector: 'app-task-list',
  imports: [TaskFormComponent],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent {
  private readonly taskService = inject(TaskService);

  readonly pendingTasks = this.taskService.pendingTasks;
  readonly completedTasks = this.taskService.completedTasks;

  readonly xpTable = XP_TABLE;

  readonly difficultyLabels: Record<Difficulty, string> = {
    facil: 'Fácil',
    media: 'Média',
    dificil: 'Difícil',
    'muito-dificil': 'Muito difícil',
    epica: 'Épica',
  };

  readonly showForm = signal(false);
  readonly editingTask = signal<Task | null>(null);

  startCreate(): void {
    this.editingTask.set(null);
    this.showForm.set(true);
  }

  startEdit(task: Task): void {
    this.editingTask.set(task);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingTask.set(null);
  }

  completeTask(id: string): void {
    this.taskService.completeTask(id);
  }

  undoComplete(id: string): void {
    this.taskService.undoComplete(id);
  }

  deleteTask(id: string): void {
    this.taskService.deleteTask(id);
  }

  /** Converte 'YYYY-MM-DD' em 'DD/MM/YYYY' para exibição. */
  formatDueDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
}