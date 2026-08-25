import { Component, inject, signal } from '@angular/core';
import { MissionListComponent } from '../../missions/mission-list.component';
import { ApiService } from '../../core/api.service';

const MURAL_STORAGE_KEY = 'ma.mural.v1';

@Component({
  selector: 'app-mural',
  imports: [MissionListComponent],
  templateUrl: './mural.component.html',
  styleUrl: './mural.component.scss',
})
export class MuralComponent {
  private readonly api = inject(ApiService);
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeTab = signal<'pending' | 'completed'>('pending');

  constructor() {
    // Offline fallback: restaura a aba do localStorage antes de consultar o backend.
    const cached = this.readCachedTab();
    if (cached) {
      this.activeTab.set(cached);
    }
    // Backend wins over localStorage when present; 401/network → keep local value.
    this.api.getCollection('mural').subscribe({
      next: (payload) => {
        if (this.isMuralPayload(payload) && this.isValidTab(payload.activeTab)) {
          this.activeTab.set(payload.activeTab);
          this.cacheMural(payload.activeTab);
        }
      },
      error: () => {
        // Mantém o valor do localStorage; silencioso.
      },
    });
  }

  selectTab(tab: 'pending' | 'completed'): void {
    this.activeTab.set(tab);
    this.cacheMural(tab);
    this.scheduleSync('mural', () => ({ activeTab: tab }));
  }

  private isValidTab(value: unknown): value is 'pending' | 'completed' {
    return value === 'pending' || value === 'completed';
  }

  private isMuralPayload(value: unknown): value is { activeTab: unknown } {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readCachedTab(): 'pending' | 'completed' | null {
    try {
      const stored = localStorage.getItem(MURAL_STORAGE_KEY);
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as { activeTab?: unknown };
      return this.isValidTab(parsed?.activeTab) ? parsed.activeTab : null;
    } catch {
      return null;
    }
  }

  private cacheMural(tab: 'pending' | 'completed'): void {
    try {
      localStorage.setItem(MURAL_STORAGE_KEY, JSON.stringify({ activeTab: tab }));
    } catch {
      // Falha silenciosa: o cache offline é melhor-esforço.
    }
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