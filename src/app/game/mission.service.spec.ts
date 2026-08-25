import '@angular/compiler';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { MissionService } from './mission.service';
import { GameService } from './game.service';
import { SettingsService } from './settings.service';
import { ApiService } from '../core/api.service';
import { Difficulty, Mission, XP_TABLE } from './game.types';

interface MockApi {
  getHero: ReturnType<typeof vi.fn>;
  putHero: ReturnType<typeof vi.fn>;
  addXp: ReturnType<typeof vi.fn>;
  deleteHero: ReturnType<typeof vi.fn>;
  getSettings: ReturnType<typeof vi.fn>;
  putSettings: ReturnType<typeof vi.fn>;
  listMissions: ReturnType<typeof vi.fn>;
  createMission: ReturnType<typeof vi.fn>;
  updateMission: ReturnType<typeof vi.fn>;
  setMissionComplete: ReturnType<typeof vi.fn>;
  deleteMission: ReturnType<typeof vi.fn>;
}

describe('MissionService', () => {
  let service: MissionService;
  let gameService: GameService;
  let settingsService: SettingsService;
  let mockApi: MockApi;
  let mockLocalStorage: Record<string, string>;
  let mockDocument: Document;

  function createMockApi(): MockApi {
    return {
      getHero: vi.fn(() => of(null)),
      putHero: vi.fn(() => of(undefined)),
      addXp: vi.fn(() => of(undefined)),
      deleteHero: vi.fn(() => of(undefined)),
      getSettings: vi.fn(() => of({})),
      putSettings: vi.fn(() => of(undefined)),
      // Sem backend por padrão: erro mantém o cache do localStorage.
      listMissions: vi.fn(() => throwError(() => new Error('no backend'))),
      createMission: vi.fn(() => of({} as Mission)),
      updateMission: vi.fn(() => of(undefined)),
      setMissionComplete: vi.fn(() => of(undefined)),
      deleteMission: vi.fn(() => of(undefined)),
    };
  }

  function createService(): void {
    const injector = Injector.create({
      providers: [
        MissionService,
        GameService,
        SettingsService,
        { provide: ApiService, useValue: mockApi },
        { provide: DOCUMENT, useValue: mockDocument },
        { provide: HttpClient, useValue: ({ request: vi.fn() } as unknown) as HttpClient },
      ],
    });

    runInInjectionContext(injector, () => {
      service = injector.get(MissionService);
      gameService = injector.get(GameService);
      settingsService = injector.get(SettingsService);
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
    createService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with an empty mission list', () => {
      expect(service.tasks()).toEqual([]);
    });

    it('should call api.listMissions on init', () => {
      expect(mockApi.listMissions).toHaveBeenCalledTimes(1);
    });

    it('should hydrate missions from localStorage on init', () => {
      const missions: Mission[] = [
        {
          id: 'mission-1',
          title: 'Stored mission',
          difficulty: 'media',
          dueDate: '2026-08-20',
          completed: false,
        },
      ];
      mockLocalStorage['ma.missions.v1'] = JSON.stringify(missions);

      createService();
      expect(service.tasks()).toEqual(missions);
    });

    it('should keep local cache when listMissions errors', () => {
      const missions: Mission[] = [
        { id: 'm1', title: 'Cached', difficulty: 'facil', completed: false },
      ];
      mockLocalStorage['ma.missions.v1'] = JSON.stringify(missions);

      mockApi.listMissions.mockReturnValue(throwError(() => new Error('401')));
      createService();
      expect(service.tasks()).toEqual(missions);
    });

    it('should set signal and cache when listMissions returns missions', () => {
      const missions: Mission[] = [
        { id: 'm1', title: 'From API', difficulty: 'facil', completed: false },
      ];
      mockApi.listMissions.mockReturnValue(of(missions));
      createService();

      expect(service.tasks()).toEqual(missions);
      expect(JSON.parse(mockLocalStorage['ma.missions.v1']!)).toEqual(missions);
    });

    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage['ma.missions.v1'] = 'not json';

      createService();
      expect(service.tasks()).toEqual([]);
    });

    it('should handle unavailable localStorage gracefully', () => {
      const brokenDocument = {
        defaultView: {
          localStorage: {
            getItem: () => {
              throw new Error('localStorage unavailable');
            },
          },
        },
      } as unknown as Document;

      const injector = Injector.create({
        providers: [
          MissionService,
          GameService,
          SettingsService,
          { provide: ApiService, useValue: mockApi },
          { provide: DOCUMENT, useValue: brokenDocument },
          { provide: HttpClient, useValue: ({ request: vi.fn() } as unknown) as HttpClient },
        ],
      });
      runInInjectionContext(injector, () => {
        const resilient = injector.get(MissionService);
        expect(resilient.tasks()).toEqual([]);
      });
    });
  });

  describe('migration from ma.tasks.v1', () => {
    it('should migrate valid legacy tasks to ma.missions.v1 and remove the old key', () => {
      const legacy = [
        {
          id: 't1',
          title: 'Legacy task',
          difficulty: 'media',
          dueDate: '2026-08-20',
          completed: false,
          completedAt: null,
        },
      ];
      mockLocalStorage['ma.tasks.v1'] = JSON.stringify(legacy);

      createService();
      expect(service.tasks()).toEqual(legacy);
      expect(JSON.parse(mockLocalStorage['ma.missions.v1']!)).toEqual(legacy);
      expect(mockLocalStorage['ma.tasks.v1']).toBeUndefined();
    });

    it('should ignore corrupt legacy data and start empty', () => {
      mockLocalStorage['ma.tasks.v1'] = 'not-json';

      createService();
      expect(service.tasks()).toEqual([]);
      expect(mockLocalStorage['ma.missions.v1']).toBeUndefined();
    });

    it('should not migrate when ma.missions.v1 is already present', () => {
      mockLocalStorage['ma.missions.v1'] = JSON.stringify([
        { id: 'm1', title: 'New mission', difficulty: 'facil', completed: false },
      ]);
      mockLocalStorage['ma.tasks.v1'] = JSON.stringify([
        { id: 't1', title: 'Old task', difficulty: 'media', completed: false },
      ]);

      createService();
      expect(service.tasks().map((m) => m.id)).toEqual(['m1']);
      expect(mockLocalStorage['ma.tasks.v1']).toBeDefined();
    });

    it('should filter invalid items during migration', () => {
      mockLocalStorage['ma.tasks.v1'] = JSON.stringify([
        { id: 'good', title: 'Good', difficulty: 'facil', completed: false },
        { id: 42, title: 'Bad id', difficulty: 'facil', completed: false },
        { title: 'No id', difficulty: 'media', completed: true },
        { id: 'bad-diff', title: 'Bad difficulty', difficulty: 'lendario', completed: false },
        { id: 'bad-completed', title: 'Bad completed', difficulty: 'epica', completed: 'yes' },
      ]);

      createService();
      expect(service.tasks().map((m) => m.id)).toEqual(['good']);
    });
  });

  describe('addMission', () => {
    it('should add a pending mission with generated id', () => {
      service.addMission('Write report', 'media');

      const missions = service.tasks();
      expect(missions).toHaveLength(1);
      expect(missions[0].title).toBe('Write report');
      expect(missions[0].difficulty).toBe('media');
      expect(missions[0].completed).toBe(false);
      expect(missions[0].id).toBeTruthy();
    });

    it('should accept an optional dueDate', () => {
      service.addMission('Pay bills', 'facil', '2026-08-25');

      expect(service.tasks()[0].dueDate).toBe('2026-08-25');
    });

    it('should leave dueDate undefined when not provided', () => {
      service.addMission('No due date', 'facil');

      expect(service.tasks()[0].dueDate).toBeUndefined();
    });

    it('should persist the new mission to localStorage', () => {
      service.addMission('Persisted mission', 'dificil');

      const stored = JSON.parse(mockLocalStorage['ma.missions.v1']!);
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('Persisted mission');
      expect(stored[0].difficulty).toBe('dificil');
    });

    it('should call api.createMission with the new mission', () => {
      service.addMission('Write report', 'media', '2026-08-25');

      expect(mockApi.createMission).toHaveBeenCalledTimes(1);
      expect(mockApi.createMission).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Write report',
          difficulty: 'media',
          dueDate: '2026-08-25',
          completed: false,
        }),
      );
    });
  });

  describe('completeMission', () => {
    beforeEach(() => {
      gameService.createHero('Test Hero', 'guerreiro');
    });

    it.each(Object.entries(XP_TABLE) as [Difficulty, number][])(
      'should award %s XP (%i) to the hero',
      (difficulty, xp) => {
        service.addMission('Mission', difficulty);
        const id = service.tasks()[0].id;

        service.completeMission(id);

        expect(gameService.hero()!.totalXp).toBe(xp);
      },
    );

    it('should mark the mission completed and set completedAt', () => {
      service.addMission('Mission', 'facil');
      const id = service.tasks()[0].id;

      service.completeMission(id);

      const mission = service.tasks()[0];
      expect(mission.completed).toBe(true);
      expect(mission.completedAt).toBeTruthy();
    });

    it('should persist the completed state', () => {
      service.addMission('Mission', 'facil');
      const id = service.tasks()[0].id;

      service.completeMission(id);

      const stored = JSON.parse(mockLocalStorage['ma.missions.v1']!);
      expect(stored[0].completed).toBe(true);
      expect(stored[0].completedAt).toBeTruthy();
    });

    it('should call api.setMissionComplete(true) and gameService.addXp', () => {
      service.addMission('Mission', 'dificil');
      const id = service.tasks()[0].id;
      const addXpSpy = vi.spyOn(gameService, 'addXp');

      service.completeMission(id);

      expect(mockApi.setMissionComplete).toHaveBeenCalledWith(id, true);
      expect(addXpSpy).toHaveBeenCalledWith(XP_TABLE['dificil']);
    });

    it('should be a no-op for an unknown id', () => {
      const addXpSpy = vi.spyOn(gameService, 'addXp');

      expect(() => service.completeMission('missing-id')).not.toThrow();
      expect(gameService.hero()!.totalXp).toBe(0);
      expect(addXpSpy).not.toHaveBeenCalled();
      expect(mockApi.setMissionComplete).not.toHaveBeenCalled();
    });
  });

  describe('undoCompleteMission', () => {
    beforeEach(() => {
      gameService.createHero('Test Hero', 'guerreiro');
    });

    it('should subtract the awarded XP from the hero', () => {
      service.addMission('Mission', 'epica');
      const id = service.tasks()[0].id;
      service.completeMission(id);
      expect(gameService.hero()!.totalXp).toBe(100);

      service.undoCompleteMission(id);

      expect(gameService.hero()!.totalXp).toBe(0);
    });

    it('should mark the mission pending again and clear completedAt', () => {
      service.addMission('Mission', 'media');
      const id = service.tasks()[0].id;
      service.completeMission(id);

      service.undoCompleteMission(id);

      const mission = service.tasks()[0];
      expect(mission.completed).toBe(false);
      expect(mission.completedAt).toBeNull();
    });

    it('should persist the undone state', () => {
      service.addMission('Mission', 'media');
      const id = service.tasks()[0].id;
      service.completeMission(id);

      service.undoCompleteMission(id);

      const stored = JSON.parse(mockLocalStorage['ma.missions.v1']!);
      expect(stored[0].completed).toBe(false);
      expect(stored[0].completedAt).toBeNull();
    });

    it('should call api.setMissionComplete(false) and gameService.addXp(-xp)', () => {
      service.addMission('Mission', 'epica');
      const id = service.tasks()[0].id;
      service.completeMission(id);
      const addXpSpy = vi.spyOn(gameService, 'addXp');

      service.undoCompleteMission(id);

      expect(mockApi.setMissionComplete).toHaveBeenCalledWith(id, false);
      expect(addXpSpy).toHaveBeenCalledWith(-XP_TABLE['epica']);
    });
  });

  describe('deleteMission', () => {
    beforeEach(() => {
      gameService.createHero('Test Hero', 'guerreiro');
    });

    it('should remove a pending mission', () => {
      service.addMission('Pending mission', 'facil');
      const id = service.tasks()[0].id;

      service.deleteMission(id);

      expect(service.tasks()).toEqual([]);
    });

    it('should keep XP earned by a completed mission', () => {
      service.addMission('Completed mission', 'dificil');
      const id = service.tasks()[0].id;
      service.completeMission(id);
      expect(gameService.hero()!.totalXp).toBe(35);

      service.deleteMission(id);

      expect(service.tasks()).toEqual([]);
      expect(gameService.hero()!.totalXp).toBe(35);
    });

    it('should persist the deletion', () => {
      service.addMission('To delete', 'facil');
      const id = service.tasks()[0].id;

      service.deleteMission(id);

      const stored = JSON.parse(mockLocalStorage['ma.missions.v1']!);
      expect(stored).toEqual([]);
    });

    it('should call api.deleteMission with the id', () => {
      service.addMission('To delete', 'facil');
      const id = service.tasks()[0].id;

      service.deleteMission(id);

      expect(mockApi.deleteMission).toHaveBeenCalledWith(id);
    });
  });

  describe('editMission', () => {
    it('should update title, difficulty and dueDate of a pending mission', () => {
      service.addMission('Original', 'facil', '2026-08-20');
      const id = service.tasks()[0].id;

      service.editMission(id, { title: 'Edited', difficulty: 'epica', dueDate: '2026-08-30' });

      const mission = service.tasks()[0];
      expect(mission.title).toBe('Edited');
      expect(mission.difficulty).toBe('epica');
      expect(mission.dueDate).toBe('2026-08-30');
    });

    it('should call api.updateMission with the id and patch', () => {
      service.addMission('Original', 'facil', '2026-08-20');
      const id = service.tasks()[0].id;

      service.editMission(id, { title: 'Edited', difficulty: 'epica', dueDate: '2026-08-30' });

      expect(mockApi.updateMission).toHaveBeenCalledWith(id, {
        title: 'Edited',
        difficulty: 'epica',
        dueDate: '2026-08-30',
      });
    });

    it('should reject edits on a completed mission', () => {
      service.addMission('Done mission', 'facil');
      const id = service.tasks()[0].id;
      service.completeMission(id);

      service.editMission(id, { title: 'Hacked' });

      expect(service.tasks()[0].title).toBe('Done mission');
      expect(mockApi.updateMission).not.toHaveBeenCalled();
    });

    it('should be a no-op for an unknown id', () => {
      expect(() => service.editMission('missing-id', { title: 'X' })).not.toThrow();
      expect(mockApi.updateMission).not.toHaveBeenCalled();
    });
  });

  describe('pendingTasks', () => {
    it('should only include non-completed missions', () => {
      service.addMission('Pending A', 'facil');
      service.addMission('Pending B', 'media');
      const doneId = service.tasks()[1].id;
      service.completeMission(doneId);

      const pending = service.pendingTasks();
      expect(pending).toHaveLength(1);
      expect(pending[0].task.title).toBe('Pending A');
    });

    it('should sort by dueDate ascending with nulls last', () => {
      service.addMission('No date', 'facil');
      service.addMission('Later', 'facil', '2026-08-25');
      service.addMission('Soon', 'facil', '2026-08-19');

      const titles = service.pendingTasks().map((row) => row.task.title);
      expect(titles).toEqual(['Soon', 'Later', 'No date']);
    });

    it('should flag missions overdue when dueDate is before today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T12:00:00'));

      service.addMission('Overdue', 'facil', '2026-08-17');
      service.addMission('Today', 'facil', '2026-08-18');
      service.addMission('Future', 'facil', '2026-08-19');
      service.addMission('No date', 'facil');

      const rows = service.pendingTasks();
      const byTitle = Object.fromEntries(rows.map((row) => [row.task.title, row.overdue]));
      expect(byTitle['Overdue']).toBe(true);
      expect(byTitle['Today']).toBe(false);
      expect(byTitle['Future']).toBe(false);
      expect(byTitle['No date']).toBe(false);
    });
  });

  describe('completedTasks', () => {
    it('should only include completed missions', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addMission('Pending', 'facil');
      service.addMission('Done 1', 'facil');
      service.addMission('Done 2', 'media');
      service.completeMission(service.tasks()[1].id);
      service.completeMission(service.tasks()[2].id);

      const completed = service.completedTasks();
      expect(completed).toHaveLength(2);
      expect(completed.map((m) => m.title)).toEqual(['Done 1', 'Done 2']);
    });

    it('should sort by completedAt descending (most recent first)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addMission('First done', 'facil');
      service.addMission('Second done', 'facil');
      service.completeMission(service.tasks()[0].id);

      vi.setSystemTime(new Date('2026-08-18T11:00:00'));
      service.completeMission(service.tasks()[1].id);

      const titles = service.completedTasks().map((m) => m.title);
      expect(titles).toEqual(['Second done', 'First done']);
    });
  });

  describe('purgeExpired', () => {
    beforeEach(() => {
      gameService.createHero('Test Hero', 'guerreiro');
      settingsService.setRetentionDays(7);
    });

    it('should remove completed missions older than the retention window', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addMission('Old done', 'facil');
      service.completeMission(service.tasks()[0].id);

      vi.setSystemTime(new Date('2026-08-28T10:00:00'));
      service.purgeExpired();

      expect(service.tasks()).toEqual([]);
    });

    it('should keep completed missions inside the retention window', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addMission('Recent done', 'facil');
      service.completeMission(service.tasks()[0].id);

      vi.setSystemTime(new Date('2026-08-20T10:00:00'));
      service.purgeExpired();

      expect(service.tasks()).toHaveLength(1);
    });

    it('should purge without touching hero XP or calling the API', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addMission('Old done', 'dificil');
      service.completeMission(service.tasks()[0].id);
      expect(gameService.hero()!.totalXp).toBe(35);

      vi.setSystemTime(new Date('2026-08-28T10:00:00'));
      const addXpSpy = vi.spyOn(gameService, 'addXp');
      service.purgeExpired();

      expect(service.tasks()).toEqual([]);
      expect(gameService.hero()!.totalXp).toBe(35);
      expect(addXpSpy).not.toHaveBeenCalled();
      expect(mockApi.deleteMission).not.toHaveBeenCalled();
    });

    it('should never purge completed missions without completedAt', () => {
      mockLocalStorage['ma.missions.v1'] = JSON.stringify([
        {
          id: 'no-date',
          title: 'No completedAt',
          difficulty: 'facil',
          completed: true,
          completedAt: null,
        },
      ]);

      createService();
      settingsService.setRetentionDays(7);
      service.purgeExpired();

      expect(service.tasks()).toHaveLength(1);
    });

    it('should not purge anything when retention is 0', () => {
      settingsService.setRetentionDays(0);
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addMission('Old done', 'facil');
      service.completeMission(service.tasks()[0].id);

      vi.setSystemTime(new Date('2026-08-28T10:00:00'));
      service.purgeExpired();

      expect(service.tasks()).toHaveLength(1);
    });

    it('should purge expired missions during hydration', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-28T10:00:00'));
      mockLocalStorage['ma.settings.v1'] = JSON.stringify({ retentionDays: 7 });
      mockLocalStorage['ma.missions.v1'] = JSON.stringify([
        {
          id: 'old',
          title: 'Old done',
          difficulty: 'facil',
          completed: true,
          completedAt: '2026-08-10T10:00:00.000Z',
        },
        {
          id: 'recent',
          title: 'Recent done',
          difficulty: 'facil',
          completed: true,
          completedAt: '2026-08-25T10:00:00.000Z',
        },
      ]);

      createService();
      expect(service.tasks().map((m) => m.id)).toEqual(['recent']);
    });

    it('should purge expired missions inside persist after a mutation', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addMission('Old done', 'facil');
      service.completeMission(service.tasks()[0].id);

      vi.setSystemTime(new Date('2026-08-28T10:00:00'));
      service.addMission('New mission', 'facil');

      const titles = service.tasks().map((m) => m.title);
      expect(titles).toEqual(['New mission']);
    });
  });
});
