// ============================================================================
// NewsData.io API Client — Curfew/Bandh/Strike Detection
// Free tier: 200 credits/day
// ============================================================================

import { fetchWithRetry } from '@/lib/utils/retry';
import { CACHE_TTL } from '@/lib/config/constants';

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: Array<{
    article_id: string;
    title: string;
    description: string | null;
    content: string | null;
    pubDate: string;
    source_name: string;
    category: string[];
    country: string[];
  }>;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  published_at: string;
  source: string;
}

/**
 * Search for curfew/bandh/strike news in India
 */
export async function searchDisruptionNews(): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return [];

  try {
    const query = encodeURIComponent('curfew OR bandh OR strike OR lockdown OR "mobility restriction"');
    const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${query}&country=in&language=en,hi&size=10`;
    const data = await fetchWithRetry<NewsDataResponse>(url, {
      cacheTtlMs: CACHE_TTL.NEWS,
    });

    if (data.status !== 'success' || !data.results) return [];

    return data.results.map((article) => ({
      id: article.article_id,
      title: article.title,
      description: article.description,
      published_at: article.pubDate,
      source: article.source_name,
    }));
  } catch (error) {
    console.error('[NewsData] Error fetching news:', error);
    return [];
  }
}
