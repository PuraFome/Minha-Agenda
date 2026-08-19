import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { GameService } from './game.service';
import { Difficulty, Task, XP_TABLE } from './game.types';

const TASKS_STORAGE_KEY = 'ma.tasks.v1';

/** Linha de tarefa pendente com flag de atraso calculada. */
export interface PendingTaskRow {
  task: Task;
  overdue: boolean;
}

/**
 * Gerencia a lista de tarefas e a integração com o XP do herói.
 *
 * - Persiste as tarefas em localStorage (key `ma.tasks.v1`) com try/catch.
 * - Completar tarefa concede XP (XP_TABLE[difficulty]); desfazer subtrai.
 * - Excluir tarefa completada mantém o XP já ganho.
 * - Edição só é permitida em tarefas pendentes.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly document = inject(DOCUMENT);
  private readonly gameService = inject(GameService);

  /** Todas as tarefas, na ordem de criação. */
  readonly tasks = signal<Task[]>(this.readStoredTasks());

  /** Tarefas pendentes, ordenadas por dueDate asc (nulls por último), com flag de atraso. */
  readonly pendingTasks = computed<PendingTaskRow[]>(() => {
    const today = this.todayDateString();
    return this.tasks()
      .filter((task) => !task.completed)
      .map((task) => ({ task, overdue: this.isOverdue(task, today) }))
      .sort((a, b) => this.compareDueDates(a.task, b.task));
  });

  /** Tarefas concluídas, ordenadas por completedAt desc (mais recentes primeiro). */
  readonly completedTasks = computed<Task[]>(() =>
    this.tasks()
      .filter((task) => task.completed)
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      }),
  );

  /** Cria uma tarefa pendente com id gerado via crypto.randomUUID(). */
  addTask(title: string, difficulty: Difficulty, dueDate?: string | null): void {
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      difficulty,
      dueDate: dueDate ?? undefined,
      completed: false,
      completedAt: null,
    };
    this.tasks.update((tasks) => [...tasks, task]);
    this.persist();
  }

  /** Edita título/dificuldade/data de uma tarefa pendente. Tarefas concluídas são ignoradas. */
  editTask(id: string, updates: Partial<Pick<Task, 'title' | 'difficulty' | 'dueDate'>>): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id && !task.completed ? { ...task, ...updates } : task,
      ),
    );
    this.persist();
  }

  /** Conclui a tarefa, marca completedAt e concede o XP correspondente. */
  completeTask(id: string): void {
    const task = this.tasks().find((t) => t.id === id);
    if (!task || task.completed) {
      return;
    }
    this.gameService.addXp(XP_TABLE[task.difficulty]);
    this.tasks.update((tasks) =>
      tasks.map((t) =>
        t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t,
      ),
    );
    this.persist();
  }

  /** Desfaz a conclusão, subtrai o XP concedido e libera a edição. */
  undoComplete(id: string): void {
    const task = this.tasks().find((t) => t.id === id);
    if (!task || !task.completed) {
      return;
    }
    this.gameService.addXp(-XP_TABLE[task.difficulty]);
    this.tasks.update((tasks) =>
      tasks.map((t) => (t.id === id ? { ...t, completed: false, completedAt: null } : t)),
    );
    this.persist();
  }

  /** Remove a tarefa. Se concluída, o XP já ganho permanece. */
  deleteTask(id: string): void {
    this.tasks.update((tasks) => tasks.filter((t) => t.id !== id));
    this.persist();
  }

  /** Atrasada = tem dueDate anterior a hoje (comparação só de data) e não está concluída. */
  private isOverdue(task: Task, today: string): boolean {
    return !task.completed && !!task.dueDate && task.dueDate < today;
  }

  private compareDueDates(a: Task, b: Task): number {
    if (a.dueDate === b.dueDate) {
      return 0;
    }
    if (a.dueDate == null) {
      return 1;
    }
    if (b.dueDate == null) {
      return -1;
    }
    return a.dueDate < b.dueDate ? -1 : 1;
  }

  /** Data de hoje como 'YYYY-MM-DD' (sem hora), no fuso local. */
  private todayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private readStoredTasks(): Task[] {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(TASKS_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // localStorage indisponível ou JSON corrompido — começa vazio.
      return [];
    }
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        TASKS_STORAGE_KEY,
        JSON.stringify(this.tasks()),
      );
    } catch {
      // Falha silenciosa: o estado continua funcionando em memória.
    }
  }
}