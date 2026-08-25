import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameService } from './game.service';
import { ApiService } from '../core/api.service';
import { Hero, XP_TABLE } from './game.types';

describe('GameService', () => {
  let mockLocalStorage: Record<string, string>;
  let mockDocument: Document;
  let mockApi: {
    getHero: ReturnType<typeof vi.fn>;
    putHero: ReturnType<typeof vi.fn>;
    addXp: ReturnType<typeof vi.fn>;
    deleteHero: ReturnType<typeof vi.fn>;
  };
  let injector: Injector;
  let service: GameService;

  function buildService(): GameService {
    injector = Injector.create({
      providers: [
        { provide: DOCUMENT, useValue: mockDocument },
        { provide: HttpClient, useValue: {} },
        { provide: ApiService, useValue: mockApi },
      ],
    });
    return runInInjectionContext(injector, () => new GameService());
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

    mockApi = {
      getHero: vi.fn(() => of(null)),
      putHero: vi.fn(() => of(undefined)),
      addXp: vi.fn(() => of(undefined)),
      deleteHero: vi.fn(() => of(undefined)),
    };

    service = buildService();
  });

  describe('initial state', () => {
    it('should be null when no hero in localStorage', () => {
      expect(service.hero()).toBeNull();
    });

    it('should call api.getHero on construction', () => {
      expect(mockApi.getHero).toHaveBeenCalledTimes(1);
    });

    it('should load hero from localStorage on init', () => {
      const hero: Hero = {
        name: 'Test Hero',
        heroClass: 'guerreiro',
        totalXp: 150,
      };
      mockLocalStorage['ma.hero.v1'] = JSON.stringify(hero);

      const hydrated = buildService();
      expect(hydrated.hero()).toEqual(hero);
    });

    it('should override localStorage with backend hero on getHero success', () => {
      const backendHero: Hero = {
        name: 'Backend Hero',
        heroClass: 'mago',
        totalXp: 300,
      };
      mockApi.getHero = vi.fn(() => of(backendHero));

      const hydrated = buildService();
      expect(hydrated.hero()).toEqual(backendHero);
      expect(JSON.parse(mockLocalStorage['ma.hero.v1']!)).toEqual(backendHero);
    });

    it('should keep cache on getHero error (401/network)', () => {
      const cached: Hero = {
        name: 'Cached Hero',
        heroClass: 'ladino',
        totalXp: 75,
      };
      mockLocalStorage['ma.hero.v1'] = JSON.stringify(cached);
      mockApi.getHero = vi.fn(() => throwError(() => new Error('401')));

      const hydrated = buildService();
      expect(hydrated.hero()).toEqual(cached);
    });

    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage['ma.hero.v1'] = 'invalid json';

      const hydrated = buildService();
      expect(hydrated.hero()).toBeNull();
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

      injector = Injector.create({
        providers: [
          { provide: DOCUMENT, useValue: brokenDocument },
          { provide: HttpClient, useValue: {} },
          { provide: ApiService, useValue: mockApi },
        ],
      });
      const resilient = runInInjectionContext(injector, () => new GameService());

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

    it('should call api.putHero with the new hero', () => {
      service.createHero('Aragorn', 'guerreiro');
      expect(mockApi.putHero).toHaveBeenCalledWith({
        name: 'Aragorn',
        heroClass: 'guerreiro',
        totalXp: 0,
      });
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

    it('should call api.addXp with the delta', () => {
      service.addXp(50);
      expect(mockApi.addXp).toHaveBeenCalledWith(50);
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
      expect(mockApi.addXp).not.toHaveBeenCalled();
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

    it('should call api.deleteHero', () => {
      service.createHero('Test Hero', 'guerreiro');
      mockApi.deleteHero.mockClear();

      service.resetHero();
      expect(mockApi.deleteHero).toHaveBeenCalledTimes(1);
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

  describe('updateHeroName', () => {
    beforeEach(() => {
      service.createHero('Test Hero', 'guerreiro');
    });

    it('should update only the name, preserving class and XP', () => {
      service.addXp(120);
      service.updateHeroName('  Strider  ');

      const hero = service.hero();
      expect(hero!.name).toBe('Strider');
      expect(hero!.heroClass).toBe('guerreiro');
      expect(hero!.totalXp).toBe(120);
    });

    it('should persist updated name to localStorage', () => {
      service.updateHeroName('Frodo');
      const stored = JSON.parse(mockLocalStorage['ma.hero.v1']!);
      expect(stored.name).toBe('Frodo');
    });

    it('should call api.putHero with the updated hero', () => {
      service.addXp(40);
      mockApi.putHero.mockClear();

      service.updateHeroName('Frodo');
      expect(mockApi.putHero).toHaveBeenCalledWith({
        name: 'Frodo',
        heroClass: 'guerreiro',
        totalXp: 40,
      });
    });

    it('should not throw when no hero exists', () => {
      service.resetHero();
      mockApi.putHero.mockClear();
      expect(() => service.updateHeroName('Ghost')).not.toThrow();
      expect(mockApi.putHero).not.toHaveBeenCalled();
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
