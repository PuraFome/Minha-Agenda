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
  it('getHero() GETs /api/hero with credentials', () => {
    const http = mockHttp();
    const hero: Hero = { name: 'A', heroClass: 'mago', totalXp: 0 };
    http.get.mockReturnValue(of(hero));
    const service = createService(http);

    service.getHero().subscribe((res) => expect(res).toEqual(hero));

    expect(http.get).toHaveBeenCalledWith(`${API}/api/hero`, { withCredentials: true });
  });

  it('putHero() PUTs /api/hero with the hero body', () => {
    const http = mockHttp();
    http.put.mockReturnValue(of(null));
    const service = createService(http);
    const hero: Hero = { name: 'B', heroClass: 'ladino', totalXp: 10 };

    service.putHero(hero).subscribe();

    expect(http.put).toHaveBeenCalledWith(`${API}/api/hero`, hero, {
      withCredentials: true,
    });
  });

  it('addXp(-5) PATCHes /api/hero/xp with {delta:-5}', () => {
    const http = mockHttp();
    http.patch.mockReturnValue(of(null));
    const service = createService(http);

    service.addXp(-5).subscribe();

    expect(http.patch).toHaveBeenCalledWith(
      `${API}/api/hero/xp`,
      { delta: -5 },
      { withCredentials: true },
    );
  });

  it('deleteHero() DELETEs /api/hero', () => {
    const http = mockHttp();
    http.delete.mockReturnValue(of(null));
    const service = createService(http);

    service.deleteHero().subscribe();

    expect(http.delete).toHaveBeenCalledWith(`${API}/api/hero`, {
      withCredentials: true,
    });
  });

  it('listMissions() GETs /api/missions', () => {
    const http = mockHttp();
    const missions: Mission[] = [
      { id: '1', title: 'T', difficulty: 'facil', completed: false },
    ];
    http.get.mockReturnValue(of(missions));
    const service = createService(http);

    service.listMissions().subscribe((res) => expect(res).toEqual(missions));

    expect(http.get).toHaveBeenCalledWith(`${API}/api/missions`, {
      withCredentials: true,
    });
  });

  it('createMission() POSTs /api/missions', () => {
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

    expect(http.post).toHaveBeenCalledWith(`${API}/api/missions`, mission, {
      withCredentials: true,
    });
  });

  it('updateMission() PUTs /api/missions/:id with the patch', () => {
    const http = mockHttp();
    http.put.mockReturnValue(of(null));
    const service = createService(http);

    service.updateMission('3', { completed: true }).subscribe();

    expect(http.put).toHaveBeenCalledWith(
      `${API}/api/missions/3`,
      { completed: true },
      { withCredentials: true },
    );
  });

  it('setMissionComplete() PATCHes /api/missions/:id/complete', () => {
    const http = mockHttp();
    http.patch.mockReturnValue(of(null));
    const service = createService(http);

    service.setMissionComplete('4', true).subscribe();

    expect(http.patch).toHaveBeenCalledWith(
      `${API}/api/missions/4/complete`,
      { completed: true },
      { withCredentials: true },
    );
  });

  it('deleteMission() DELETEs /api/missions/:id', () => {
    const http = mockHttp();
    http.delete.mockReturnValue(of(null));
    const service = createService(http);

    service.deleteMission('5').subscribe();

    expect(http.delete).toHaveBeenCalledWith(`${API}/api/missions/5`, {
      withCredentials: true,
    });
  });

  it('getSettings() GETs /api/settings', () => {
    const http = mockHttp();
    const settings: Settings = { retentionDays: 7 };
    http.get.mockReturnValue(of(settings));
    const service = createService(http);

    service.getSettings().subscribe((res) => expect(res).toEqual(settings));

    expect(http.get).toHaveBeenCalledWith(`${API}/api/settings`, {
      withCredentials: true,
    });
  });

  it('putSettings() PUTs /api/settings', () => {
    const http = mockHttp();
    const settings: Settings = { retentionDays: 0 };
    http.put.mockReturnValue(of(null));
    const service = createService(http);

    service.putSettings(settings).subscribe();

    expect(http.put).toHaveBeenCalledWith(`${API}/api/settings`, settings, {
      withCredentials: true,
    });
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
