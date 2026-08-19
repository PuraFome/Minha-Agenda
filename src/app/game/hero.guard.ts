import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { GameService } from './game.service';

/**
 * Guard de primeiro acesso: bloqueia rotas que exigem um herói.
 *
 * Se o herói ainda não existe, redireciona para `/perfil` (onde ele é criado).
 * Caso contrário, permite a navegação.
 */
export const heroGuard: CanActivateFn = () => {
  const gameService = inject(GameService);
  const router = inject(Router);
  return gameService.hero() ? true : router.createUrlTree(['/perfil']);
};
