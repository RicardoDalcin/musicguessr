export const dynamic = 'force-dynamic';

import { Playlist } from '@/types';
import { cookies } from 'next/headers';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  let token = cookies().get('spotify_access_token')?.value ?? '';

  if (!token) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SPOTIFY_CLIENT_ID ?? '',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
      }),
    });

    const access: {
      access_token: string;
      token_type: string;
      expires_in: number;
    } = await response.json();

    cookies().set('spotify_access_token', access.access_token, {
      expires: new Date(Date.now() + access.expires_in * 1000),
    });

    token = access.access_token;
  }

  const response = await fetch(
    new URL(`https://api.spotify.com/v1/playlists/${params.id}`).toString(),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = (await response.json()) as Playlist;

  return Response.json({ data });
}
