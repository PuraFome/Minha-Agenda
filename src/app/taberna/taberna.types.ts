import { Difficulty } from '../game/game.types';

export interface NpcMissionTemplate {
  templateId: string;
  title: string;
  difficulty: Difficulty;
  prazoDays: number;
  minFriendship: number;
  banter?: string;
}

/** Silhueta/arquétipo do personagem, usado para desenhar o retrato SVG. */
export type CharacterKind = 'grandma' | 'soldier' | 'bard' | 'monk' | 'baron';

/** Representação visual do personagem (cores para o retrato SVG) */
export interface CharacterAppearance {
  /** Arquétipo que define o desenho do personagem */
  kind: CharacterKind;
  /** Cor principal da pele */
  skinColor: string;
  /** Cor do cabelo */
  hairColor: string;
  /** Cor da roupa principal */
  outfitColor: string;
  /** Cor de destaque/acessório */
  accentColor: string;
  /** Estilo do cabelo (curto, longo, careca, etc.) */
  hairStyle: 'short' | 'long' | 'bald' | 'bun' | 'military' | 'hood';
  /** Acessório especial (óculos, chapéu, etc.) */
  accessory?: 'glasses' | 'hat' | 'monocle' | 'bandana';
  /** Expressão facial */
  expression: 'stern' | 'warm' | 'mysterious' | 'jolly' | 'wise';
}

/** Nó de diálogo - uma fala do NPC com possíveis respostas */
export interface DialogNode {
  /** ID único do nó */
  id: string;
  /** Texto que o NPC fala */
  text: string;
  /** Respostas disponíveis para o jogador */
  choices?: DialogChoice[];
  /** Se não tiver choices, é o fim do diálogo */
  isEnd?: boolean;
}

/** Escolha do jogador no diálogo */
export interface DialogChoice {
  /** Texto da opção do jogador */
  text: string;
  /** ID do próximo nó de diálogo */
  nextNodeId: string;
  /** Se esta escolha leva a uma missão */
  missionId?: string;
}

/** Árvore de diálogo completa do NPC */
export interface DialogTree {
  /** ID do nó inicial */
  startNodeId: string;
  /** Mapa de todos os nós */
  nodes: Record<string, DialogNode>;
}

export interface Npc {
  id: string;
  name: string;
  avatar: string;
  role: string;
  greeting: string;
  missions: NpcMissionTemplate[];
  /** Aparência visual do personagem para CSS art */
  appearance: CharacterAppearance;
  /** Árvore de diálogos RPG */
  dialogTree: DialogTree;
}

export interface NpcFriendshipEntry {
  completedCount: number;
  level: number;
}

export type NpcFriendshipMap = Record<string, NpcFriendshipEntry>;

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  facil: '#3f9d57',
  media: '#3b7dd8',
  dificil: '#d98a2b',
  'muito-dificil': '#8a4fd0',
  epica: '#c05621',
};
