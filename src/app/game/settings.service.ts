import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const SETTINGS_STORAGE_KEY = 'ma.settings.v1';

/**
 * Gerencia as configurações do usuário.
 *
 * - Persiste as configurações em localStorage (key `ma.settings.v1`) com try/catch.
 * - `retentionDays` controla o arquivamento automático de missões concluídas;
 *   0 = manter para sempre (padrão, opt-in).
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly document = inject(DOCUMENT);

  /** Dias de retenção de missões concluídas — 0 = manter para sempre. */
  readonly retentionDays = signal<number>(this.readStoredRetentionDays());

  /** Define os dias de retenção, limitando a um inteiro não-negativo. */
  setRetentionDays(days: number): void {
    const clamped = Math.max(0, Math.floor(days));
    this.retentionDays.set(clamped);
    this.persist();
  }

  private readStoredRetentionDays(): number {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        return 0;
      }
      const parsed = JSON.parse(stored) as { retentionDays?: unknown };
      if (typeof parsed?.retentionDays === 'number' && Number.isFinite(parsed.retentionDays)) {
        return Math.max(0, Math.floor(parsed.retentionDays));
      }
    } catch {
      // localStorage indisponível ou JSON corrompido — padrão 0.
    }
    return 0;
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ retentionDays: this.retentionDays() }),
      );
    } catch {
      // Falha silenciosa: o estado continua funcionando em memória.
    }
  }
}