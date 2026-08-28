import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { of } from 'rxjs';

import { TabernaService } from './taberna.service';
import { ApiService } from '../core/api.service';
import { MissionService } from '../game/mission.service';
import { Mission } from '../game/game.types';
import { Npc, NpcMissionTemplate } from './taberna.types';
import { NPCS } from './taberna.data';

interface MockApi {
  getNpcFriendship: ReturnType<typeof vi.fn>;
  putNpcFriendship: ReturnType<typeof vi.fn>;
}

interface MockMissionService {
  tasks: ReturnType<typeof signal<Mission[]>>;
  acceptNpcMission: ReturnType<typeof vi.fn>;
}

/** Local calendar math — mirrors TabernaService (never UTC/ISO). */
function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('TabernaService', () => {
  let service: TabernaService;
  let mockApi: MockApi;
  let mockMissionService: MockMissionService;
  let mockLocalStorage: Record<string, string>;
  let mockDocument: Document;

  const npc: Npc = NPCS[0];
  const template: NpcMissionTemplate = npc.missions[0];

  function createMockApi(): MockApi {
    return {
      getNpcFriendship: vi.fn(() => of({})),
      putNpcFriendship: vi.fn(() => of(undefined)),
    };
  }

  function createService(): void {
    const injector = Injector.create({
      providers: [
        TabernaService,
        { provide: ApiService, useValue: mockApi },
        { provide: MissionService, useValue: mockMissionService },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    });

    runInInjectionContext(injector, () => {
      service = injector.get(TabernaService);
    });
  }

  beforeEach(() => {
    mockLocalStorage = {};
    mockDocument = {
      defaultView: {
        localStorage: {
          getItem: (key: string) => mockLocalStorage[key] ?? null,
          setItem: (key: string, value: string) => {
            mockLocalStorage[key] = value;
          },
          removeItem: (key: string) => {
            delete mockLocalStorage[key];
          },
          clear: () => {
            mockLocalStorage = {};
          },
        },
      },
    } as unknown as Document;

    mockApi = createMockApi();
    mockMissionService = {
      tasks: signal<Mission[]>([]),
      acceptNpcMission: vi.fn(),
    };
    createService();
  });

  describe('levelOf', () => {
    it('should return 0 for an unknown npc', () => {
      expect(service.levelOf('does-not-exist')).toBe(0);
    });

    it('should return the completedCount for a known npc', () => {
      service.recordCompletion(npc.id);
      expect(service.levelOf(npc.id)).toBe(1);
    });
  });

  describe('isUnlocked', () => {
    it('should be true when level meets minFriendship', () => {
      const t: NpcMissionTemplate = { ...template, minFriendship: 0 };
      expect(service.isUnlocked(npc.id, t)).toBe(true);
    });

    it('should be false when level is below minFriendship', () => {
      const t: NpcMissionTemplate = { ...template, minFriendship: 3 };
      expect(service.isUnlocked(npc.id, t)).toBe(false);
    });

    it('should be true once enough completions are recorded', () => {
      service.recordCompletion(npc.id);
      service.recordCompletion(npc.id);
      service.recordCompletion(npc.id);
      const t: NpcMissionTemplate = { ...template, minFriendship: 3 };
      expect(service.isUnlocked(npc.id, t)).toBe(true);
    });
  });

  describe('accept', () => {
    it('should call missionService.acceptNpcMission with an npc-sourced mission and a local dueDate', () => {
      service.accept(npc, template);

      const expectedDue = localDateString(addDays(today(), template.prazoDays));
      expect(mockMissionService.acceptNpcMission).toHaveBeenCalledTimes(1);
      // TabernaService passes the params object; MissionService sets source:'npc' internally.
      expect(mockMissionService.acceptNpcMission).toHaveBeenCalledWith(
        expect.objectContaining({
          npcId: npc.id,
          npcName: npc.name,
          npcAvatar: npc.avatar,
          templateId: template.templateId,
          dueDate: expectedDue,
        }),
      );
    });

    it('should compute the dueDate as LOCAL today + prazoDays (YYYY-MM-DD)', () => {
      const t: NpcMissionTemplate = { ...template, prazoDays: 2 };
      service.accept(npc, t);

      const arg = mockMissionService.acceptNpcMission.mock.calls[0][0];
      expect(arg.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(arg.dueDate).toBe(localDateString(addDays(today(), 2)));
    });
  });

  describe('recordCompletion', () => {
    it('should increment completedCount and set level equal to completedCount', () => {
      service.recordCompletion(npc.id);

      const entry = service.friendship()[npc.id];
      expect(entry).toBeDefined();
      expect(entry!.completedCount).toBe(1);
      expect(entry!.level).toBe(1);
    });

    it('should call api.putNpcFriendship with the updated map', () => {
      service.recordCompletion(npc.id);

      expect(mockApi.putNpcFriendship).toHaveBeenCalledTimes(1);
      expect(mockApi.putNpcFriendship).toHaveBeenCalledWith(
        expect.objectContaining({ [npc.id]: { completedCount: 1, level: 1 } }),
      );
    });

    it('should accumulate across multiple completions', () => {
      service.recordCompletion(npc.id);
      service.recordCompletion(npc.id);
      service.recordCompletion(npc.id);

      const entry = service.friendship()[npc.id];
      expect(entry!.completedCount).toBe(3);
      expect(entry!.level).toBe(3);
      expect(mockApi.putNpcFriendship).toHaveBeenCalledTimes(3);
    });
  });

  describe('isAcceptedPending', () => {
    it('should be true when a matching pending mission exists', () => {
      mockMissionService.tasks.set([
        {
          id: 'm-1',
          title: template.title,
          difficulty: template.difficulty,
          completed: false,
          npcId: npc.id,
          templateId: template.templateId,
        } as Mission,
      ]);

      expect(service.isAcceptedPending(npc.id, template.templateId)).toBe(true);
    });

    it('should be false when no matching mission exists', () => {
      mockMissionService.tasks.set([]);
      expect(service.isAcceptedPending(npc.id, template.templateId)).toBe(false);
    });

    it('should be false once the matching mission is completed (so it does not vanish forever)', () => {
      mockMissionService.tasks.set([
        {
          id: 'm-1',
          title: template.title,
          difficulty: template.difficulty,
          completed: false,
          npcId: npc.id,
          templateId: template.templateId,
        } as Mission,
      ]);
      expect(service.isAcceptedPending(npc.id, template.templateId)).toBe(true);

      mockMissionService.tasks.update((tasks) =>
        tasks.map((m) =>
          m.npcId === npc.id && m.templateId === template.templateId
            ? { ...m, completed: true }
            : m,
        ),
      );
      expect(service.isAcceptedPending(npc.id, template.templateId)).toBe(false);
    });

    it('should ignore missions of other NPCs or templates', () => {
      mockMissionService.tasks.set([
        {
          id: 'm-other',
          title: 'Other',
          difficulty: 'facil',
          completed: false,
          npcId: 'someone-else',
          templateId: template.templateId,
        } as Mission,
      ]);
      expect(service.isAcceptedPending(npc.id, template.templateId)).toBe(false);
    });
  });
});
