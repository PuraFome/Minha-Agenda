import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ApiService } from '../core/api.service';
import { MissionService } from '../game/mission.service';
import {
  Npc,
  NpcFriendshipEntry,
  NpcFriendshipMap,
  NpcMissionTemplate,
} from './taberna.types';
import { Mission } from '../game/game.types';

const FRIENDSHIP_STORAGE_KEY = 'ma.npc-friendship.v1';

/**
 * Gerencia a amizade com NPCs (sincronizada com o backend), o aceite/repetição
 * de missões e o gating de desbloqueio.
 *
 * - Persiste o mapa de amizade em localStorage (key `ma.npc-friendship.v1`) com try/catch.
 * - Backend wins sobre localStorage quando presente; 401/network → mantém o valor local.
 * - Datas de prazo usam aritmética de calendário LOCAL (nunca UTC/ISO).
 */
@Injectable({ providedIn: 'root' })
export class TabernaService {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(ApiService);
  private readonly missionService = inject(MissionService);

  /** Mapa de amizade por NPC (id → entrada). */
  readonly friendship = signal<NpcFriendshipMap>(this.readStored());

  constructor() {
    // Backend wins over localStorage when present; 401/network → keep local value.
    this.api.getNpcFriendship().subscribe({
      next: (map) => {
        if (map && typeof map === 'object') {
          this.friendship.set(map as NpcFriendshipMap);
          this.persist();
        }
      },
      error: () => {
        // Mantém o valor do localStorage; silencioso.
      },
    });
  }

  /** Nível de amizade (missões concluídas) com o NPC. */
  levelOf(npcId: string): number {
    return this.friendship()[npcId]?.completedCount ?? 0;
  }

  /** Verdadeiro se o nível de amizade atinge o mínimo exigido pelo template. */
  isUnlocked(npcId: string, t: NpcMissionTemplate): boolean {
    return this.levelOf(npcId) >= t.minFriendship;
  }

  /** Registra a conclusão de uma missão de NPC: incrementa o contador e sincroniza. */
  recordCompletion(npcId: string): void {
    this.friendship.update((map) => {
      const current = map[npcId]?.completedCount ?? 0;
      const completedCount = current + 1;
      return {
        ...map,
        [npcId]: { completedCount, level: completedCount },
      };
    });
    this.persist();
    this.api.putNpcFriendship(this.friendship()).subscribe({ error: () => {} });
  }

  /** Aceita uma missão de NPC, calculando o prazo local (hoje + prazoDays). */
  accept(npc: Npc, t: NpcMissionTemplate): void {
    const dueDate = this.localDateString(this.addDays(this.today(), t.prazoDays));
    this.missionService.acceptNpcMission({
      title: t.title,
      difficulty: t.difficulty,
      dueDate,
      npcId: npc.id,
      npcName: npc.name,
      npcAvatar: npc.avatar,
      templateId: t.templateId,
    });
  }

  /** Repete uma missão já concluída, com prazo local = amanhã. */
  repeatMission(m: Mission): void {
    const dueDate = this.localDateString(this.addDays(this.today(), 1));
    this.missionService.acceptNpcMission({
      title: m.title,
      difficulty: m.difficulty,
      dueDate,
      npcId: m.npcId ?? '',
      npcName: m.npcName ?? '',
      npcAvatar: m.npcAvatar ?? '',
      templateId: m.templateId ?? '',
    });
  }

  /** Verdadeiro se há uma missão pendente (não concluída) para o NPC+template. */
  isAcceptedPending(npcId: string, templateId: string): boolean {
    return this.missionService
      .tasks()
      .some((m) => m.npcId === npcId && m.templateId === templateId && !m.completed);
  }

  private today(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private readStored(): NpcFriendshipMap {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(FRIENDSHIP_STORAGE_KEY);
      if (!stored) {
        return {};
      }
      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === 'object' ? (parsed as NpcFriendshipMap) : {};
    } catch {
      // localStorage indisponível ou JSON corrompido — começa vazio.
    }
    return {};
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        FRIENDSHIP_STORAGE_KEY,
        JSON.stringify(this.friendship()),
      );
    } catch {
      // Falha silenciosa: o estado continua funcionando em memória.
    }
  }
}
