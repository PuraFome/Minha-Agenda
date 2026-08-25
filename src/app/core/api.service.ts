import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

export class AuthRequiredError extends Error {
  constructor(message = 'AUTH_REQUIRED') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getCollection(name: string): Observable<unknown> {
    const url = `${environment.apiUrl}/api/data/${name}`;
    return this.http
      .get<unknown>(url, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  putCollection(name: string, payload: unknown): Observable<void> {
    const url = `${environment.apiUrl}/api/data/${name}`;
    return this.http
      .put<void>(url, payload, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err)));
  }

  private handleError(err: unknown): Observable<never> {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      return throwError(() => new AuthRequiredError());
    }
    return throwError(() => err);
  }
}
