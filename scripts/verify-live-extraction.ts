/**
 * Live smoke test for the outbound fetch + extraction path.
 * Run with:  npx tsx scripts/verify-live-extraction.ts
 * This makes real network calls, so it is a manual check, not a unit test.
 */
import { extractSource } from '../server/services/source-extractor.service';

const ARTICLE_URL = process.env.SMOKE_ARTICLE_URL || 'https://example.com/';
const YOUTUBE_URL =
  process.env.SMOKE_YOUTUBE_URL || 'https://www.youtube.com/watch?v=aircAruvnKk';

async function tryExtract(label: string, url: string) {
  console.log(`\n--- ${label}: ${url}`);
  try {
    const source = await extractSource(url);
    console.log(`  type      : ${source.type}`);
    console.log(`  title     : ${source.title}`);
    console.log(`  url       : ${source.url}`);
    console.log(`  chars     : ${source.chars}`);
    console.log(`  language  : ${source.language ?? '-'}`);
    console.log(`  preview   : ${source.text.slice(0, 220).replace(/\s+/g, ' ')}...`);
    console.log('  RESULT    : extracted OK');
  } catch (err: any) {
    console.log(`  code      : ${err?.code ?? 'UNKNOWN'}`);
    console.log(`  message   : ${err?.message}`);
    console.log('  RESULT    : failed gracefully (no fabricated summary)');
  }
}

async function main() {
  await tryExtract('Article', ARTICLE_URL);
  await tryExtract('YouTube', YOUTUBE_URL);
}

void main();
