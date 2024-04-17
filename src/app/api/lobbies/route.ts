import { db } from '@/server/db/client';
import { lobbies } from '@/server/db/schema';

export const dynamic = 'force-dynamic';

export async function POST() {
  const lobby = await db.insert(lobbies).values({}).returning();

  return Response.json({
    lobbyId: lobby[0].id,
  });
}
