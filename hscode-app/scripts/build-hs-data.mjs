// Dev-time script: downloads the open HS dataset and writes bundled JSON into src/data/.
// The app never fetches this dataset at runtime. Run with: npm run data:hs
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_CSV =
  'https://raw.githubusercontent.com/datasets/harmonized-system/main/data/harmonized-system.csv';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Keep chapters 01-97 except 77 (reserved); drops 98/99 and non-standard chapters.
const keepChapter = (c) => /^\d{2}$/.test(c) && +c >= 1 && +c <= 97 && c !== '77';

const res = await fetch(URL_CSV);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const [header, ...rows] = parseCsv(await res.text());
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
for (const k of ['hscode', 'description', 'level']) {
  if (!(k in col)) throw new Error(`Missing column ${k}; got ${header.join(',')}`);
}

const ar = JSON.parse(await readFile(join(root, 'hs-chapters-ar.json'), 'utf8'));
const chapters = [];
const headings = [];
const subs = {};
for (const r of rows) {
  const code = r[col.hscode].trim();
  const en = r[col.description].trim();
  const level = r[col.level].trim();
  if (!keepChapter(code.slice(0, 2))) continue;
  if (level === '2') {
    if (!ar[code]) throw new Error(`No Arabic title for chapter ${code}`);
    chapters.push({ code, en, ar: ar[code] });
  } else if (level === '4') headings.push({ code, en });
  else if (level === '6') (subs[code.slice(0, 2)] ??= []).push({ code, en });
}

await rm(join(root, 'hs-sub'), { recursive: true, force: true });
await mkdir(join(root, 'hs-sub'), { recursive: true });
const out = (f, d) => writeFile(join(root, f), JSON.stringify(d) + '\n');
await out('hs-chapters.json', chapters);
await out('hs-headings.json', headings);
for (const [ch, list] of Object.entries(subs)) await out(`hs-sub/${ch}.json`, list);
console.log(`chapters=${chapters.length} headings=${headings.length} subheadings=${Object.values(subs).flat().length} files=${Object.keys(subs).length}`);
