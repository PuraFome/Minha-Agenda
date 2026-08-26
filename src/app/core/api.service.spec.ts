import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiService, AuthRequiredError, Settings } from './api.service';
import { Hero, Mission } from '../game/game.types';

const API = environment.apiUrl;

type MockHttp = {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function createService(mockHttp: MockHttp): ApiService {
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: mockHttp as unknown as HttpClient }],
  });
  return runInInjectionContext(injector, () => new ApiService());
}

function mockHttp(): MockHttp {
  return {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

describe('ApiService', () => {
  it('getHero() GETs /api/hero', () => {
    const http = mockHttp();
    const hero: Hero = { name: 'A', heroClass: 'mago', totalXp: 0 };
    http.get.mockReturnValue(of(hero));
    const service = createService(http);

    service.getHero().subscribe((res) => expect(res).toEqual(hero));

    expect(http.get).toHaveBeenCalledWith(`${API}/api/hero`);
  });

  it('putHero() PUTs /api/hero with only {name, heroClass}', () => {
    const http = mockHttp();
    http.put.mockReturnValue(of(null));
    const service = createService(http);
    const hero: Hero = { name: 'B', heroClass: 'ladino', totalXp: 10 };

    service.putHero(hero).subscribe();

    expect(http.put).toHaveBeenCalledWith(`${API}/api/hero`, {
      name: 'B',
      heroClass: 'ladino',
    });
  });

  it('putHero() strips totalXp from the body (regression: forbidNonWhitelisted)', () => {
    const http = mockHttp();
    http.put.mockReturnValue(of(null));
    const service = createService(http);
    const hero: Hero = { name: 'Atlas', heroClass: 'mago', totalXp: 42 };

    service.putHero(hero).subscribe();

    const [, body] = http.put.mock.calls[0];
    expect(body).toEqual({ name: 'Atlas', heroClass: 'mago' });
    expect(body).not.toHaveProperty('totalXp');
  });

  it('addXp(-5) PATCHes /api/hero/xp with {delta:-5}', () => {
    const http = mockHttp();
    http.patch.mockReturnValue(of(null));
    const service = createService(http);

    service.addXp(-5).subscribe();

    expect(http.patch).toHaveBeenCalledWith(`${API}/api/hero/xp`, { delta: -5 });
  });

  it('deleteHero() DELETEs /api/hero', () => {
    const http = mockHttp();
    http.delete.mockReturnValue(of(null));
    const service = createService(http);

    service.deleteHero().subscribe();

    expect(http.delete).toHaveBeenCalledWith(`${API}/api/hero`);
  });

  it('listMissions() GETs /api/missions', () => {
    const http = mockHttp();
    const missions: Mission[] = [
      { id: '1', title: 'T', difficulty: 'facil', completed: false },
    ];
    http.get.mockReturnValue(of(missions));
    const service = createService(http);

    service.listMissions().subscribe((res) => expect(res).toEqual(missions));

    expect(http.get).toHaveBeenCalledWith(`${API}/api/missions`);
  });

  it('createMission() POSTs /api/missions with only whitelisted fields', () => {
    const http = mockHttp();
    const mission: Mission = {
      id: '2',
      title: 'X',
      difficulty: 'media',
      completed: false,
    };
    http.post.mockReturnValue(of(mission));
    const service = createService(http);

    service.createMission(mission).subscribe((res) => expect(res).toEqual(mission));

    expect(http.post).toHaveBeenCalledWith(`${API}/api/missions`, {
      id: '2',
      title: 'X',
      difficulty: 'media',
    });
  });

  it('createMission() strips completed/completedAt and omits undefined dueDate (regression: forbidNonWhitelisted)', () => {
    const http = mockHttp();
    const mission: Mission = {
      id: '3',
      title: 'Y',
      difficulty: 'dificil',
      completed: false,
      completedAt: null,
    };
    http.post.mockReturnValue(of(mission));
    const service = createService(http);

    service.createMission(mission).subscribe();

    const [, body] = http.post.mock.calls[0];
    expect(body).toEqual({ id: '3', title: 'Y', difficulty: 'dificil' });
    expect(body).not.toHaveProperty('completed');
    expect(body).not.toHaveProperty('completedAt');
    expect(body).not.toHaveProperty('dueDate');
  });

  it('createMission() includes dueDate when present (null allowed by DTO)', () => {
    const http = mockHttp();
    const mission: Mission = {
      id: '4',
      title: 'Z',
      difficulty: 'facil',
      dueDate: null,
      completed: false,
    };
    http.post.mockReturnValue(of(mission));
    const service = createService(http);

    service.createMission(mission).subscribe();

    const [, body] = http.post.mock.calls[0];
    expect(body).toEqual({
      id: '4',
      title: 'Z',
      difficulty: 'facil',
      dueDate: null,
    });
  });

  it('updateMission() PUTs /api/missions/:id with the patch', () => {
    const http = mockHttp();
    http.put.mockReturnValue(of(null));
    const service = createService(http);

    service.updateMission('3', { completed: true }).subscribe();

    expect(http.put).toHaveBeenCalledWith(`${API}/api/missions/3`, {
      completed: true,
    });
  });

  it('setMissionComplete() PATCHes /api/missions/:id/complete', () => {
    const http = mockHttp();
    http.patch.mockReturnValue(of(null));
    const service = createService(http);

    service.setMissionComplete('4', true).subscribe();

    expect(http.patch).toHaveBeenCalledWith(`${API}/api/missions/4/complete`, {
      completed: true,
    });
  });

  it('deleteMission() DELETEs /api/missions/:id', () => {
    const http = mockHttp();
    http.delete.mockReturnValue(of(null));
    const service = createService(http);

    service.deleteMission('5').subscribe();

    expect(http.delete).toHaveBeenCalledWith(`${API}/api/missions/5`);
  });

  it('getSettings() GETs /api/settings', () => {
    const http = mockHttp();
    const settings: Settings = { retentionDays: 7, muralActiveTab: 'pending' };
    http.get.mockReturnValue(of(settings));
    const service = createService(http);

    service.getSettings().subscribe((res) => expect(res).toEqual(settings));

    expect(http.get).toHaveBeenCalledWith(`${API}/api/settings`);
  });

  it('putSettings() PUTs /api/settings', () => {
    const http = mockHttp();
    const settings: Settings = { retentionDays: 0, muralActiveTab: 'completed' };
    http.put.mockReturnValue(of(null));
    const service = createService(http);

    service.putSettings(settings).subscribe();

    expect(http.put).toHaveBeenCalledWith(`${API}/api/settings`, settings);
  });

  it('putSettings() accepts a Partial<Settings> (regression: Task 10 type widening)', () => {
    const http = mockHttp();
    http.put.mockReturnValue(of(null));
    const service = createService(http);
    const partial: Partial<Settings> = { retentionDays: 14 };

    service.putSettings(partial).subscribe();

    expect(http.put).toHaveBeenCalledWith(`${API}/api/settings`, partial);
  });

  it('maps a 401 response to AuthRequiredError', () => {
    const http = mockHttp();
    http.get.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );
    const service = createService(http);

    let thrown: unknown = null;
    service.getHero().subscribe({ error: (err) => (thrown = err) });

    expect(thrown).toBeInstanceOf(AuthRequiredError);
  });

  it('rethrows non-401 errors unchanged', () => {
    const http = mockHttp();
    const err = new HttpErrorResponse({ status: 500 });
    http.get.mockReturnValue(throwError(() => err));
    const service = createService(http);

    let thrown: unknown = null;
    service.getHero().subscribe({ error: (e) => (thrown = e) });

    expect(thrown).toBe(err);
    expect(thrown).not.toBeInstanceOf(AuthRequiredError);
  });
});
