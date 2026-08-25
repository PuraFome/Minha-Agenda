import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { Hero, Mission } from '../game/game.types';

export interface Settings {
  retentionDays: number;
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
      .get<Hero>(url, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  putHero(hero: Hero): Observable<void> {
    const url = `${environment.apiUrl}/api/hero`;
    return this.http
      .put<void>(url, hero, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  addXp(delta: number): Observable<void> {
    const url = `${environment.apiUrl}/api/hero/xp`;
    return this.http
      .patch<void>(url, { delta }, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  deleteHero(): Observable<void> {
    const url = `${environment.apiUrl}/api/hero`;
    return this.http
      .delete<void>(url, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // --- Missions ---

  listMissions(): Observable<Mission[]> {
    const url = `${environment.apiUrl}/api/missions`;
    return this.http
      .get<Mission[]>(url, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  createMission(mission: Mission): Observable<Mission> {
    const url = `${environment.apiUrl}/api/missions`;
    return this.http
      .post<Mission>(url, mission, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  updateMission(id: string, patch: Partial<Mission>): Observable<void> {
    const url = `${environment.apiUrl}/api/missions/${id}`;
    return this.http
      .put<void>(url, patch, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  setMissionComplete(id: string, completed: boolean): Observable<void> {
    const url = `${environment.apiUrl}/api/missions/${id}/complete`;
    return this.http
      .patch<void>(url, { completed }, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  deleteMission(id: string): Observable<void> {
    const url = `${environment.apiUrl}/api/missions/${id}`;
    return this.http
      .delete<void>(url, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // --- Settings ---

  getSettings(): Observable<Settings> {
    const url = `${environment.apiUrl}/api/settings`;
    return this.http
      .get<Settings>(url, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  putSettings(settings: Settings): Observable<void> {
    const url = `${environment.apiUrl}/api/settings`;
    return this.http
      .put<void>(url, settings, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  private handleError(err: unknown): Observable<never> {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      return throwError(() => new AuthRequiredError());
    }
    return throwError(() => err);
  }
}
