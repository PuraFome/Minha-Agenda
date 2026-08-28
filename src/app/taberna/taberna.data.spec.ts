import { describe, it, expect } from 'vitest';
import { NPCS } from './taberna.data';
import { DIFFICULTIES } from '../game/game.types';

describe('NPCS roster (taberna.data.ts)', () => {
  it('should contain exactly 5 NPCs', () => {
    expect(NPCS).toHaveLength(5);
  });

  it('should have unique NPC ids', () => {
    const ids = NPCS.map((npc) => npc.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have well-formed fields on every NPC', () => {
    for (const npc of NPCS) {
      expect(typeof npc.id).toBe('string');
      expect(npc.id.length).toBeGreaterThan(0);
      expect(typeof npc.name).toBe('string');
      expect(npc.name.length).toBeGreaterThan(0);
      expect(typeof npc.avatar).toBe('string');
      expect(npc.avatar.length).toBeGreaterThan(0);
      expect(typeof npc.role).toBe('string');
      expect(npc.role.length).toBeGreaterThan(0);
      expect(typeof npc.greeting).toBe('string');
      expect(npc.greeting.length).toBeGreaterThan(0);
    }
  });

  it('should give every NPC at least one mission', () => {
    for (const npc of NPCS) {
      expect(npc.missions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have unique templateIds within each NPC', () => {
    for (const npc of NPCS) {
      const templateIds = npc.missions.map((m) => m.templateId);
      expect(new Set(templateIds).size).toBe(templateIds.length);
    }
  });

  it('should have globally unique templateIds', () => {
    const allTemplateIds = NPCS.flatMap((npc) => npc.missions.map((m) => m.templateId));
    expect(new Set(allTemplateIds).size).toBe(allTemplateIds.length);
  });

  it('should use only valid DIFFICULTIES for every mission', () => {
    const valid = new Set<string>(DIFFICULTIES as readonly string[]);
    for (const npc of NPCS) {
      for (const mission of npc.missions) {
        expect(valid.has(mission.difficulty)).toBe(true);
      }
    }
  });

  it('should have minFriendship >= 0 on every mission', () => {
    for (const npc of NPCS) {
      for (const mission of npc.missions) {
        expect(mission.minFriendship).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should have exactly 3 base missions (minFriendship 0) and unlockables at 3/5/6', () => {
    for (const npc of NPCS) {
      const base = npc.missions.filter((m) => m.minFriendship === 0);
      expect(base).toHaveLength(3);

      const unlockables = npc.missions
        .filter((m) => m.minFriendship !== 0)
        .map((m) => m.minFriendship)
        .sort((a, b) => a - b);
      expect(unlockables).toEqual([3, 5, 6]);
    }
  });

  it('should have prazoDays as an integer > 0 on every mission', () => {
    for (const npc of NPCS) {
      for (const mission of npc.missions) {
        expect(Number.isInteger(mission.prazoDays)).toBe(true);
        expect(mission.prazoDays).toBeGreaterThan(0);
      }
    }
  });
});
