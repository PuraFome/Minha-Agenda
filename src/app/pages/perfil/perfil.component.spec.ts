import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PerfilComponent } from './perfil.component';
import { AuthService } from '../../core/auth.service';
import { GameService } from '../../game/game.service';
import { MissionService } from '../../game/mission.service';
import { SettingsService } from '../../game/settings.service';

describe('PerfilComponent', () => {
  let authMock: { user: ReturnType<typeof signal> };
  let gameMock: {
    hero: ReturnType<typeof signal>;
    level: ReturnType<typeof signal>;
  };
  let missionMock: {
    completedTasks: ReturnType<typeof signal>;
    purgeExpired: ReturnType<typeof vi.fn>;
  };
  let settingsMock: {
    retentionDays: ReturnType<typeof signal>;
    setRetentionDays: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let httpMock: { delete: ReturnType<typeof vi.fn> };

  function createComponent(): PerfilComponent {
    const injector = Injector.create({
      providers: [
        { provide: HttpClient, useValue: httpMock },
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authMock },
        { provide: GameService, useValue: gameMock },
        { provide: MissionService, useValue: missionMock },
        { provide: SettingsService, useValue: settingsMock },
      ],
    });
    return runInInjectionContext(injector, () => new PerfilComponent());
  }

  beforeEach(() => {
    authMock = { user: signal(null) };
    gameMock = {
      hero: signal(null),
      level: signal(1),
    };
    missionMock = {
      completedTasks: signal([]),
      purgeExpired: vi.fn(),
    };
    settingsMock = {
      retentionDays: signal(0),
      setRetentionDays: vi.fn(),
    };
    routerMock = { navigate: vi.fn() };
    httpMock = { delete: vi.fn() };
  });

  it('should create', () => {
    const component = createComponent();
    expect(component).toBeTruthy();
  });

  it('should expose hero level, totalXp, completedCount and userInitials', () => {
    authMock.user = signal({ name: 'Zé Droguinha', email: 'ze@example.com' });
    gameMock.hero = signal({ name: 'Hero', heroClass: 'guerreiro', totalXp: 250 });
    gameMock.level = signal(3);
    missionMock.completedTasks = signal([
      { id: 'm1', completed: true },
      { id: 'm2', completed: true },
    ] as never);
    const component = createComponent();
    expect(component.level()).toBe(3);
    expect(component.totalXp()).toBe(250);
    expect(component.completedCount()).toBe(2);
    expect(component.userInitials()).toBe('ZD');
  });

  it('should call setRetentionDays and purgeExpired on retention change', () => {
    const component = createComponent();
    const event = { target: { value: '30' } } as unknown as Event;
    component.onRetentionChange(event);
    expect(settingsMock.setRetentionDays).toHaveBeenCalledWith(30);
    expect(missionMock.purgeExpired).toHaveBeenCalled();
  });
});
