import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroSetupComponent } from './hero-setup.component';
import { GameService } from '../game/game.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('HeroSetupComponent', () => {
  let component: HeroSetupComponent;
  let fixture: ComponentFixture<HeroSetupComponent>;
  let gameServiceSpy: { createHero: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    gameServiceSpy = { createHero: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [HeroSetupComponent],
      providers: [{ provide: GameService, useValue: gameServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render form with name input and class buttons', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input#hero-name')).toBeTruthy();
    expect(compiled.querySelectorAll('.hero-setup__class-btn').length).toBe(4);
    expect(compiled.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('should have submit button disabled initially', () => {
    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('should enable submit when name and class are selected', () => {
    component.name.set('Test Hero');
    component.selectClass('guerreiro');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });

  it('should not enable submit with only name', () => {
    component.name.set('Test Hero');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('should not enable submit with only class', () => {
    component.selectClass('mago');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('should trim name and validate min 1 char', () => {
    component.name.set('   ');
    fixture.detectChanges();
    expect(component.isNameValid()).toBe(false);

    component.name.set(' A ');
    fixture.detectChanges();
    expect(component.isNameValid()).toBe(true);
    expect(component.trimmedName()).toBe('A');
  });

  it('should call createHero with correct args on submit', () => {
    component.name.set('My Hero');
    component.selectClass('ladino');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.click();

    expect(gameServiceSpy.createHero).toHaveBeenCalledWith('My Hero', 'ladino');
  });

  it('should not call createHero if form invalid', () => {
    component.name.set('');
    component.selectClass('guerreiro');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.click();

    expect(gameServiceSpy.createHero).not.toHaveBeenCalled();
  });

  it('should render class buttons with correct labels and icons', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('.hero-setup__class-btn');

    expect(buttons[0].textContent).toContain('Guerreiro');
    expect(buttons[0].textContent).toContain('⚔️');
    expect(buttons[1].textContent).toContain('Mago');
    expect(buttons[1].textContent).toContain('🔮');
    expect(buttons[2].textContent).toContain('Ladino');
    expect(buttons[2].textContent).toContain('🗡️');
    expect(buttons[3].textContent).toContain('Clérigo');
    expect(buttons[3].textContent).toContain('✨');
  });

  it('should apply selected class style', () => {
    component.selectClass('clerigo');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.hero-setup__class-btn');
    expect(buttons[3].classList.contains('hero-setup__class-btn--selected')).toBe(true);
    expect(buttons[0].classList.contains('hero-setup__class-btn--selected')).toBe(false);
  });
});