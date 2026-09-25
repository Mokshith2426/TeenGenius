/**
 * Local validation harness for the SSRF guard and the source extractor.
 * Run with:  npx tsx scripts/verify-url-pipeline.ts
 * (Not part of the app bundle; delete before committing if unwanted.)
 */
import {
  parseSafeUrl,
  isPrivateAddress,
} from '../server/utils/helpers';
import { extractYouTubeVideoId, isYouTubeUrl } from '../server/services/source-extractor.service';

let pass = 0;
let fail = 0;

const check = (name: string, actual: string, expected: string) => {
  if (actual === expected) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} -> got "${actual}", expected "${expected}"`);
  }
};

const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'ALLOW';
  } catch (err: any) {
    return err?.code || 'ALLOW';
  }
};

async function main() {
  console.log('\n== URL validation (SSRF guard) ==');

  // Synchronous rejections (thrown before any DNS lookup).
  for (const [url, expected] of [
    ['file:///etc/passwd', 'URL_INVALID'],
    ['ftp://example.com/x', 'URL_INVALID'],
    ['javascript:alert(1)', 'URL_INVALID'],
    ['http://user:pass@example.com/', 'URL_INVALID'],
    ['not a url', 'URL_INVALID'],
    ['', 'URL_INVALID'],
    ['http://127.0.0.1/', 'URL_BLOCKED'],
    ['http://localhost:3001/', 'URL_BLOCKED'],
    ['http://0.0.0.0/', 'URL_BLOCKED'],
    ['http://169.254.169.254/latest/meta-data/', 'URL_BLOCKED'],
    ['http://10.0.0.5/', 'URL_BLOCKED'],
    ['http://192.168.1.1/', 'URL_BLOCKED'],
    ['http://172.16.0.1/', 'URL_BLOCKED'],
    ['http://172.31.255.1/', 'URL_BLOCKED'],
    ['http://[::1]/', 'URL_BLOCKED'],
    ['http://metadata.google.internal/', 'URL_BLOCKED'],
    ['http://printer.local/', 'URL_BLOCKED'],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    let got = 'ALLOW';
    try {
      await parseSafeUrl(url);
    } catch (err: any) {
      got = err?.code || 'ALLOW';
    }
    check(url || '(empty)', got, expected);
  }

  console.log('\n== Private address classification ==');
  check('8.8.8.8 public', String(isPrivateAddress('8.8.8.8')), 'false');
  check('1.1.1.1 public', String(isPrivateAddress('1.1.1.1')), 'false');
  check('100.64.0.1 CGNAT', String(isPrivateAddress('100.64.0.1')), 'true');
  check('224.0.0.1 multicast', String(isPrivateAddress('224.0.0.1')), 'true');
  check('::ffff:10.1.2.3 mapped', String(isPrivateAddress('::ffff:10.1.2.3')), 'true');
  check('fd00::/8 ULA', String(isPrivateAddress('fd00::1')), 'true');

  console.log('\n== YouTube URL parsing ==');
  const ytCases: Array<[string, string | null]> = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=30', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/playlist?list=PLabc', null],
    ['https://www.youtube.com/@somechannel', null],
  ];
  for (const [url, expected] of ytCases) {
    const id = extractYouTubeVideoId(new URL(url));
    check(url, id ?? 'null', expected ?? 'null');
  }

  console.log('\n== YouTube host detection ==');
  check('youtube.com is YouTube', String(isYouTubeUrl(new URL('https://youtube.com/x'))), 'true');
  check('youtu.be is YouTube', String(isYouTubeUrl(new URL('https://youtu.be/x'))), 'true');
  check('example.com is not', String(isYouTubeUrl(new URL('https://example.com/x'))), 'false');

  console.log(`\n${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exitCode = 1;
}

void main();
