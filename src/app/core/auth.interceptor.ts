import { HttpInterceptorFn } from '@angular/common/http';

import { AUTH_TOKEN_KEY } from './auth.service';

/**
 * Attaches the bearer token to every outgoing API request. Requests without a
 * stored token pass through untouched (e.g. the login page before auth).
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
