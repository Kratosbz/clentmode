import { z } from 'zod';
import { stats, nfts, activities } from './schema';

export const errorSchemas = {
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  dashboard: {
    getStats: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.custom<typeof stats.$inferSelect>(),
      },
    },
    getNfts: {
      method: 'GET' as const,
      path: '/api/nfts',
      responses: {
        200: z.object({
          owned: z.array(z.custom<typeof nfts.$inferSelect>()),
          listed: z.array(z.custom<typeof nfts.$inferSelect>()),
          liked: z.array(z.custom<typeof nfts.$inferSelect>()),
          counts: z.object({
            owned: z.number(),
            listed: z.number(),
            liked: z.number(),
          })
        }),
      },
    },
    getActivities: {
      method: 'GET' as const,
      path: '/api/activities',
      responses: {
        200: z.array(z.custom<typeof activities.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
