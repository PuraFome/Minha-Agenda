import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

/**
 * Gerencia o tema da aplicação (claro/escuro).
 *
 * - Nunca tocado no botão: segue o tema do SO via matchMedia, reagindo ao vivo.
 * - Tocou no botão: a escolha explícita persiste em localStorage e sobrescreve o sistema.
 * - O tema efetivo é aplicado como atributo `data-theme` no `<html>`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  /** Preferência do usuário — 'system' enquanto ele nunca tocou no botão. */
  readonly preference = signal<ThemePreference>(this.readStoredPreference());

  /** Preferência atual do sistema operacional. */
  private readonly systemPrefersDark = signal(
    this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false,
  );

  /** Tema efetivo, resolvendo a preferência do sistema quando necessário. */
  readonly theme = computed<Theme>(() => {
    const preference = this.preference();
    return preference === 'system'
      ? this.systemPrefersDark()
        ? 'dark'
        : 'light'
      : preference;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Aplica o tema resolvido no <html> e persiste a preferência.
    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.theme());
      this.writeStoredPreference(this.preference());
    });

    // Reage em tempo real a mudanças do tema do sistema operacional.
    const mediaQuery = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (mediaQuery) {
      const onChange = (event: MediaQueryListEvent) => {
        this.systemPrefersDark.set(event.matches);
      };
      mediaQuery.addEventListener('change', onChange);
      destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', onChange));
    }
  }

  /** Alterna entre claro e escuro, sobrescrevendo a preferência do sistema. */
  toggle(): void {
    this.preference.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  /** Volta a seguir o tema do sistema operacional. */
  followSystem(): void {
    this.preference.set('system');
  }

  private readStoredPreference(): ThemePreference {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // localStorage indisponível (ex.: ambiente restrito) — segue o sistema.
    }
    return 'system';
  }

  private writeStoredPreference(preference: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Falha silenciosa: o tema continua funcionando em memória.
    }
  }
}
