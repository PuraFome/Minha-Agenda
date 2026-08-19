import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroCardComponent } from './hero-card.component';
import { GameService } from '../game/game.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('HeroCardComponent', () => {
  let component: HeroCardComponent;
  let fixture: ComponentFixture<HeroCardComponent>;
  let gameServiceSpy: {
    updateHeroName: ReturnType<typeof vi.fn>;
    hero: ReturnType<typeof signal>;
    level: ReturnType<typeof signal>;
    progress: ReturnType<typeof signal>;
    xpForNextLevel: ReturnType<typeof signal>;
  };

  const mockHero = {
    name: 'Test Hero',
    heroClass: 'guerreiro' as const,
    totalXp: 250,
  };

  beforeEach(async () => {
    gameServiceSpy = {
      updateHeroName: vi.fn(),
      hero: signal(mockHero),
      level: signal(3),
      progress: signal(50),
      xpForNextLevel: signal(50),
    };

    await TestBed.configureTestingModule({
      imports: [HeroCardComponent],
      providers: [{ provide: GameService, useValue: gameServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render hero name', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__name')?.textContent).toContain('Test Hero');
  });

  it('should render hero class with icon and label', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__class-icon')?.textContent).toContain('⚔️');
    expect(compiled.querySelector('.hero-card__class-label')?.textContent).toContain('Guerreiro');
  });

  it('should render level badge', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__level-badge')?.textContent).toContain('Nv. 3');
  });

  it('should render total XP', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__xp-values')?.textContent).toContain('250 / 300');
  });

  it('should render XP bar with width matching progress', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const fill = compiled.querySelector('.hero-card__xp-fill') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe('50%');
  });

  it('should show edit button when not editing', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__edit-btn')).toBeTruthy();
    expect(compiled.querySelector('.hero-card__save-btn')).toBeFalsy();
    expect(compiled.querySelector('.hero-card__cancel-btn')).toBeFalsy();
  });

  it('should toggle inline edit mode on edit button click', () => {
    const editBtn = fixture.nativeElement.querySelector('.hero-card__edit-btn') as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__edit-input')).toBeTruthy();
    expect(compiled.querySelector('.hero-card__save-btn')).toBeTruthy();
    expect(compiled.querySelector('.hero-card__cancel-btn')).toBeTruthy();
    expect(compiled.querySelector('.hero-card__edit-btn')).toBeFalsy();
  });

  it('should cancel editing and restore view', () => {
    component.startEditing();
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('.hero-card__cancel-btn') as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__edit-input')).toBeFalsy();
    expect(compiled.querySelector('.hero-card__edit-btn')).toBeTruthy();
  });

  it('should call updateHeroName on save with trimmed name', () => {
    component.startEditing();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.hero-card__edit-input') as HTMLInputElement;
    input.value = 'New Name';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveBtn = fixture.nativeElement.querySelector('.hero-card__save-btn') as HTMLButtonElement;
    saveBtn.click();

    expect(gameServiceSpy.updateHeroName).toHaveBeenCalledWith('New Name');
  });

  it('should not call updateHeroName if name unchanged', () => {
    component.startEditing();
    fixture.detectChanges();

    const saveBtn = fixture.nativeElement.querySelector('.hero-card__save-btn') as HTMLButtonElement;
    saveBtn.click();

    expect(gameServiceSpy.updateHeroName).not.toHaveBeenCalled();
  });

  it('should not call updateHeroName if name is empty after trim', () => {
    component.startEditing();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.hero-card__edit-input') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveBtn = fixture.nativeElement.querySelector('.hero-card__save-btn') as HTMLButtonElement;
    saveBtn.click();

    expect(gameServiceSpy.updateHeroName).not.toHaveBeenCalled();
  });

  it('should save on Enter key', () => {
    component.startEditing();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.hero-card__edit-input') as HTMLInputElement;
    input.value = 'Enter Name';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(gameServiceSpy.updateHeroName).toHaveBeenCalledWith('Enter Name');
  });

  it('should cancel on Escape key', () => {
    component.startEditing();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.hero-card__edit-input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__edit-input')).toBeFalsy();
  });

  it('should render correct class icons for all classes', () => {
    const testCases: Array<{ class: 'guerreiro' | 'mago' | 'ladino' | 'clerigo'; icon: string }> = [
      { class: 'guerreiro', icon: '⚔️' },
      { class: 'mago', icon: '🔮' },
      { class: 'ladino', icon: '🗡️' },
      { class: 'clerigo', icon: '✨' },
    ];

    for (const tc of testCases) {
      gameServiceSpy.hero = signal({ ...mockHero, heroClass: tc.class });
      gameServiceSpy.level = signal(1);
      gameServiceSpy.progress = signal(0);
      gameServiceSpy.xpForNextLevel = signal(100);

      fixture = TestBed.createComponent(HeroCardComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.hero-card__class-icon')?.textContent).toContain(tc.icon);
    }
  });

  it('should show XP hint with correct remaining XP', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-card__xp-hint')?.textContent).toContain('50 XP para o próximo nível');
  });
});