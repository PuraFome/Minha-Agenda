import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ApiService } from '../core/api.service';

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
  private readonly api = inject(ApiService);
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  /** Dias de retenção de missões concluídas — 0 = manter para sempre. */
  readonly retentionDays = signal<number>(this.readStoredRetentionDays());

  constructor() {
    // Backend wins over localStorage when present; 401/network → keep local value.
    this.api.getCollection('settings').subscribe({
      next: (payload) => {
        if (this.isValidSettings(payload)) {
          this.retentionDays.set(Math.max(0, Math.floor(payload.retentionDays)));
          this.persist();
        }
      },
      error: () => {
        // Mantém o valor do localStorage; silencioso.
      },
    });
  }

  /** Define os dias de retenção, limitando a um inteiro não-negativo. */
  setRetentionDays(days: number): void {
    const clamped = Math.max(0, Math.floor(days));
    this.retentionDays.set(clamped);
    this.persist();
    this.scheduleSync('settings', () => ({ retentionDays: this.retentionDays() }));
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

  private isValidSettings(value: unknown): value is { retentionDays: number } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return typeof candidate['retentionDays'] === 'number' && Number.isFinite(candidate['retentionDays']);
  }

  private scheduleSync(name: string, payloadFactory: () => unknown): void {
    if (this.syncTimer !== null) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.api.putCollection(name, payloadFactory()).subscribe({ error: () => {} });
    }, 500);
  }
}