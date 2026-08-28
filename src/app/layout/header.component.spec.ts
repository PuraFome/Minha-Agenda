import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HeaderComponent } from './header.component';
import { ThemeService } from '../theme/theme.service';
import { AuthService } from '../core/auth.service';

@Component({ standalone: true, template: '' })
class DummyRouteComponent {}

describe('HeaderComponent', () => {
  let themeMock: { theme: ReturnType<typeof signal>; toggle: ReturnType<typeof vi.fn> };
  let authMock: { user: ReturnType<typeof signal> };

  beforeEach(() => {
    themeMock = { theme: signal<'light' | 'dark'>('light'), toggle: vi.fn() };
    authMock = { user: signal(null) };

    TestBed.configureTestingModule({
      imports: [HeaderComponent, DummyRouteComponent],
      providers: [
        provideRouter([{ path: 'taberna', component: DummyRouteComponent }]),
        { provide: ThemeService, useValue: themeMock },
        { provide: AuthService, useValue: authMock },
      ],
    });
  });

  it('should render 4 nav links (Mural, Nova Missão, Perfil, Taberna)', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('nav a.nav__link'),
    ) as HTMLElement[];
    const texts = links.map((a) => {
      const full = a.querySelector('.nav__link-text--full');
      return (full?.textContent ?? a.textContent)?.trim();
    });

    expect(texts).toEqual(['Mural', 'Nova Missão', 'Perfil', 'Taberna']);
  });

  it('should render a /taberna nav link', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const taberna = fixture.nativeElement.querySelector('a[routerLink="/taberna"]');
    expect(taberna).toBeTruthy();
    expect(taberna.textContent?.trim()).toBe('Taberna');
  });

  it('should add nav__link--active to the link whose route is active', async () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/taberna');
    fixture.detectChanges();
    await fixture.whenStable();

    const taberna = fixture.nativeElement.querySelector('a[routerLink="/taberna"]');
    expect(taberna.classList.contains('nav__link--active')).toBe(true);

    const mural = fixture.nativeElement.querySelector('a[routerLink="/"]');
    expect(mural.classList.contains('nav__link--active')).toBe(false);
  });
});
