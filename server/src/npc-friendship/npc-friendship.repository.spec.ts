import { describe, expect, it } from 'vitest';
import {
  NpcFriendshipRepository,
  NpcFriendshipEntry,
} from '../db/npc-friendship.repository';

// Hermetic in-memory stub of NpcFriendshipRepository. No DATABASE_URL / pg
// connection. State is keyed by userId -> (npcId -> completedCount). `level` is
// derived 1:1 from `completedCount` on read, mirroring the real repository.
// `putFriendship` rejects a negative `completedCount`, simulating the DB
// `CHECK (completed_count >= 0)` constraint.
const friendshipStore = new Map<string, Map<string, number>>();

const friendshipRepo: Partial<NpcFriendshipRepository> = {
  getFriendship: async (
    userId: string,
  ): Promise<Record<string, { completedCount: number; level: number }>> => {
    const userMap = friendshipStore.get(userId) ?? new Map();
    const map: Record<string, { completedCount: number; level: number }> = {};
    for (const [npcId, completedCount] of userMap.entries()) {
      map[npcId] = { completedCount, level: completedCount };
    }
    return map;
  },
  putFriendship: async (
    userId: string,
    entries: { npcId: string; completedCount: number }[],
  ): Promise<void> => {
    let userMap = friendshipStore.get(userId);
    if (!userMap) {
      userMap = new Map();
      friendshipStore.set(userId, userMap);
    }
    for (const entry of entries) {
      if (entry.completedCount < 0) {
        throw new Error('CHECK (completed_count >= 0) violated');
      }
      userMap.set(entry.npcId, entry.completedCount);
    }
  },
};

const repo = friendshipRepo as NpcFriendshipRepository;

describe('NpcFriendshipRepository (hermetic stub)', () => {
  it('getFriendship returns {} when there are no rows', async () => {
    const result = await repo.getFriendship('user-empty');
    expect(result).toEqual({});
  });

  it('putFriendship then getFriendship returns a map keyed by npcId with level === completedCount', async () => {
    const entries: NpcFriendshipEntry[] = [
      { npcId: 'npc-1', completedCount: 3, level: 3 },
      { npcId: 'npc-2', completedCount: 0, level: 0 },
    ];
    await repo.putFriendship('user-1', entries);
    const result = await repo.getFriendship('user-1');
    expect(result).toEqual({
      'npc-1': { completedCount: 3, level: 3 },
      'npc-2': { completedCount: 0, level: 0 },
    });
    expect(result['npc-1'].level).toBe(result['npc-1'].completedCount);
  });

  it('putFriendship with completedCount < 0 throws (CHECK constraint)', async () => {
    await expect(
      repo.putFriendship('user-bad', [{ npcId: 'npc-x', completedCount: -1 }]),
    ).rejects.toThrow();
  });
});
