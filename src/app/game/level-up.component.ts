import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { GameService } from './game.service';

/**
 * Overlay de celebração exibido quando o herói sobe de nível.
 *
 * - Não aparece no carregamento inicial: `shownLevel` é semeado com o nível atual.
 * - Um `effect()` observa `level()`; quando ele ultrapassa `shownLevel()`, o overlay
 *   abre e `shownLevel` é atualizado para não repetir a celebração do mesmo nível.
 * - Foco: ao abrir, move para o botão de fechar; ao fechar, restaura o foco anterior.
 */
@Component({
  selector: 'app-level-up',
  imports: [],
  templateUrl: './level-up.component.html',
  styleUrl: './level-up.component.scss',
})
export class LevelUpComponent {
  private readonly gameService = inject(GameService);
  private readonly document = inject(DOCUMENT);

  readonly level = this.gameService.level;

  /** Controla a visibilidade do overlay. */
  readonly visible = signal(false);

  /** Último nível já celebrado — evita o overlay no primeiro carregamento. */
  private readonly shownLevel = signal(this.gameService.level());

  /** Botão de fechar, alvo do foco ao abrir o overlay. */
  private readonly dismissBtn = viewChild<ElementRef<HTMLButtonElement>>('dismissBtn');

  private lastFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const current = this.level();
      if (current > this.shownLevel()) {
        this.shownLevel.set(current);
        this.visible.set(true);
      }
    });

    // Gestão de foco: ao abrir, foca o botão de fechar; ao fechar, restaura o foco anterior.
    effect(() => {
      if (this.visible()) {
        this.lastFocused = this.document.activeElement as HTMLElement | null;
        this.dismissBtn()?.nativeElement.focus();
      } else if (this.lastFocused) {
        this.lastFocused.focus();
        this.lastFocused = null;
      }
    });
  }

  dismiss(): void {
    this.visible.set(false);
  }
}