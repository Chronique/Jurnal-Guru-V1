/**
 * Vercel KV (Upstash Redis) REST API client
 *
 * Di Vercel Dashboard → Settings → Environment Variables, tambahkan:
 *   VITE_KV_REST_API_URL    → salin nilai dari KV_REST_API_URL
 *   VITE_KV_REST_API_TOKEN  → salin nilai dari KV_REST_API_TOKEN
 */

const REDIS_URL = import.meta.env.VITE_KV_REST_API_URL;
const REDIS_TOKEN = import.meta.env.VITE_KV_REST_API_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.warn(
    '[Redis] VITE_KV_REST_API_URL atau VITE_KV_REST_API_TOKEN belum diset.\n' +
    'Tambahkan di Vercel Dashboard → Settings → Environment Variables.'
  );
}

async function redisRequest<T>(command: (string | number)[]): Promise<T> {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.result as T;
}

export const redis = {
  async set(key: string, value: unknown): Promise<void> {
    await redisRequest(['SET', key, JSON.stringify(value)]);
  },

  async get<T>(key: string): Promise<T | null> {
    const result = await redisRequest<string | null>(['GET', key]);
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  },

  async del(key: string): Promise<void> {
    await redisRequest(['DEL', key]);
  },
};