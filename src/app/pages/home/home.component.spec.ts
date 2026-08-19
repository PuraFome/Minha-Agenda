import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { HomeComponent } from './home.component';
import { GameService } from '../../game/game.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let gameServiceSpy: {
    hero: ReturnType<typeof signal>;
    level: ReturnType<typeof signal>;
    progress: ReturnType<typeof signal>;
    xpForNextLevel: ReturnType<typeof signal>;
  };

  const mockHero = {
    name: 'Test Hero',
    heroClass: 'guerreiro' as const,
    totalXp: 0,
  };

  beforeEach(async () => {
    gameServiceSpy = {
      hero: signal(null),
      level: signal(1),
      progress: signal(0),
      xpForNextLevel: signal(100),
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [{ provide: GameService, useValue: gameServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
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
    expect(compiled.querySelector('app-mission-form')).toBeFalsy();
    expect(compiled.querySelector('app-task-list')).toBeFalsy();
  });

  it('should render dashboard when hero exists', () => {
    gameServiceSpy.hero = signal(mockHero);
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-hero-setup')).toBeFalsy();
    expect(compiled.querySelector('app-hero-card')).toBeTruthy();
    expect(compiled.querySelector('app-mission-form')).toBeTruthy();
    expect(compiled.querySelector('app-task-list')).toBeTruthy();
  });
});