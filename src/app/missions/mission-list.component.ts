import { Component, computed, inject, input, signal } from '@angular/core';
import { MissionService } from '../game/mission.service';
import { SettingsService } from '../game/settings.service';
import { MissionFormComponent } from './mission-form.component';
import { Difficulty, Mission, XP_TABLE } from '../game/game.types';
import { NpcDialogComponent } from '../taberna/npc-dialog.component';
import { TabernaService } from '../taberna/taberna.service';
import { NPCS } from '../taberna/taberna.data';
import { Npc } from '../taberna/taberna.types';

@Component({
  selector: 'app-mission-list',
  imports: [MissionFormComponent, NpcDialogComponent],
  templateUrl: './mission-list.component.html',
  styleUrl: './mission-list.component.scss',
})
export class MissionListComponent {
  private readonly missionService = inject(MissionService);
  private readonly settingsService = inject(SettingsService);
  private readonly tabernaService = inject(TabernaService);

  /** Seção a renderizar: pendentes, concluídas ou ambas. */
  readonly section = input<'pending' | 'completed' | 'all'>('all');

  readonly showPending = computed(() => this.section() === 'pending' || this.section() === 'all');
  readonly showCompleted = computed(
    () => this.section() === 'completed' || this.section() === 'all',
  );

  readonly pendingTasks = this.missionService.pendingTasks;
  readonly completedTasks = this.missionService.completedTasks;

  readonly retentionDays = this.settingsService.retentionDays;

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

  readonly showNpcDialog = signal<{ npc: Npc; mission: Mission } | null>(null);

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
    const m = this.missionService.tasks().find((t) => t.id === id);
    if (m && m.source === 'npc' && m.npcId) {
      this.tabernaService.recordCompletion(m.npcId);
      const npc = NPCS.find((n) => n.id === m.npcId);
      if (npc) {
        this.showNpcDialog.set({ npc, mission: m });
      }
    }
  }

  onNpcRepeat(): void {
    const dialog = this.showNpcDialog();
    if (dialog) {
      this.tabernaService.repeatMission(dialog.mission);
      this.showNpcDialog.set(null);
    }
  }

  undoCompleteMission(id: string): void {
    this.missionService.undoCompleteMission(id);
  }

  deleteMission(id: string): void {
    this.missionService.deleteMission(id);
  }

  /** Dica de retenção para missão concluída, ou null quando não se aplica. */
  retentionHint(mission: Mission): string | null {
    const days = this.retentionDays();
    if (days <= 0 || !mission.completedAt) {
      return null;
    }
    return `será arquivada em ${days} dias`;
  }

  /** Converte 'YYYY-MM-DD' em 'DD/MM/YYYY' para exibição. */
  formatDueDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
}