import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ApiService } from '../core/api.service';

const SETTINGS_STORAGE_KEY = 'ma.settings.v1';

type MuralTab = 'pending' | 'completed';

interface StoredSettings {
  retentionDays: number;
  muralActiveTab: MuralTab;
}

/**
 * Gerencia as configurações do usuário.
 *
 * - Persiste as configurações em localStorage (key `ma.settings.v1`) com try/catch.
 * - `retentionDays` controla o arquivamento automático de missões concluídas;
 *   0 = manter para sempre (padrão, opt-in).
 * - `muralActiveTab` controla a aba ativa do mural (pendente/concluída).
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(ApiService);

  private readonly initial = this.readStored();

  /** Dias de retenção de missões concluídas — 0 = manter para sempre. */
  readonly retentionDays = signal<number>(this.initial.retentionDays);

  /** Aba ativa do mural — 'pending' | 'completed'. */
  readonly muralActiveTab = signal<MuralTab>(this.initial.muralActiveTab);

  constructor() {
    // Backend wins over localStorage when present; 401/network → keep local value.
    this.api.getSettings().subscribe({
      next: (payload) => {
        const settings = payload as Partial<StoredSettings>;
        if (typeof settings.retentionDays === 'number' && Number.isFinite(settings.retentionDays)) {
          this.retentionDays.set(Math.max(0, Math.floor(settings.retentionDays)));
        }
        if (settings.muralActiveTab === 'pending' || settings.muralActiveTab === 'completed') {
          this.muralActiveTab.set(settings.muralActiveTab);
        }
        this.persist();
      },
      error: () => {
        // Mantém o valor do localStorage; silencioso.
      },
    });
  }

  /** Snapshot das configurações atuais. */
  getSettings(): { retentionDays: number; muralActiveTab: MuralTab } {
    return { retentionDays: this.retentionDays(), muralActiveTab: this.muralActiveTab() };
  }

  /** Define os dias de retenção, limitando a um inteiro não-negativo. */
  setRetentionDays(days: number): void {
    const clamped = Math.max(0, Math.floor(days));
    this.retentionDays.set(clamped);
    this.persist();
    this.api.putSettings({ retentionDays: clamped }).subscribe({ error: () => {} });
  }

  /** Aplica um patch parcial de configurações (otimista) e sincroniza com o backend. */
  putSettings(partial: { retentionDays?: number; muralActiveTab?: MuralTab }): void {
    if (typeof partial.retentionDays === 'number' && Number.isFinite(partial.retentionDays)) {
      this.retentionDays.set(Math.max(0, Math.floor(partial.retentionDays)));
    }
    if (partial.muralActiveTab === 'pending' || partial.muralActiveTab === 'completed') {
      this.muralActiveTab.set(partial.muralActiveTab);
    }
    this.persist();
    const body: StoredSettings = {
      retentionDays: this.retentionDays(),
      muralActiveTab: this.muralActiveTab(),
    };
    this.api.putSettings(body).subscribe({ error: () => {} });
  }

  private readStored(): StoredSettings {
    const fallback: StoredSettings = { retentionDays: 0, muralActiveTab: 'pending' };
    try {
      const stored = this.document.defaultView?.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        return fallback;
      }
      const parsed = JSON.parse(stored) as Partial<StoredSettings>;
      const retentionDays =
        typeof parsed?.retentionDays === 'number' && Number.isFinite(parsed.retentionDays)
          ? Math.max(0, Math.floor(parsed.retentionDays))
          : 0;
      const muralActiveTab =
        parsed?.muralActiveTab === 'pending' || parsed?.muralActiveTab === 'completed'
          ? parsed.muralActiveTab
          : 'pending';
      return { retentionDays, muralActiveTab };
    } catch {
      // localStorage indisponível ou JSON corrompido — padrão.
    }
    return fallback;
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ retentionDays: this.retentionDays(), muralActiveTab: this.muralActiveTab() }),
      );
    } catch {
      // Falha silenciosa: o estado continua funcionando em memória.
    }
  }
}
