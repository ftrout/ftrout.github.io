/**
 * Social preview images, rendered at build time: satori lays out the card as
 * SVG, resvg rasterises it to PNG. Runs only during the build, so nothing here
 * ships to the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { SITE } from '../consts';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p));

let wasmReady: Promise<void> | undefined;
function ensureWasm() {
  wasmReady ??= initWasm(read('node_modules/@resvg/resvg-wasm/index_bg.wasm'));
  return wasmReady;
}

// satori reads woff/ttf/otf but not woff2, so these come from the static packages.
const fonts = [
  { name: 'Inter', weight: 500, style: 'normal', file: 'node_modules/@fontsource/inter/files/inter-latin-500-normal.woff' },
  { name: 'Inter', weight: 600, style: 'normal', file: 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff' },
  { name: 'Newsreader', weight: 500, style: 'normal', file: 'node_modules/@fontsource/newsreader/files/newsreader-latin-500-normal.woff' },
] as const;

/**
 * Unpack WOFF to a plain SFNT (TTF/OTF) with Node's zlib before satori sees it.
 * satori's own WOFF path inflates with fflate, which package.json overrides to a
 * patched 0.8.x (satori pins 0.7.3); fed WOFF directly, every glyph renders as
 * a blank box.
 */
function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') return woff;
  const numTables = woff.readUInt16BE(12);
  const entries = Array.from({ length: numTables }, (_, i) => {
    const o = 44 + i * 20;
    const tag = woff.subarray(o, o + 4);
    const offset = woff.readUInt32BE(o + 4);
    const compLength = woff.readUInt32BE(o + 8);
    const origLength = woff.readUInt32BE(o + 12);
    const checksum = woff.readUInt32BE(o + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? zlib.inflateSync(raw) : raw;
    return { tag, checksum, data };
  });

  const pad = (n: number) => (n + 3) & ~3;
  const headerSize = 12 + numTables * 16;
  const total = entries.reduce((sum, e) => sum + pad(e.data.length), headerSize);
  const out = Buffer.alloc(total);
  const pow = 2 ** Math.floor(Math.log2(numTables));
  out.writeUInt32BE(woff.readUInt32BE(4), 0); // flavor
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(pow * 16, 6);
  out.writeUInt16BE(Math.log2(pow), 8);
  out.writeUInt16BE(numTables * 16 - pow * 16, 10);

  let offset = headerSize;
  entries.forEach((e, i) => {
    const r = 12 + i * 16;
    e.tag.copy(out, r);
    out.writeUInt32BE(e.checksum, r + 4);
    out.writeUInt32BE(offset, r + 8);
    out.writeUInt32BE(e.data.length, r + 12);
    e.data.copy(out, offset);
    offset += pad(e.data.length);
  });
  return out;
}

let fontData: { name: string; weight: 500 | 600; style: 'normal'; data: Buffer }[] | undefined;
function loadFonts() {
  fontData ??= fonts.map((f) => ({ name: f.name, weight: f.weight, style: f.style, data: woffToSfnt(read(f.file)) }));
  return fontData;
}

let avatarUri: string | undefined;
function avatar() {
  if (!SITE.avatar) return '';
  avatarUri ??= `data:image/jpeg;base64,${read(path.join('public', SITE.avatar)).toString('base64')}`;
  return avatarUri;
}

type Node = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown> } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

const C = { bg: '#f4f2ec', fg: '#1c1b18', fg2: '#4a4843', muted: '#6b675e', rule: '#cfcbc0', accent: '#a8532b' };

export interface OgCard {
  title: string;
  kicker?: string;
}

export async function renderOg({ title, kicker }: OgCard): Promise<Buffer> {
  await ensureWasm();
  const size = title.length > 64 ? 62 : title.length > 40 ? 72 : 84;
  const photo = avatar();

  const card = h(
    'div',
    { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: 'Inter' },
    [
      h('div', { height: 12, background: C.accent, display: 'flex' }),
      h(
        'div',
        { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 80px 60px' },
        [
          h('div', { display: 'flex', flexDirection: 'column' }, [
            kicker
              ? h('div', { color: C.accent, fontSize: 24, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 28 }, kicker)
              : h('div', { display: 'flex' }),
            h(
              'div',
              { fontFamily: 'Newsreader', fontWeight: 500, fontSize: size, lineHeight: 1.08, letterSpacing: -1.2, color: C.fg, maxWidth: 1000, textWrap: 'balance' },
              title,
            ),
          ]),
          h(
            'div',
            { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid ${C.rule}`, paddingTop: 28 },
            [
              h('div', { display: 'flex', alignItems: 'center' }, [
                photo
                  ? h('img', { width: 60, height: 60, borderRadius: 30, marginRight: 20 }, undefined, { src: photo, width: 60, height: 60 })
                  : h('div', { display: 'flex' }),
                h('div', { fontSize: 28, fontWeight: 600, color: C.fg }, SITE.author),
              ]),
              h('div', { fontSize: 24, fontWeight: 500, color: C.muted }, new URL(SITE.url).host),
            ],
          ),
        ],
      ),
    ],
  );

  const svg = await satori(card as never, { width: 1200, height: 630, fonts: loadFonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return Buffer.from(png);
}

export function pngResponse(png: Buffer) {
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
