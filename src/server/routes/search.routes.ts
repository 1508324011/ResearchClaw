import http from 'http';
import {
  SearchRequestSchema,
  SearchResponseSchema,
  type PaperSummary,
  type SearchResultItem,
} from '@shared';
import { ZodError } from 'zod';
import { PapersService } from '../../main/services/papers.service';
import { SemanticSearchService } from '../../main/services/semantic-search.service';

type RoutePaper = NonNullable<Awaited<ReturnType<PapersService['getById']>>>;

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function getPathname(req: http.IncomingMessage): string {
  return (req.url ?? '/').split('?')[0];
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toYear(value: Date | string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getUTCFullYear();
}

function toOptionalUrl(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function mapPaperSummary(paper: RoutePaper): PaperSummary {
  return {
    id: paper.id,
    shortId: paper.shortId,
    title: paper.title,
    authors: paper.authors,
    year: toYear(paper.submittedAt),
    abstract: paper.abstract ?? undefined,
    tagNames: paper.tagNames,
    sourceUrl: toOptionalUrl(paper.sourceUrl),
    createdAt: toIsoString(paper.createdAt),
    updatedAt: toIsoString(paper.updatedAt),
  };
}

function mapSearchResult(paper: RoutePaper, score?: number): SearchResultItem {
  return {
    ...mapPaperSummary(paper),
    score,
    excerpt: paper.abstract ?? undefined,
  };
}

export function isSearchRoute(req: http.IncomingMessage): boolean {
  return req.method === 'GET' && getPathname(req) === '/search';
}

export async function handleSearchRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  papersService: PapersService = new PapersService(),
  semanticSearchService: SemanticSearchService = new SemanticSearchService(),
): Promise<void> {
  try {
    const url = new URL(req.url ?? '/search', 'http://127.0.0.1');
    const rawLimit = url.searchParams.get('limit');
    const rawMode = url.searchParams.get('mode') ?? undefined;
    const request = SearchRequestSchema.parse({
      query: url.searchParams.get('q') ?? url.searchParams.get('query') ?? '',
      limit: rawLimit ? Number.parseInt(rawLimit, 10) : undefined,
      mode: rawMode,
    });

    if (request.mode === 'semantic') {
      const result = await semanticSearchService.search(request.query, request.limit);
      const resolvedResults = await Promise.all(
        result.papers.map(async (paper) => {
          const fullPaper = await papersService.getById(paper.id);
          return fullPaper ? mapSearchResult(fullPaper, paper.finalScore) : null;
        }),
      );

      const response = SearchResponseSchema.parse({
        mode: result.mode === 'semantic' ? 'semantic' : 'text',
        results: resolvedResults.filter((paper): paper is SearchResultItem => paper !== null),
        total: resolvedResults.filter((paper): paper is SearchResultItem => paper !== null).length,
      });

      sendJson(res, 200, response);
      return;
    }

    const matches = await papersService.list({ q: request.query });
    const limitedMatches = request.limit ? matches.slice(0, request.limit) : matches;
    const response = SearchResponseSchema.parse({
      mode: 'text',
      results: limitedMatches.map((paper) => mapSearchResult(paper)),
      total: matches.length,
    });

    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(res, 400, { error: 'Invalid search request.' });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
