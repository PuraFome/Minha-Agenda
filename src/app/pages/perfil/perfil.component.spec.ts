import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { PerfilComponent } from './perfil.component';
import { HeroSetupComponent } from '../../hero/hero-setup.component';
import { GameService } from '../../game/game.service';
import { MissionService } from '../../game/mission.service';
import { SettingsService } from '../../game/settings.service';

describe('PerfilComponent', () => {
  let component: PerfilComponent;
  let fixture: ComponentFixture<PerfilComponent>;
  let gameServiceSpy: {
    hero: ReturnType<typeof signal>;
    level: ReturnType<typeof signal>;
    progress: ReturnType<typeof signal>;
    xpForNextLevel: ReturnType<typeof signal>;
    createHero: ReturnType<typeof vi.fn>;
  };
  let missionServiceSpy: {
    completedTasks: ReturnType<typeof signal>;
    purgeExpired: ReturnType<typeof vi.fn>;
  };
  let settingsServiceSpy: {
    retentionDays: ReturnType<typeof signal>;
    setRetentionDays: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  const mockHero = {
    name: 'Test Hero',
    heroClass: 'guerreiro' as const,
    totalXp: 0,
  };

  const mockCompletedMissions = [
    {
      id: 'm1',
      title: 'Missão 1',
      difficulty: 'facil' as const,
      completed: true,
      completedAt: '2026-08-01T00:00:00.000Z',
    },
    {
      id: 'm2',
      title: 'Missão 2',
      difficulty: 'media' as const,
      completed: true,
      completedAt: '2026-08-02T00:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    gameServiceSpy = {
      hero: signal(null),
      level: signal(1),
      progress: signal(0),
      xpForNextLevel: signal(100),
      createHero: vi.fn(),
    };
    missionServiceSpy = {
      completedTasks: signal([]),
      purgeExpired: vi.fn(),
    };
    settingsServiceSpy = {
      retentionDays: signal(0),
      setRetentionDays: vi.fn(),
    };
    routerSpy = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        { provide: GameService, useValue: gameServiceSpy },
        { provide: MissionService, useValue: missionServiceSpy },
        { provide: SettingsService, useValue: settingsServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render hero-setup when no hero exists', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-hero-setup')).toBeTruthy();
    expect(compiled.querySelector('app-hero-card')).toBeFalsy();
    expect(compiled.querySelector('select')).toBeFalsy();
  });

  it('should navigate to / when created event is emitted', () => {
    const heroSetup = fixture.debugElement.query(By.directive(HeroSetupComponent))
      .componentInstance as HeroSetupComponent;
    heroSetup.created.emit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should render hero-card, stats and retention select when hero exists', () => {
    gameServiceSpy.hero = signal(mockHero);
    missionServiceSpy.completedTasks = signal(mockCompletedMissions);
    fixture.destroy();
    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-hero-setup')).toBeFalsy();
    expect(compiled.querySelector('app-hero-card')).toBeTruthy();

    const stats = compiled.querySelectorAll('.perfil__stat-value');
    expect(stats.length).toBe(3);
    expect(stats[0].textContent).toBe('1');
    expect(stats[1].textContent).toBe('0');
    expect(stats[2].textContent).toBe('2');

    const select = compiled.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.options.length).toBe(5);
    expect(select.options[0].textContent).toContain('Nunca');
    expect(select.options[1].textContent).toContain('7 dias');
  });

  it('should call setRetentionDays and purgeExpired on retention change', () => {
    gameServiceSpy.hero = signal(mockHero);
    fixture.destroy();
    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '30';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(settingsServiceSpy.setRetentionDays).toHaveBeenCalledWith(30);
    expect(missionServiceSpy.purgeExpired).toHaveBeenCalled();
  });
});