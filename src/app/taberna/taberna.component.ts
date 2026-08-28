import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NPCS } from './taberna.data';
import { TabernaService } from './taberna.service';
import { Npc, NpcMissionTemplate } from './taberna.types';
import { NpcDialogComponent } from './npc-dialog.component';
import { CharacterComponent } from './character.component';

const FRIENDSHIP_MAX = 6;

@Component({
  selector: 'app-taberna',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NpcDialogComponent, CharacterComponent],
  templateUrl: './taberna.component.html',
  styleUrl: './taberna.component.scss',
})
export class TabernaComponent {
  private readonly taberna = inject(TabernaService);

  readonly npcs = NPCS;

  readonly selectedNpc = signal<Npc | null>(null);

  readonly feedback = signal<string | null>(null);

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  levelOf(npcId: string): number {
    return this.taberna.levelOf(npcId);
  }

  friendshipPct(npcId: string): number {
    return Math.min((this.taberna.levelOf(npcId) / FRIENDSHIP_MAX) * 100, 100);
  }

  openDialog(npc: Npc): void {
    this.selectedNpc.set(npc);
  }

  onAccept(template: NpcMissionTemplate): void {
    const npc = this.selectedNpc();
    if (!npc) {
      return;
    }
    this.taberna.accept(npc, template);
    this.showFeedback('Missão enviada ao mural!');
  }

  onClose(): void {
    this.selectedNpc.set(null);
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
    this.feedbackTimer = setTimeout(() => this.feedback.set(null), 4000);
  }
}
