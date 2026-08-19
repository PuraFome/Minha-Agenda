import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { GameService } from './game.service';
import { Hero, XP_TABLE } from './game.types';

describe('GameService', () => {
  let service: GameService;
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
      providers: [GameService, { provide: DOCUMENT, useValue: mockDocument }],
    });

    service = TestBed.inject(GameService);
  });

  describe('initial state', () => {
    it('should be null when no hero in localStorage', () => {
      expect(service.hero()).toBeNull();
    });

    it('should load hero from localStorage on init', () => {
      const hero: Hero = {
        name: 'Test Hero',
        heroClass: 'guerreiro',
        totalXp: 150,
      };
      mockLocalStorage['ma.hero.v1'] = JSON.stringify(hero);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [GameService, { provide: DOCUMENT, useValue: mockDocument }],
      });

      const hydrated = TestBed.inject(GameService);
      expect(hydrated.hero()).toEqual(hero);
    });

    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage['ma.hero.v1'] = 'invalid json';

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [GameService, { provide: DOCUMENT, useValue: mockDocument }],
      });

      const hydrated = TestBed.inject(GameService);
      expect(hydrated.hero()).toBeNull();
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
        providers: [GameService, { provide: DOCUMENT, useValue: brokenDocument }],
      });

      const resilient = TestBed.inject(GameService);
      expect(resilient.hero()).toBeNull();
    });
  });

  describe('createHero', () => {
    it('should create a hero with given name and class', () => {
      service.createHero('Aragorn', 'guerreiro');

      const hero = service.hero();
      expect(hero).not.toBeNull();
      expect(hero!.name).toBe('Aragorn');
      expect(hero!.heroClass).toBe('guerreiro');
      expect(hero!.totalXp).toBe(0);
    });

    it('should persist hero to localStorage', () => {
      service.createHero('Legolas', 'mago');

      const stored = JSON.parse(mockLocalStorage['ma.hero.v1']!);
      expect(stored.name).toBe('Legolas');
      expect(stored.heroClass).toBe('mago');
      expect(stored.totalXp).toBe(0);
    });

    it('should overwrite an existing hero', () => {
      service.createHero('Old Hero', 'mago');
      service.createHero('New Hero', 'guerreiro');

      const hero = service.hero();
      expect(hero!.name).toBe('New Hero');
      expect(hero!.heroClass).toBe('guerreiro');
    });
  });

  describe('addXp', () => {
    beforeEach(() => {
      service.createHero('Test Hero', 'guerreiro');
    });

    it('should add XP to hero totalXp', () => {
      service.addXp(50);
      expect(service.hero()!.totalXp).toBe(50);
    });

    it('should accumulate XP across calls', () => {
      service.addXp(30);
      service.addXp(20);
      expect(service.hero()!.totalXp).toBe(50);
    });

    it('should persist updated XP to localStorage', () => {
      service.addXp(75);
      const stored = JSON.parse(mockLocalStorage['ma.hero.v1']!);
      expect(stored.totalXp).toBe(75);
    });

    it('should not throw when no hero exists', () => {
      service.resetHero();
      expect(() => service.addXp(10)).not.toThrow();
      expect(service.hero()).toBeNull();
    });

    it('should subtract XP on negative amount (undo)', () => {
      service.addXp(100);
      service.addXp(-35);
      expect(service.hero()!.totalXp).toBe(65);
    });

    it('should clamp totalXp at 0', () => {
      service.addXp(20);
      service.addXp(-50);
      expect(service.hero()!.totalXp).toBe(0);
    });
  });

  describe('level / progress / xpForNextLevel', () => {
    beforeEach(() => {
      service.createHero('Test Hero', 'guerreiro');
    });

    it('should be level 1, progress 0 at 0 XP', () => {
      expect(service.level()).toBe(1);
      expect(service.progress()).toBe(0);
      expect(service.xpForNextLevel()).toBe(100);
    });

    it('should be level 1 at 99 XP', () => {
      service.addXp(99);
      expect(service.level()).toBe(1);
      expect(service.progress()).toBe(99);
      expect(service.xpForNextLevel()).toBe(1);
    });

    it('should be level 2 at 100 XP', () => {
      service.addXp(100);
      expect(service.level()).toBe(2);
      expect(service.progress()).toBe(0);
      expect(service.xpForNextLevel()).toBe(100);
    });

    it('should be level 3 with progress 50 at 250 XP', () => {
      service.addXp(250);
      expect(service.level()).toBe(3);
      expect(service.progress()).toBe(50);
      expect(service.xpForNextLevel()).toBe(50);
    });

    it('should be level 6 at 500 XP', () => {
      service.addXp(500);
      expect(service.level()).toBe(6);
      expect(service.progress()).toBe(0);
    });

    it('should update reactively as XP changes', () => {
      expect(service.level()).toBe(1);
      service.addXp(150);
      expect(service.level()).toBe(2);
      service.addXp(100);
      expect(service.level()).toBe(3);
    });
  });

  describe('resetHero', () => {
    it('should set hero to null and remove from localStorage', () => {
      service.createHero('Test Hero', 'guerreiro');
      service.addXp(100);

      service.resetHero();

      expect(service.hero()).toBeNull();
      expect(mockLocalStorage['ma.hero.v1']).toBeUndefined();
    });

    it('should reset derived values to defaults', () => {
      service.createHero('Test Hero', 'guerreiro');
      service.addXp(250);
      service.resetHero();

      expect(service.level()).toBe(1);
      expect(service.progress()).toBe(0);
      expect(service.xpForNextLevel()).toBe(100);
    });
  });

  describe('XP_TABLE', () => {
    it('should map each difficulty to the planned XP value', () => {
      expect(XP_TABLE.facil).toBe(10);
      expect(XP_TABLE.media).toBe(20);
      expect(XP_TABLE.dificil).toBe(35);
      expect(XP_TABLE['muito-dificil']).toBe(60);
      expect(XP_TABLE.epica).toBe(100);
    });
  });
});