import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ApiService } from '../core/api.service';
import { Hero, HeroClass } from './game.types';

const HERO_STORAGE_KEY = 'ma.hero.v1';

/**
 * Gerencia o herói do usuário: criação, XP e nível.
 *
 * - Persiste o herói em localStorage (key `ma.hero.v1`) com try/catch.
 * - Nível = floor(totalXp / 100) + 1; progresso = totalXp % 100.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(ApiService);

  /** Herói atual — null enquanto o usuário não criou um (fluxo de primeiro acesso). */
  readonly hero = signal<Hero | null>(this.readStoredHero());

  constructor() {
    // Backend wins over localStorage when present; 401/network → keep local value.
    this.api.getHero().subscribe({
      next: (payload) => {
        if (this.isValidHero(payload)) {
          this.hero.set(payload);
          this.writeStoredHero(payload);
        }
      },
      error: () => {
        // Mantém o valor do localStorage; silencioso.
      },
    });
  }

  /** Nível do herói: floor(totalXp / 100) + 1. */
  readonly level = computed(() => {
    const hero = this.hero();
    return hero ? Math.floor(hero.totalXp / 100) + 1 : 1;
  });

  /** Progresso dentro do nível atual: totalXp % 100. */
  readonly progress = computed(() => {
    const hero = this.hero();
    return hero ? hero.totalXp % 100 : 0;
  });

  /** XP restante para o próximo nível: 100 - progress. */
  readonly xpForNextLevel = computed(() => 100 - this.progress());

  /** Cria um novo herói com 0 XP, sobrescrevendo qualquer herói existente. */
  createHero(name: string, heroClass: HeroClass): void {
    const hero: Hero = { name, heroClass, totalXp: 0 };
    this.hero.set(hero);
    this.writeStoredHero(hero);
    this.api.putHero(hero).subscribe({ error: () => {} });
  }

  /** Adiciona (ou subtrai, com amount negativo) XP do herói. Nunca fica abaixo de 0. */
  addXp(amount: number): void {
    const hero = this.hero();
    if (!hero) {
      return;
    }
    const updated: Hero = { ...hero, totalXp: Math.max(0, hero.totalXp + amount) };
    this.hero.set(updated);
    this.writeStoredHero(updated);
    this.api.addXp(amount).subscribe({ error: () => {} });
  }

  /** Apaga o herói (estado e localStorage) e sincroniza com o backend. */
  resetHero(): void {
    this.hero.set(null);
    this.removeStoredHero();
    this.api.deleteHero().subscribe({ error: () => {} });
  }

  /** Atualiza apenas o nome do herói, preservando classe e XP. */
  updateHeroName(name: string): void {
    const hero = this.hero();
    if (!hero) {
      return;
    }
    const updated: Hero = { ...hero, name: name.trim() };
    this.hero.set(updated);
    this.writeStoredHero(updated);
    this.api.putHero(updated).subscribe({ error: () => {} });
  }

  private readStoredHero(): Hero | null {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(HERO_STORAGE_KEY);
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as Hero;
      if (typeof parsed?.name === 'string' && typeof parsed?.totalXp === 'number') {
        return parsed;
      }
    } catch {
      // localStorage indisponível ou JSON corrompido — começa sem herói.
    }
    return null;
  }

  private writeStoredHero(hero: Hero): void {
    try {
      this.document.defaultView?.localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(hero));
    } catch {
      // Falha silenciosa: o estado continua funcionando em memória.
    }
  }

  private removeStoredHero(): void {
    try {
      this.document.defaultView?.localStorage.removeItem(HERO_STORAGE_KEY);
    } catch {
      // Falha silenciosa.
    }
  }

  private isValidHero(value: unknown): value is Hero {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate['name'] === 'string' &&
      typeof candidate['heroClass'] === 'string' &&
      typeof candidate['totalXp'] === 'number' &&
      Number.isFinite(candidate['totalXp'])
    );
  }
}