import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import { GameService } from '../../game/game.service';
import { MissionService } from '../../game/mission.service';
import { SettingsService } from '../../game/settings.service';
import { HeroCardComponent } from '../../hero/hero-card.component';
import { HeroSetupComponent } from '../../hero/hero-setup.component';
import { environment } from '../../../environments/environment';

const PERFIL_STORAGE_KEY = 'ma.perfil.v1';

@Component({
  selector: 'app-perfil',
  imports: [HeroSetupComponent, HeroCardComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private readonly auth = inject(AuthService);
  private readonly gameService = inject(GameService);
  private readonly missionService = inject(MissionService);
  private readonly settingsService = inject(SettingsService);
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hero = this.gameService.hero;
  readonly user = this.auth.user;
  readonly imgFailed = signal(false);
  readonly userInitials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const source = (u.name ?? '').trim() || u.email || '';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  });
  readonly level = this.gameService.level;
  readonly totalXp = computed(() => this.hero()?.totalXp ?? 0);
  readonly completedCount = computed(() => this.missionService.completedTasks().length);
  readonly retentionDays = this.settingsService.retentionDays;

  readonly retentionOptions = [
    { days: 0, label: 'Nunca' },
    { days: 7, label: '7 dias' },
    { days: 30, label: '30 dias' },
    { days: 60, label: '60 dias' },
    { days: 90, label: '90 dias' },
  ] as const;

  constructor() {
    // Backend wins over localStorage when present; 401/network → keep local value.
    this.api.getCollection('perfil').subscribe({
      next: (payload) => {
        if (this.isPlainObject(payload)) {
          this.cachePerfil(payload);
        }
      },
      error: () => {
        // Mantém o valor do localStorage; silencioso.
      },
    });
  }

  onHeroCreated(): void {
    this.router.navigate(['/']);
  }

  onRetentionChange(event: Event): void {
    const days = Number((event.target as HTMLSelectElement).value);
    this.settingsService.setRetentionDays(days);
    this.missionService.purgeExpired();
    const payload = { retentionDays: this.settingsService.retentionDays() };
    this.cachePerfil(payload);
    this.scheduleSync('perfil', () => payload);
  }

  async deleteAccount(): Promise<void> {
    if (!window.confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      await firstValueFrom(
        this.http.delete<void>(`${environment.apiUrl}/api/auth/account`, { withCredentials: true }),
      );
      this.auth.user.set(null);
      localStorage.clear();
      this.router.navigate(['/login']);
    } catch (err) {
      console.error('Falha ao excluir conta', err);
    }
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  private cachePerfil(payload: unknown): void {
    try {
      localStorage.setItem(PERFIL_STORAGE_KEY, JSON.stringify(payload));
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