export type Difficulty = 'facil' | 'media' | 'dificil' | 'muito-dificil' | 'epica';

export type HeroClass = 'guerreiro' | 'mago' | 'ladino' | 'clerigo';

export interface Hero {
  name: string;
  heroClass: HeroClass;
  totalXp: number;
}

export interface Mission {
  id: string;
  title: string;
  difficulty: Difficulty;
  dueDate?: string | null;
  completed: boolean;
  completedAt?: string | null;
  source?: 'manual' | 'npc';
  npcId?: string | null;
  npcName?: string | null;
  npcAvatar?: string | null;
  templateId?: string | null;
}

export const XP_TABLE: Record<Difficulty, number> = {
  facil: 10,
  media: 20,
  dificil: 35,
  'muito-dificil': 60,
  epica: 100,
} as const;

export const HERO_CLASSES: readonly HeroClass[] = [
  'guerreiro',
  'mago',
  'ladino',
  'clerigo',
] as const;

export const DIFFICULTIES: readonly Difficulty[] = [
  'facil',
  'media',
  'dificil',
  'muito-dificil',
  'epica',
] as const;
