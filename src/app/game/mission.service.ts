import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { GameService } from './game.service';
import { SettingsService } from './settings.service';
import { DIFFICULTIES, Difficulty, Mission, XP_TABLE } from './game.types';

const MISSIONS_STORAGE_KEY = 'ma.missions.v1';
const LEGACY_TASKS_STORAGE_KEY = 'ma.tasks.v1';

/** Linha de missão pendente com flag de atraso calculada. */
export interface PendingMissionRow {
  task: Mission;
  overdue: boolean;
}

/**
 * Gerencia a lista de missões e a integração com o XP do herói.
 *
 * - Persiste as missões em localStorage (key `ma.missions.v1`) com try/catch.
 * - Migração one-way: se `ma.missions.v1` ausente e `ma.tasks.v1` presente,
 *   valida e converte os dados antigos, escreve a nova key e remove a antiga.
 * - Completar missão concede XP (XP_TABLE[difficulty]); desfazer subtrai.
 * - Excluir missão completada mantém o XP já ganho.
 * - Edição só é permitida em missões pendentes.
 * - Retenção: missões concluídas são removidas após `retentionDays` dias
 *   (0 = manter para sempre); o purge nunca altera o XP do herói.
 */
@Injectable({ providedIn: 'root' })
export class MissionService {
  private readonly document = inject(DOCUMENT);
  private readonly gameService = inject(GameService);
  private readonly settingsService = inject(SettingsService);

  /** Todas as missões, na ordem de criação. */
  readonly tasks = signal<Mission[]>(this.readStoredMissions());

  /** Missões pendentes, ordenadas por dueDate asc (nulls por último), com flag de atraso. */
  readonly pendingTasks = computed<PendingMissionRow[]>(() => {
    const today = this.todayDateString();
    return this.tasks()
      .filter((mission) => !mission.completed)
      .map((mission) => ({ task: mission, overdue: this.isOverdue(mission, today) }))
      .sort((a, b) => this.compareDueDates(a.task, b.task));
  });

  /** Missões concluídas, ordenadas por completedAt desc (mais recentes primeiro). */
  readonly completedTasks = computed<Mission[]>(() =>
    this.tasks()
      .filter((mission) => mission.completed)
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      }),
  );

  /** Cria uma missão pendente com id gerado via crypto.randomUUID(). */
  addMission(title: string, difficulty: Difficulty, dueDate?: string | null): void {
    const mission: Mission = {
      id: crypto.randomUUID(),
      title,
      difficulty,
      dueDate: dueDate ?? undefined,
      completed: false,
      completedAt: null,
    };
    this.tasks.update((missions) => [...missions, mission]);
    this.persist();
  }

  /** Edita título/dificuldade/data de uma missão pendente. Missões concluídas são ignoradas. */
  editMission(
    id: string,
    updates: Partial<Pick<Mission, 'title' | 'difficulty' | 'dueDate'>>,
  ): void {
    this.tasks.update((missions) =>
      missions.map((mission) =>
        mission.id === id && !mission.completed ? { ...mission, ...updates } : mission,
      ),
    );
    this.persist();
  }

  /** Conclui a missão, marca completedAt e concede o XP correspondente. */
  completeMission(id: string): void {
    const mission = this.tasks().find((m) => m.id === id);
    if (!mission || mission.completed) {
      return;
    }
    this.gameService.addXp(XP_TABLE[mission.difficulty]);
    this.tasks.update((missions) =>
      missions.map((m) =>
        m.id === id ? { ...m, completed: true, completedAt: new Date().toISOString() } : m,
      ),
    );
    this.persist();
  }

  /** Desfaz a conclusão, subtrai o XP concedido e libera a edição. */
  undoCompleteMission(id: string): void {
    const mission = this.tasks().find((m) => m.id === id);
    if (!mission || !mission.completed) {
      return;
    }
    this.gameService.addXp(-XP_TABLE[mission.difficulty]);
    this.tasks.update((missions) =>
      missions.map((m) => (m.id === id ? { ...m, completed: false, completedAt: null } : m)),
    );
    this.persist();
  }

  /** Remove a missão. Se concluída, o XP já ganho permanece. */
  deleteMission(id: string): void {
    this.tasks.update((missions) => missions.filter((m) => m.id !== id));
    this.persist();
  }

  /**
   * Remove missões concluídas cujo `completedAt` é mais antigo que
   * `retentionDays` dias. Missões sem `completedAt` nunca são removidas.
   * Nunca altera o XP do herói.
   */
  purgeExpired(): void {
    const current = this.tasks();
    const purged = this.applyRetentionPurge(current);
    if (purged.length !== current.length) {
      this.tasks.set(purged);
      this.writeStoredMissions(purged);
    }
  }

  /** Atrasada = tem dueDate anterior a hoje (comparação só de data) e não está concluída. */
  private isOverdue(mission: Mission, today: string): boolean {
    return !mission.completed && !!mission.dueDate && mission.dueDate < today;
  }

  private compareDueDates(a: Mission, b: Mission): number {
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

  private readStoredMissions(): Mission[] {
    this.migrateLegacyTasks();
    const missions = this.parseStoredMissions();
    const purged = this.applyRetentionPurge(missions);
    if (purged.length !== missions.length) {
      this.writeStoredMissions(purged);
    }
    return purged;
  }

  private parseStoredMissions(): Mission[] {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(MISSIONS_STORAGE_KEY);
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

  /**
   * Migração one-way: converte `ma.tasks.v1` em `ma.missions.v1` e remove a
   * key antiga. Dados corrompidos/inválidos são ignorados (começa vazio).
   */
  private migrateLegacyTasks(): void {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) {
        return;
      }
      if (storage.getItem(MISSIONS_STORAGE_KEY) !== null) {
        return;
      }
      const legacy = storage.getItem(LEGACY_TASKS_STORAGE_KEY);
      if (legacy === null) {
        return;
      }
      const parsed = JSON.parse(legacy);
      if (!Array.isArray(parsed)) {
        return;
      }
      const missions = parsed.filter((item): item is Mission => this.isValidMission(item));
      storage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions));
      storage.removeItem(LEGACY_TASKS_STORAGE_KEY);
    } catch {
      // Dados corrompidos ou localStorage indisponível — ignora, começa vazio.
    }
  }

  private isValidMission(value: unknown): value is Mission {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate['id'] === 'string' &&
      typeof candidate['title'] === 'string' &&
      typeof candidate['completed'] === 'boolean' &&
      this.isDifficulty(candidate['difficulty'])
    );
  }

  private isDifficulty(value: unknown): value is Difficulty {
    return DIFFICULTIES.some((difficulty) => difficulty === value);
  }

  /** Filtra missões concluídas expiradas; missões sem completedAt nunca são removidas. */
  private applyRetentionPurge(missions: Mission[]): Mission[] {
    const retentionDays = this.settingsService.retentionDays();
    if (retentionDays <= 0) {
      return missions;
    }
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    return missions.filter((mission) => {
      if (!mission.completed || !mission.completedAt) {
        return true;
      }
      return new Date(mission.completedAt).getTime() >= cutoff;
    });
  }

  private persist(): void {
    this.purgeExpired();
    this.writeStoredMissions(this.tasks());
  }

  private writeStoredMissions(missions: Mission[]): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        MISSIONS_STORAGE_KEY,
        JSON.stringify(missions),
      );
    } catch {
      // Falha silenciosa: o estado continua funcionando em memória.
    }
  }
}