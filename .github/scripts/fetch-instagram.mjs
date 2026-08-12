#!/usr/bin/env node
// Pulls the live @thirsty.planet feed into this repo (posts.json + assets/ig/).
// Runs both on a Mac and on the Linux CI runner, so image resizing falls back
// through sips, ImageMagick, then leaves the original alone.
//
// Needs IG_ACCESS_TOKEN in the environment (a GitHub Actions secret in CI,
// or .env at the project root locally).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GRAPH = 'https://graph.instagram.com';

const token = (process.env.IG_ACCESS_TOKEN || '').trim();
if (!token) {
  console.error('IG_ACCESS_TOKEN is not set.');
  process.exit(1);
}

async function get(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${JSON.stringify(body.error || body)}`);
  return body;
}

// Order matters: first match wins. featured.json can override any of this.
const SERIES = [
  { re: /myth|bottled/i,       kicker: 'MYTH',               accent: '#E8C98A' },
  { re: /thirsty places|singapore|cape town|\baral\b/i, kicker: 'THIRSTY PLACES', accent: '#5DAEFF' },
  { re: /industries|fashion withdraws|dyeing mill/i, kicker: 'THIRSTY INDUSTRIES', accent: '#8FC3EC' },
  { re: /plain ?water|wastewater|\bCOD\b|\bETP\b|sludge|flush|treatment plant/i, kicker: 'PLAIN WATER', accent: '#7FD9C8' },
  { re: /inside:/i,            kicker: 'INSIDE',             accent: '#AFC3D4' },
  { re: /you asked/i,          kicker: 'YOU ASKED',          accent: '#8EA6C0' },
  { re: /thirsty:|litres? of water|litres for one|takes about [\d,]+ ?litres/i, kicker: 'THIRSTY', accent: '#8FC3EC' },
];

function has(cmd) {
  try { execFileSync('which', [cmd], { stdio: 'pipe' }); return true; } catch { return false; }
}
const RESIZER = has('sips') ? 'sips' : has('magick') ? 'magick' : has('convert') ? 'convert' : null;
if (!RESIZER) console.warn('No image resizer found; keeping originals.');

function resize(file, width) {
  try {
    if (RESIZER === 'sips') {
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '--resampleWidth', String(width), file, '--out', file], { stdio: 'pipe' });
    } else if (RESIZER === 'magick') {
      execFileSync('magick', [file, '-resize', `${width}x`, '-quality', '80', file], { stdio: 'pipe' });
    } else if (RESIZER === 'convert') {
      execFileSync('convert', [file, '-resize', `${width}x`, '-quality', '80', file], { stdio: 'pipe' });
    }
  } catch (err) {
    console.warn(`resize failed for ${path.basename(file)}: ${err.message.split('\n')[0]}`);
  }
}

async function download(mediaUrl, dest, width) {
  if (fs.existsSync(dest)) return;           // already have it, leave it alone
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  resize(dest, width);
}

const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type,thumbnail_url}';
let url = `${GRAPH}/me/media?fields=${FIELDS}&limit=50&access_token=${token}`;
const media = [];
while (url && media.length < 200) {
  const page = await get(url);
  media.push(...page.data);
  url = page.paging?.next;
}
console.log(`fetched ${media.length} posts from Instagram`);

const igDir = path.join(root, 'assets', 'ig');
fs.mkdirSync(igDir, { recursive: true });

const manifest = [];
for (const m of media) {
  const caption = m.caption || '';
  const firstLine = caption.split('\n')[0].trim();
  const series = SERIES.find(s => s.re.test(caption.slice(0, 400)));
  const items = m.media_type === 'CAROUSEL_ALBUM' ? m.children.data : [m];
  const rel = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const src = it.media_type === 'VIDEO' ? it.thumbnail_url : it.media_url;
    if (!src) continue;
    const file = `assets/ig/${m.id}/${String(i + 1).padStart(2, '0')}.jpg`;
    await download(src, path.join(root, file), i === 0 ? 1080 : 720);
    rel.push(file);
  }
  if (!rel.length) continue;
  manifest.push({
    slug: m.id,
    title: firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine,
    kicker: series?.kicker || 'THIRSTY PLANET',
    accent: series?.accent || '#8FC3EC',
    caption,
    permalink: m.permalink,
    timestamp: m.timestamp,
    slides: rel,
  });
}

// Drop media for posts that are no longer on the account.
const live = new Set(manifest.map(p => p.slug));
for (const dir of fs.readdirSync(igDir)) {
  if (!live.has(dir)) {
    fs.rmSync(path.join(igDir, dir), { recursive: true, force: true });
    console.log(`removed media for deleted post ${dir}`);
  }
}

fs.writeFileSync(path.join(root, 'posts.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`posts.json: ${manifest.length} posts`);
