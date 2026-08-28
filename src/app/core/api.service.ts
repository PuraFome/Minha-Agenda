import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { Difficulty, Hero, Mission } from '../game/game.types';

export interface Settings {
  retentionDays: number;
  muralActiveTab: 'pending' | 'completed';
}

export class AuthRequiredError extends Error {
  constructor(message = 'AUTH_REQUIRED') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // --- Hero ---

  getHero(): Observable<Hero> {
    const url = `${environment.apiUrl}/api/hero`;
    return this.http
      .get<Hero>(url)
      .pipe(catchError((err) => this.handleError(err)));
  }

  putHero(hero: Hero): Observable<void> {
    const url = `${environment.apiUrl}/api/hero`;
    const body = { name: hero.name, heroClass: hero.heroClass };
    return this.http
      .put<void>(url, body)
      .pipe(catchError((err) => this.handleError(err)));
  }

  addXp(delta: number): Observable<void> {
    const url = `${environment.apiUrl}/api/hero/xp`;
    return this.http
      .patch<void>(url, { delta })
      .pipe(catchError((err) => this.handleError(err)));
  }

  deleteHero(): Observable<void> {
    const url = `${environment.apiUrl}/api/hero`;
    return this.http
      .delete<void>(url)
      .pipe(catchError((err) => this.handleError(err)));
  }

  // --- Missions ---

  listMissions(): Observable<Mission[]> {
    const url = `${environment.apiUrl}/api/missions`;
    return this.http
      .get<Mission[]>(url)
      .pipe(catchError((err) => this.handleError(err)));
  }

  createMission(mission: Mission): Observable<Mission> {
    const url = `${environment.apiUrl}/api/missions`;
    const body: {
      id?: string;
      title: string;
      difficulty: Difficulty;
      dueDate?: string | null;
      source?: 'manual' | 'npc';
      npcId?: string | null;
      npcName?: string | null;
      npcAvatar?: string | null;
      templateId?: string | null;
    } = {
      title: mission.title,
      difficulty: mission.difficulty,
    };
    if (mission.id) {
      body.id = mission.id;
    }
    if (mission.dueDate !== undefined) {
      body.dueDate = mission.dueDate;
    }
    if (mission.source !== undefined) body.source = mission.source;
    if (mission.npcId !== undefined) body.npcId = mission.npcId;
    if (mission.npcName !== undefined) body.npcName = mission.npcName;
    if (mission.npcAvatar !== undefined) body.npcAvatar = mission.npcAvatar;
    if (mission.templateId !== undefined) body.templateId = mission.templateId;
    return this.http
      .post<Mission>(url, body)
      .pipe(catchError((err) => this.handleError(err)));
  }

  updateMission(id: string, patch: Partial<Mission>): Observable<void> {
    const url = `${environment.apiUrl}/api/missions/${id}`;
    return this.http
      .put<void>(url, patch)
      .pipe(catchError((err) => this.handleError(err)));
  }

  setMissionComplete(id: string, completed: boolean): Observable<void> {
    const url = `${environment.apiUrl}/api/missions/${id}/complete`;
    return this.http
      .patch<void>(url, { completed })
      .pipe(catchError((err) => this.handleError(err)));
  }

  deleteMission(id: string): Observable<void> {
    const url = `${environment.apiUrl}/api/missions/${id}`;
    return this.http
      .delete<void>(url)
      .pipe(catchError((err) => this.handleError(err)));
  }

  // --- Settings ---

  getSettings(): Observable<Settings> {
    const url = `${environment.apiUrl}/api/settings`;
    return this.http
      .get<Settings>(url)
      .pipe(catchError((err) => this.handleError(err)));
  }

  putSettings(settings: Partial<Settings>): Observable<void> {
    const url = `${environment.apiUrl}/api/settings`;
    return this.http
      .put<void>(url, settings)
      .pipe(catchError((err) => this.handleError(err)));
  }

  // --- NPC Friendship ---

  getNpcFriendship(): Observable<Record<string, { completedCount: number; level: number }>> {
    const url = `${environment.apiUrl}/api/npc-friendship`;
    return this.http
      .get<Record<string, { completedCount: number; level: number }>>(url)
      .pipe(catchError((err) => this.handleError(err)));
  }

  putNpcFriendship(map: Record<string, { completedCount: number; level: number }>): Observable<void> {
    const url = `${environment.apiUrl}/api/npc-friendship`;
    return this.http
      .put<void>(url, { friendship: map })
      .pipe(catchError((err) => this.handleError(err)));
  }

  private handleError(err: unknown): Observable<never> {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      return throwError(() => new AuthRequiredError());
    }
    return throwError(() => err);
  }
}
