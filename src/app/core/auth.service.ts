import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';

export type AuthUser = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthUser | null>(null);

  async load(): Promise<void> {
    const url = `${environment.apiUrl}/api/me`;
    try {
      const payload = await firstValueFrom(
        this.http.get<AuthUser>(url, { withCredentials: true }),
      );
      this.user.set(payload);
    } catch (err) {
      // Handle all errors gracefully - if backend is down or any other error,
      // just treat as unauthenticated. Don't throw to prevent APP_INITIALIZER failure.
      this.user.set(null);
    }
  }

  login(): void {
    window.location.href = `${environment.apiUrl}/api/auth/google`;
  }

  async logout(): Promise<void> {
    const url = `${environment.apiUrl}/api/auth/logout`;
    await firstValueFrom(
      this.http.post<void>(url, {}, { withCredentials: true }),
    );
    this.user.set(null);
  }
}
