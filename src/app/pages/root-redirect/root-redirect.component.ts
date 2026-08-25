import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';

/**
 * Rota raiz (`''`): despacha automaticamente com base no estado de autenticação.
 *
 * - Logado  → `/mural` (o mural do usuário com suas missões)
 * - Anônimo → `/login`
 *
 * Implementado como componente (em vez de `redirectTo` + guarda) porque o Angular
 * proíbe `redirectTo` e `canActivate` no mesmo nó de rota (NG04014).
 */
@Component({
  selector: 'app-root-redirect',
  template: '',
})
export class RootRedirectComponent {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    router.navigateByUrl(auth.user() ? '/mural' : '/login');
  }
}
