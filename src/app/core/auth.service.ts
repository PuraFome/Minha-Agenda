import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';

export type AuthUser = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

export const AUTH_TOKEN_KEY = 'ma.auth.token';

/**
 * Bearer-token session store. The OAuth callback lands back on the SPA with
 * `#token=<opaque>`; browsers never send fragments to servers, so the token
 * survives cross-site hosting (github.io page -> onrender.com API) where
 * third-party cookies are blocked.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthUser | null>(null);

  /** Persist the token delivered in the redirect fragment and clean the URL. */
  consumeLoginFragment(): void {
    const match = /^#token=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
    const token = match?.[1];
    if (!token) {
      return;
    }
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  token(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  async load(): Promise<void> {
    if (!this.token()) {
      this.user.set(null);
      return;
    }
    try {
      const payload = await firstValueFrom(
        this.http.get<AuthUser>(`${environment.apiUrl}/api/me`, {
          headers: this.authHeaders(),
        }),
      );
      this.user.set(payload);
    } catch {
      // Unknown/expired token or backend down: treat as unauthenticated.
      this.clearToken();
      this.user.set(null);
    }
  }

  login(): void {
    window.location.href = `${environment.apiUrl}/api/auth/google`;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/auth/logout`, {}, {
          headers: this.authHeaders(),
        }),
      );
    } finally {
      this.clearToken();
      this.user.set(null);
    }
  }

  async deleteAccount(): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/api/auth/account`, {
        headers: this.authHeaders(),
      }),
    );
    this.clearToken();
    this.user.set(null);
  }

  private authHeaders(): HttpHeaders {
    const token = this.token();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  private clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}
