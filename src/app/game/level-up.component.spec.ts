import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { LevelUpComponent } from './level-up.component';
import { GameService } from './game.service';

describe('LevelUpComponent', () => {
  let component: LevelUpComponent;
  let fixture: ComponentFixture<LevelUpComponent>;
  let levelSignal: ReturnType<typeof signal<number>>;
  let gameServiceSpy: { level: ReturnType<typeof signal<number>> };

  beforeEach(async () => {
    levelSignal = signal(1);
    gameServiceSpy = { level: levelSignal };

    await TestBed.configureTestingModule({
      imports: [LevelUpComponent],
      providers: [{ provide: GameService, useValue: gameServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(LevelUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show overlay on initial load', () => {
    expect(component.visible()).toBe(false);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.level-up__dialog')).toBeFalsy();
  });

  it('should show overlay when level increases', () => {
    levelSignal.set(2);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.level-up__dialog')).toBeTruthy();
    expect(compiled.querySelector('.level-up__title')?.textContent).toContain('Nível 2');
  });

  it('should hide overlay on dismiss', () => {
    levelSignal.set(2);
    fixture.detectChanges();
    fixture.detectChanges();

    const dismissBtn = fixture.nativeElement.querySelector(
      '.level-up__dismiss',
    ) as HTMLButtonElement;
    dismissBtn.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.level-up__dialog')).toBeFalsy();
  });

  it('should not re-show overlay for the same level after dismiss', () => {
    levelSignal.set(2);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(component.visible()).toBe(true);

    component.dismiss();
    fixture.detectChanges();
    expect(component.visible()).toBe(false);

    fixture.detectChanges();
    expect(component.visible()).toBe(false);
  });
});