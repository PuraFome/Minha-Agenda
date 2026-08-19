import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { vi } from 'vitest';
import { TaskService } from './task.service';
import { GameService } from './game.service';
import { Difficulty, Task, XP_TABLE } from './game.types';

describe('TaskService', () => {
  let service: TaskService;
  let gameService: GameService;
  let mockLocalStorage: Record<string, string>;
  let mockDocument: Document;

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

    TestBed.configureTestingModule({
      providers: [
        GameService,
        TaskService,
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    });

    service = TestBed.inject(TaskService);
    gameService = TestBed.inject(GameService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with an empty task list', () => {
      expect(service.tasks()).toEqual([]);
    });

    it('should hydrate tasks from localStorage on init', () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Stored task',
          difficulty: 'media',
          dueDate: '2026-08-20',
          completed: false,
        },
      ];
      mockLocalStorage['ma.tasks.v1'] = JSON.stringify(tasks);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          GameService,
          TaskService,
          { provide: DOCUMENT, useValue: mockDocument },
        ],
      });

      const hydrated = TestBed.inject(TaskService);
      expect(hydrated.tasks()).toEqual(tasks);
    });

    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage['ma.tasks.v1'] = 'not json';

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          GameService,
          TaskService,
          { provide: DOCUMENT, useValue: mockDocument },
        ],
      });

      const hydrated = TestBed.inject(TaskService);
      expect(hydrated.tasks()).toEqual([]);
    });

    it('should handle unavailable localStorage gracefully', () => {
      TestBed.resetTestingModule();
      const brokenDocument = {
        defaultView: {
          localStorage: {
            getItem: () => {
              throw new Error('localStorage unavailable');
            },
          },
        },
      } as unknown as Document;

      TestBed.configureTestingModule({
        providers: [
          GameService,
          TaskService,
          { provide: DOCUMENT, useValue: brokenDocument },
        ],
      });

      const resilient = TestBed.inject(TaskService);
      expect(resilient.tasks()).toEqual([]);
    });
  });

  describe('addTask', () => {
    it('should add a pending task with generated id', () => {
      service.addTask('Write report', 'media');

      const tasks = service.tasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Write report');
      expect(tasks[0].difficulty).toBe('media');
      expect(tasks[0].completed).toBe(false);
      expect(tasks[0].id).toBeTruthy();
    });

    it('should accept an optional dueDate', () => {
      service.addTask('Pay bills', 'facil', '2026-08-25');

      expect(service.tasks()[0].dueDate).toBe('2026-08-25');
    });

    it('should leave dueDate undefined when not provided', () => {
      service.addTask('No due date', 'facil');

      expect(service.tasks()[0].dueDate).toBeUndefined();
    });

    it('should persist the new task to localStorage', () => {
      service.addTask('Persisted task', 'dificil');

      const stored = JSON.parse(mockLocalStorage['ma.tasks.v1']!);
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('Persisted task');
      expect(stored[0].difficulty).toBe('dificil');
    });
  });

  describe('completeTask', () => {
    beforeEach(() => {
      gameService.createHero('Test Hero', 'guerreiro');
    });

    it.each(Object.entries(XP_TABLE) as [Difficulty, number][])(
      'should award %s XP (%i) to the hero',
      (difficulty, xp) => {
        service.addTask('Task', difficulty);
        const id = service.tasks()[0].id;

        service.completeTask(id);

        expect(gameService.hero()!.totalXp).toBe(xp);
      },
    );

    it('should mark the task completed and set completedAt', () => {
      service.addTask('Task', 'facil');
      const id = service.tasks()[0].id;

      service.completeTask(id);

      const task = service.tasks()[0];
      expect(task.completed).toBe(true);
      expect(task.completedAt).toBeTruthy();
    });

    it('should persist the completed state', () => {
      service.addTask('Task', 'facil');
      const id = service.tasks()[0].id;

      service.completeTask(id);

      const stored = JSON.parse(mockLocalStorage['ma.tasks.v1']!);
      expect(stored[0].completed).toBe(true);
      expect(stored[0].completedAt).toBeTruthy();
    });

    it('should be a no-op for an unknown id', () => {
      expect(() => service.completeTask('missing-id')).not.toThrow();
      expect(gameService.hero()!.totalXp).toBe(0);
    });
  });

  describe('undoComplete', () => {
    beforeEach(() => {
      gameService.createHero('Test Hero', 'guerreiro');
    });

    it('should subtract the awarded XP from the hero', () => {
      service.addTask('Task', 'epica');
      const id = service.tasks()[0].id;
      service.completeTask(id);
      expect(gameService.hero()!.totalXp).toBe(100);

      service.undoComplete(id);

      expect(gameService.hero()!.totalXp).toBe(0);
    });

    it('should mark the task pending again and clear completedAt', () => {
      service.addTask('Task', 'media');
      const id = service.tasks()[0].id;
      service.completeTask(id);

      service.undoComplete(id);

      const task = service.tasks()[0];
      expect(task.completed).toBe(false);
      expect(task.completedAt).toBeNull();
    });

    it('should persist the undone state', () => {
      service.addTask('Task', 'media');
      const id = service.tasks()[0].id;
      service.completeTask(id);

      service.undoComplete(id);

      const stored = JSON.parse(mockLocalStorage['ma.tasks.v1']!);
      expect(stored[0].completed).toBe(false);
      expect(stored[0].completedAt).toBeNull();
    });
  });

  describe('deleteTask', () => {
    beforeEach(() => {
      gameService.createHero('Test Hero', 'guerreiro');
    });

    it('should remove a pending task', () => {
      service.addTask('Pending task', 'facil');
      const id = service.tasks()[0].id;

      service.deleteTask(id);

      expect(service.tasks()).toEqual([]);
    });

    it('should keep XP earned by a completed task', () => {
      service.addTask('Completed task', 'dificil');
      const id = service.tasks()[0].id;
      service.completeTask(id);
      expect(gameService.hero()!.totalXp).toBe(35);

      service.deleteTask(id);

      expect(service.tasks()).toEqual([]);
      expect(gameService.hero()!.totalXp).toBe(35);
    });

    it('should persist the deletion', () => {
      service.addTask('To delete', 'facil');
      const id = service.tasks()[0].id;

      service.deleteTask(id);

      const stored = JSON.parse(mockLocalStorage['ma.tasks.v1']!);
      expect(stored).toEqual([]);
    });
  });

  describe('editTask', () => {
    it('should update title, difficulty and dueDate of a pending task', () => {
      service.addTask('Original', 'facil', '2026-08-20');
      const id = service.tasks()[0].id;

      service.editTask(id, { title: 'Edited', difficulty: 'epica', dueDate: '2026-08-30' });

      const task = service.tasks()[0];
      expect(task.title).toBe('Edited');
      expect(task.difficulty).toBe('epica');
      expect(task.dueDate).toBe('2026-08-30');
    });

    it('should reject edits on a completed task', () => {
      service.addTask('Done task', 'facil');
      const id = service.tasks()[0].id;
      service.completeTask(id);

      service.editTask(id, { title: 'Hacked' });

      expect(service.tasks()[0].title).toBe('Done task');
    });

    it('should be a no-op for an unknown id', () => {
      expect(() => service.editTask('missing-id', { title: 'X' })).not.toThrow();
    });
  });

  describe('pendingTasks', () => {
    it('should only include non-completed tasks', () => {
      service.addTask('Pending A', 'facil');
      service.addTask('Pending B', 'media');
      const doneId = service.tasks()[1].id;
      service.completeTask(doneId);

      const pending = service.pendingTasks();
      expect(pending).toHaveLength(1);
      expect(pending[0].task.title).toBe('Pending A');
    });

    it('should sort by dueDate ascending with nulls last', () => {
      service.addTask('No date', 'facil');
      service.addTask('Later', 'facil', '2026-08-25');
      service.addTask('Soon', 'facil', '2026-08-19');

      const titles = service.pendingTasks().map((row) => row.task.title);
      expect(titles).toEqual(['Soon', 'Later', 'No date']);
    });

    it('should flag tasks overdue when dueDate is before today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T12:00:00'));

      service.addTask('Overdue', 'facil', '2026-08-17');
      service.addTask('Today', 'facil', '2026-08-18');
      service.addTask('Future', 'facil', '2026-08-19');
      service.addTask('No date', 'facil');

      const rows = service.pendingTasks();
      const byTitle = Object.fromEntries(rows.map((row) => [row.task.title, row.overdue]));
      expect(byTitle['Overdue']).toBe(true);
      expect(byTitle['Today']).toBe(false);
      expect(byTitle['Future']).toBe(false);
      expect(byTitle['No date']).toBe(false);
    });
  });

  describe('completedTasks', () => {
    it('should only include completed tasks', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addTask('Pending', 'facil');
      service.addTask('Done 1', 'facil');
      service.addTask('Done 2', 'media');
      service.completeTask(service.tasks()[1].id);
      service.completeTask(service.tasks()[2].id);

      const completed = service.completedTasks();
      expect(completed).toHaveLength(2);
      expect(completed.map((t) => t.title)).toEqual(['Done 1', 'Done 2']);
    });

    it('should sort by completedAt descending (most recent first)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-18T10:00:00'));
      service.addTask('First done', 'facil');
      service.addTask('Second done', 'facil');
      service.completeTask(service.tasks()[0].id);

      vi.setSystemTime(new Date('2026-08-18T11:00:00'));
      service.completeTask(service.tasks()[1].id);

      const titles = service.completedTasks().map((t) => t.title);
      expect(titles).toEqual(['Second done', 'First done']);
    });
  });
});