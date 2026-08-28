import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TabernaService } from './taberna.service';
import { DIFFICULTY_COLORS, DialogNode, Npc, NpcMissionTemplate } from './taberna.types';
import { Difficulty, Mission } from '../game/game.types';
import { CharacterComponent } from './character.component';

interface MissionCardState {
  template: NpcMissionTemplate;
  unlocked: boolean;
  acceptedPending: boolean;
  level: number;
  prazoLabel: string;
  difficultyColor: string;
}

const DIFFICULTY_ORDER: Difficulty[] = ['facil', 'media', 'dificil', 'muito-dificil', 'epica'];

@Component({
  selector: 'app-npc-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CharacterComponent],
  templateUrl: './npc-dialog.component.html',
  styleUrl: './npc-dialog.component.scss',
})
export class NpcDialogComponent {
  private readonly taberna = inject(TabernaService);

  readonly mode = input<'suggest' | 'congrats'>('suggest');
  readonly npc = input.required<Npc>();
  readonly mission = input<Mission>();

  readonly accept = output<NpcMissionTemplate>();
  readonly repeat = output<Mission>();
  readonly close = output<void>();

  readonly difficultyColors = DIFFICULTY_COLORS;

  readonly difficultyLabels: Record<Difficulty, string> = {
    facil: 'Fácil',
    media: 'Média',
    dificil: 'Difícil',
    'muito-dificil': 'Muito difícil',
    epica: 'Épica',
  };

  readonly currentNode = signal<DialogNode | null>(null);
  readonly displayedText = signal('');
  readonly isTyping = signal(false);
  readonly showChoices = signal(false);

  /** Missão que o NPC deve sugerir, derivada da resposta do jogador. */
  readonly suggestedTemplate = signal<NpcMissionTemplate | null>(null);
  /** Quando true, revela a lista completa de missões (fallback). */
  readonly showAll = signal(false);

  private typewriterInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const npc = this.npc();
      if (npc && this.mode() === 'suggest') {
        this.suggestedTemplate.set(null);
        this.showAll.set(false);
        const startNode = npc.dialogTree.nodes[npc.dialogTree.startNodeId];
        this.currentNode.set(startNode);
        this.typewriteText(startNode.text);
      }
    });
  }

  /** Missão efetivamente sugerida: a preferida se desbloqueada, senão a mais difícil disponível. */
  readonly finalSuggestion = computed<NpcMissionTemplate | null>(() => {
    const npc = this.npc();
    if (!npc) {
      return null;
    }
    const preferred = this.suggestedTemplate();
    if (preferred) {
      const found = npc.missions.find((m) => m.templateId === preferred.templateId);
      if (found && this.taberna.isUnlocked(npc.id, found)) {
        return found;
      }
    }
    const unlocked = npc.missions.filter((m) => this.taberna.isUnlocked(npc.id, m));
    if (unlocked.length === 0) {
      return null;
    }
    return [...unlocked].sort(
      (a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty),
    )[unlocked.length - 1];
  });

  /** Verdadeiro quando o nó atual encerra o diálogo (fim ou sem respostas). */
  readonly atEnd = computed(() => {
    const node = this.currentNode();
    return !!node && (node.isEnd || !node.choices || node.choices.length === 0);
  });

  readonly cards = computed<MissionCardState[]>(() => {
    const npc = this.npc();
    if (!npc) {
      return [];
    }
    const level = this.taberna.levelOf(npc.id);
    return npc.missions.map((t) => ({
      template: t,
      unlocked: this.taberna.isUnlocked(npc.id, t),
      acceptedPending: this.taberna.isAcceptedPending(npc.id, t.templateId),
      level,
      prazoLabel: this.prazoLabel(t.prazoDays),
      difficultyColor: DIFFICULTY_COLORS[t.difficulty],
    }));
  });

  readonly praiseLine = computed(() => {
    const npc = this.npc();
    return npc ? `Que honra, ${npc.name}! Sua bravura será lembrada.` : '';
  });

  /** Verdadeiro se a missão sugerida já foi aceita e segue pendente. */
  readonly suggestionAcceptedPending = computed(() => {
    const npc = this.npc();
    const mission = this.finalSuggestion();
    if (!npc || !mission) {
      return false;
    }
    return this.taberna.isAcceptedPending(npc.id, mission.templateId);
  });

  difficultyLabel(d: Difficulty): string {
    return this.difficultyLabels[d];
  }

  onChoice(nextNodeId: string, missionId?: string): void {
    const npc = this.npc();
    if (!npc) {
      return;
    }

    if (missionId) {
      const template = npc.missions.find((m) => m.templateId === missionId);
      if (template) {
        this.suggestedTemplate.set(template);
      }
    }

    const nextNode = npc.dialogTree.nodes[nextNodeId];
    if (nextNode) {
      this.currentNode.set(nextNode);
      this.showChoices.set(false);
      this.typewriteText(nextNode.text);
    }
  }

  onAcceptMission(template: NpcMissionTemplate): void {
    this.accept.emit(template);
  }

  onRepeat(): void {
    const m = this.mission();
    if (m) {
      this.repeat.emit(m);
    }
  }

  onClose(): void {
    this.cleanupTypewriter();
    this.close.emit();
  }

  toggleAll(): void {
    this.showAll.update((value) => !value);
  }

  private typewriteText(text: string): void {
    this.cleanupTypewriter();
    this.displayedText.set('');
    this.isTyping.set(true);
    let index = 0;

    this.typewriterInterval = setInterval(() => {
      if (index < text.length) {
        this.displayedText.set(text.slice(0, index + 1));
        index++;
      } else {
        this.isTyping.set(false);
        this.showChoices.set(true);
        this.cleanupTypewriter();
      }
    }, 30);
  }

  private cleanupTypewriter(): void {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }
  }

  skipTypewriter(): void {
    const node = this.currentNode();
    if (node && this.isTyping()) {
      this.cleanupTypewriter();
      this.displayedText.set(node.text);
      this.isTyping.set(false);
      this.showChoices.set(true);
    }
  }

  prazoLabel(prazoDays: number): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(today);
    due.setDate(due.getDate() + prazoDays);
    const day = String(due.getDate()).padStart(2, '0');
    const month = String(due.getMonth() + 1).padStart(2, '0');
    return `Prazo: até ${day}/${month}`;
  }
}
