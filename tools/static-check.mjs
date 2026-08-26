#!/usr/bin/env node
/**
 * MANAK — static consistency checker.
 *
 * Why this exists: `tsc` and `vite build` need `node_modules`, and the
 * environment this was authored in has no package-registry access. Rather than
 * claim the code "should work", this script verifies the things that actually
 * break a build, using only the Node standard library:
 *
 *   1. every local import resolves to a real file
 *   2. every imported name is actually exported by that file
 *   3. no file imports a module that is still an empty placeholder
 *   4. every Tailwind utility built on a CUSTOM token exists in tailwind.config
 *   5. every CSS variable referenced in code is defined in index.css
 *   6. every locale file is valid JSON, with a report of gaps against en.json
 *   7. every `t('key')` used in code exists in en.json (the fallback locale)
 *
 * It is regex-based, not a type checker. It cannot find type errors — it finds
 * the wiring mistakes that regexes are genuinely good at. Run `npm run
 * typecheck` for the rest, once dependencies can be installed.
 *
 * Usage:  node tools/static-check.mjs [repoRoot]
 * Exit:   0 = no errors (warnings allowed), 1 = at least one error
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '..'));
const SRC = path.join(ROOT, 'frontend', 'src');
const SHARED = path.join(ROOT, 'shared');

const errors = [];
const warnings = [];
const notes = [];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const err = (file, msg) => errors.push(`${rel(file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${rel(file)}: ${msg}`);

/* ------------------------------------------------------------------ walking */

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const CODE_EXT = new Set(['.ts', '.tsx']);
const allFiles = [...walk(SRC), ...walk(SHARED)];
const codeFiles = allFiles.filter((f) => CODE_EXT.has(path.extname(f)));

/* ------------------------------------------------- strings vs code stripping */

/** Removes comments so they cannot contribute fake imports or class names. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/** All string-literal contents in a file (quoted + template chunks). */
function stringLiterals(source) {
  const out = [];
  const re = /'([^'\\\n]*(?:\\.[^'\\\n]*)*)'|"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const value = m[1] ?? m[2] ?? m[3];
    if (value) out.push(value);
  }
  return out;
}

/* --------------------------------------------------- imports and exports */

function parseImports(source) {
  const results = [];
  const re =
    /import\s+(?:(type)\s+)?([\s\S]*?)\s+from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    if (m[4]) {
      results.push({ spec: m[4], names: [], sideEffect: true });
      continue;
    }
    const clause = (m[2] ?? '').trim();
    const spec = m[3];
    const names = [];

    // `* as ns` imports cannot be name-checked.
    let namespaced = /\*\s+as\s+/.test(clause);

    const braced = clause.match(/\{([\s\S]*)\}/);
    if (braced) {
      for (const part of braced[1].split(',')) {
        const cleaned = part.replace(/\btype\b/, '').trim();
        if (!cleaned) continue;
        const original = cleaned.split(/\s+as\s+/)[0].trim();
        if (original) names.push(original);
      }
    }

    const beforeBrace = braced ? clause.slice(0, clause.indexOf('{')) : clause;
    const defaultName = beforeBrace.replace(/\*\s+as\s+\w+/, '').replace(',', '').trim();
    if (defaultName && !defaultName.startsWith('{')) names.push('default');

    results.push({ spec, names, namespaced, typeOnly: m[1] === 'type' });
  }
  return results;
}

function parseExports(source) {
  const names = new Set();
  const starFrom = [];

  const decl =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = decl.exec(source)) !== null) names.add(m[1]);

  const braced = /export\s+(?:type\s+)?\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
  while ((m = braced.exec(source)) !== null) {
    for (const part of m[1].split(',')) {
      const cleaned = part.replace(/\btype\b/, '').trim();
      if (!cleaned) continue;
      const pieces = cleaned.split(/\s+as\s+/);
      names.add((pieces[1] ?? pieces[0]).trim());
    }
  }

  const star = /export\s*\*\s*(?:as\s+([A-Za-z0-9_$]+)\s*)?from\s*['"]([^'"]+)['"]/g;
  while ((m = star.exec(source)) !== null) {
    if (m[1]) names.add(m[1]);
    else starFrom.push(m[2]);
  }

  if (/export\s+default\b/.test(source)) names.add('default');

  return { names, starFrom };
}

/* ------------------------------------------------------------- resolution */

function resolveSpec(spec, fromFile) {
  let base;
  if (spec === '@shared' || spec.startsWith('@shared/')) {
    base = path.join(ROOT, 'shared', spec.slice('@shared'.length).replace(/^\//, ''));
  } else if (spec.startsWith('@/')) {
    base = path.join(SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return { external: true };
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.json`,
    `${base}.css`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { file: candidate };
    }
  }
  return { missing: true, tried: candidates.map(rel) };
}

/* -------------------------------------------------------- export index */

const sourceCache = new Map();
function read(file) {
  if (!sourceCache.has(file)) sourceCache.set(file, fs.readFileSync(file, 'utf8'));
  return sourceCache.get(file);
}

const exportCache = new Map();
function exportsOf(file, seen = new Set()) {
  if (exportCache.has(file)) return exportCache.get(file);
  if (seen.has(file)) return new Set();
  seen.add(file);

  const ext = path.extname(file);
  if (ext === '.json') {
    const set = new Set(['default']);
    try {
      for (const key of Object.keys(JSON.parse(read(file)))) set.add(key);
    } catch {
      /* reported separately */
    }
    return set;
  }
  if (!CODE_EXT.has(ext)) return new Set(['default']);

  const { names, starFrom } = parseExports(stripComments(read(file)));
  const all = new Set(names);
  for (const spec of starFrom) {
    const resolved = resolveSpec(spec, file);
    if (resolved.file) for (const n of exportsOf(resolved.file, seen)) all.add(n);
  }
  if (seen.size === 1) exportCache.set(file, all);
  return all;
}

/* ------------------------------------------------ check 1-3: module wiring */

const emptyFiles = new Set(allFiles.filter((f) => fs.statSync(f).size === 0));
const importedBy = new Map();

for (const file of codeFiles) {
  if (emptyFiles.has(file)) continue;
  const code = stripComments(read(file));

  for (const imp of parseImports(code)) {
    const resolved = resolveSpec(imp.spec, file);
    if (resolved.external) continue;

    if (resolved.missing) {
      err(file, `import '${imp.spec}' does not resolve to any file`);
      continue;
    }

    if (!importedBy.has(resolved.file)) importedBy.set(resolved.file, []);
    importedBy.get(resolved.file).push(file);

    if (emptyFiles.has(resolved.file)) {
      err(file, `imports '${imp.spec}' but ${rel(resolved.file)} is an empty placeholder`);
      continue;
    }

    if (imp.namespaced || imp.sideEffect) continue;

    const available = exportsOf(resolved.file);
    for (const name of imp.names) {
      if (!available.has(name)) {
        err(
          file,
          `imports { ${name} } from '${imp.spec}', but ${rel(resolved.file)} does not export it`,
        );
      }
    }
  }
}

/* ------------------------------------- check 4: custom Tailwind utilities */

const configPath = path.join(ROOT, 'frontend', 'tailwind.config.ts');

/** Extracts the balanced `{...}` block following `key:` inside the config. */
function blockAfter(source, key) {
  const at = source.indexOf(`${key}: {`);
  if (at === -1) return null;
  let depth = 0;
  const start = source.indexOf('{', at);
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

/** Top-level keys of a block, plus `parent-child` for one nested level. */
function tokenNames(block) {
  const names = new Set();
  if (!block) return names;
  let depth = 0;
  let parent = null;
  const keyRe = /(?:^|[\s,{])(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$-]+))\s*:/g;

  // Walk character by character to know the depth of each key.
  let buffer = '';
  const flushKeys = (chunk, atDepth, parentName) => {
    let m;
    keyRe.lastIndex = 0;
    while ((m = keyRe.exec(chunk)) !== null) {
      const key = m[1] ?? m[2] ?? m[3];
      if (atDepth === 0) names.add(key);
      else if (atDepth === 1 && parentName) {
        names.add(key === 'DEFAULT' ? parentName : `${parentName}-${key}`);
      }
    }
  };

  const parts = [];
  for (let i = 0; i < block.length; i += 1) {
    const ch = block[i];
    if (ch === '{') {
      // The key immediately preceding this brace is the parent.
      const before = buffer.trim().replace(/[:,]\s*$/, '').trim();
      const nameMatch = before.match(/(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$-]+))\s*:?$/);
      if (depth === 0) {
        flushKeys(buffer, 0, null);
        parent = nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? nameMatch[3]) : null;
      }
      depth += 1;
      parts.push(buffer);
      buffer = '';
      continue;
    }
    if (ch === '}') {
      if (depth === 1) flushKeys(buffer, 1, parent);
      depth -= 1;
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  if (depth === 0) flushKeys(buffer, 0, null);
  return names;
}

let customColors = new Set();
let customFontSize = new Set();
let customRadius = new Set();
let customShadow = new Set();
let customMaxWidth = new Set();
let customFontFamily = new Set();
let customAnimation = new Set();
let customEase = new Set();

if (!fs.existsSync(configPath)) {
  err(configPath, 'tailwind.config.ts is missing');
} else {
  const cfg = stripComments(read(configPath));
  customColors = tokenNames(blockAfter(cfg, 'colors'));
  customFontSize = tokenNames(blockAfter(cfg, 'fontSize'));
  customRadius = tokenNames(blockAfter(cfg, 'borderRadius'));
  customShadow = tokenNames(blockAfter(cfg, 'boxShadow'));
  customMaxWidth = tokenNames(blockAfter(cfg, 'maxWidth'));
  customFontFamily = tokenNames(blockAfter(cfg, 'fontFamily'));
  customAnimation = tokenNames(blockAfter(cfg, 'animation'));
  customEase = tokenNames(blockAfter(cfg, 'transitionTimingFunction'));
}

const DEFAULT_HUES = [
  'inherit', 'current', 'transparent', 'black', 'white',
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose',
];
const isDefaultColor = (v) => {
  const base = v.replace(/-(?:50|\d00)$/, '');
  return DEFAULT_HUES.includes(base);
};

const DEFAULT_FONT_SIZE = ['xs','sm','base','lg','xl','2xl','3xl','4xl','5xl','6xl','7xl','8xl','9xl'];
const TEXT_NON_COLOR = ['left','center','right','justify','start','end','balance','pretty','wrap','nowrap','ellipsis','clip','opacity'];
const DEFAULT_RADIUS = ['none','sm','md','lg','xl','2xl','3xl','full'];
const DEFAULT_SHADOW = ['sm','md','lg','xl','2xl','inner','none'];
const DEFAULT_MAX_W = ['0','none','xs','sm','md','lg','xl','2xl','3xl','4xl','5xl','6xl','7xl','full','min','max','fit','prose'];
const DEFAULT_FONT = ['sans','serif','mono','thin','extralight','light','normal','medium','semibold','bold','extrabold','black'];
const DEFAULT_ANIM = ['none','spin','ping','pulse','bounce'];
const DEFAULT_EASE = ['linear','in','out','in-out'];

/** Strips variants (`sm:`, `hover:`, `[&:...]:`) from a class token. */
function stripVariants(token) {
  let t = token;
  for (;;) {
    const arbitrary = t.match(/^\[[^\]]*\]:/);
    if (arbitrary) {
      t = t.slice(arbitrary[0].length);
      continue;
    }
    const named = t.match(/^[a-z0-9-]+:/);
    if (named) {
      t = t.slice(named[0].length);
      continue;
    }
    return t;
  }
}

const CHECKS = [
  { prefix: 'text-', custom: () => new Set([...customColors, ...customFontSize]), extra: [...TEXT_NON_COLOR, ...DEFAULT_FONT_SIZE], color: true },
  { prefix: 'bg-', custom: () => customColors, extra: ['gradient-to-r','gradient-to-l','gradient-to-t','gradient-to-b','gradient-to-br','gradient-to-bl','gradient-to-tr','gradient-to-tl','none','cover','contain','center','no-repeat','repeat','fixed','local','scroll','clip-text','clip-border','clip-padding','clip-content','origin-border','origin-padding','origin-content','blend-multiply','blend-screen','blend-overlay'], color: true },
  // `sides` matters here too: `border-t-transparent` is a top-border COLOUR,
  // so the `t-` has to come off before the value is looked up.
  { prefix: 'border-', custom: () => customColors, extra: ['0','2','4','8','solid','dashed','dotted','double','hidden','none','collapse','separate','spacing','t','b','l','r','x','y'], color: true, sides: true },
  { prefix: 'fill-', custom: () => customColors, extra: ['none'], color: true },
  { prefix: 'stroke-', custom: () => customColors, extra: ['0','1','2','none'], color: true },
  { prefix: 'decoration-', custom: () => customColors, extra: ['solid','dashed','dotted','wavy','none','auto','from-font','0','1','2','4','8'], color: true },
  { prefix: 'ring-', custom: () => customColors, extra: ['0','1','2','4','8','inset','offset-0','offset-1','offset-2','offset-4'], color: true },
  { prefix: 'divide-', custom: () => customColors, extra: ['x','y','x-0','y-0','x-2','y-2','x-reverse','y-reverse','solid','dashed','none'], color: true },
  { prefix: 'rounded-', custom: () => customRadius, extra: DEFAULT_RADIUS, sides: true },
  { prefix: 'shadow-', custom: () => customShadow, extra: DEFAULT_SHADOW },
  { prefix: 'max-w-', custom: () => customMaxWidth, extra: DEFAULT_MAX_W, screen: true },
  { prefix: 'font-', custom: () => customFontFamily, extra: DEFAULT_FONT },
  { prefix: 'animate-', custom: () => customAnimation, extra: DEFAULT_ANIM },
  { prefix: 'ease-', custom: () => customEase, extra: DEFAULT_EASE },
];

const seenBadClasses = new Set();

for (const file of codeFiles) {
  if (emptyFiles.has(file)) continue;
  for (const literal of stringLiterals(read(file))) {
    // Only look at things that plausibly are class lists.
    if (!/^[\s\w:/[\]().,&#%+*=>~-]*$/.test(literal)) continue;

    for (const raw of literal.split(/\s+/)) {
      if (!raw || raw.includes('${')) continue;
      let token = stripVariants(raw);
      if (token.startsWith('!')) token = token.slice(1);
      if (token.startsWith('-')) token = token.slice(1);
      if (!/^[a-z]/.test(token)) continue;

      for (const check of CHECKS) {
        if (!token.startsWith(check.prefix)) continue;
        let value = token.slice(check.prefix.length);
        if (!value || value.startsWith('[')) break; // arbitrary value — allowed

        // Strip an opacity modifier, but not from an arbitrary one.
        const slash = value.indexOf('/');
        if (slash > 0) value = value.slice(0, slash);
        if (!value || value.startsWith('[')) break;

        if (check.sides) value = value.replace(/^(?:t|b|l|r|s|e|tl|tr|bl|br)-/, '');
        if (check.screen && value.startsWith('screen')) break;

        const allowed = check.custom();
        if (
          allowed.has(value) ||
          check.extra.includes(value) ||
          (check.color && isDefaultColor(value))
        ) {
          break;
        }

        const key = `${token}|${rel(file)}`;
        if (!seenBadClasses.has(key)) {
          seenBadClasses.add(key);
          err(file, `class "${raw}" uses "${value}", which is not a token in tailwind.config.ts`);
        }
        break;
      }
    }
  }
}

/* ------------------------------------- check 5: CSS variables referenced */

const cssPath = path.join(SRC, 'index.css');
if (!fs.existsSync(cssPath)) {
  err(cssPath, 'index.css is missing');
} else {
  const css = read(cssPath);
  const defined = new Set();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);

  for (const file of [...codeFiles, configPath].filter((f) => fs.existsSync(f))) {
    if (emptyFiles.has(file)) continue;
    for (const m of read(file).matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      if (!defined.has(m[1])) err(file, `references CSS variable ${m[1]}, which index.css never defines`);
    }
  }
  notes.push(`index.css defines ${defined.size} custom properties.`);
}

/* --------------------------------------- check 6-7: locales and t() keys */

const localeDir = path.join(SRC, 'i18n', 'locales');
const locales = new Map();

if (fs.existsSync(localeDir)) {
  for (const name of fs.readdirSync(localeDir).filter((n) => n.endsWith('.json'))) {
    const full = path.join(localeDir, name);
    try {
      locales.set(name.replace('.json', ''), JSON.parse(fs.readFileSync(full, 'utf8')));
    } catch (error) {
      err(full, `invalid JSON — ${error.message}`);
    }
  }
}

const flatten = (obj, prefix = '', out = new Set()) => {
  for (const [key, value] of Object.entries(obj ?? {})) {
    const composed = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, composed, out);
    else out.add(composed);
  }
  return out;
};

const enKeys = locales.has('en') ? flatten(locales.get('en')) : new Set();

if (enKeys.size === 0) {
  err(path.join(localeDir, 'en.json'), 'no keys found — en.json is the fallback locale');
} else {
  for (const [code, data] of locales) {
    if (code === 'en') continue;
    const keys = flatten(data);
    const missing = [...enKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !enKeys.has(k));
    if (extra.length > 0) {
      warn(path.join(localeDir, `${code}.json`), `has ${extra.length} key(s) absent from en.json: ${extra.slice(0, 5).join(', ')}`);
    }
    notes.push(
      `locale ${code}: ${keys.size}/${enKeys.size} keys` +
        (missing.length ? ` (${missing.length} fall back to English)` : ' (complete)'),
    );
  }

  // t('key', 'Default') usage — the key should exist in the fallback locale.
  const missingKeys = new Map();
  for (const file of codeFiles) {
    if (emptyFiles.has(file)) continue;
    const code = stripComments(read(file));
    for (const m of code.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
      const key = m[1];
      if (!key.includes('.')) continue;
      if (!enKeys.has(key)) {
        if (!missingKeys.has(key)) missingKeys.set(key, rel(file));
      }
    }
  }
  for (const [key, file] of missingKeys) {
    warn(file, `t('${key}') has no entry in en.json (renders its inline default)`);
  }
}

/* ------------------------------------------------------------- inventory */

const emptyCode = [...emptyFiles].filter((f) => CODE_EXT.has(path.extname(f)));
notes.push(`${codeFiles.length - emptyCode.length} of ${codeFiles.length} TS/TSX files have content.`);

const unusedNonEmpty = codeFiles.filter(
  (f) =>
    !emptyFiles.has(f) &&
    !importedBy.has(f) &&
    !/(?:App|main|AppRoutes)\.tsx?$/.test(f) &&
    !f.includes(`${path.sep}pages${path.sep}`),
);
if (unusedNonEmpty.length > 0) {
  notes.push(`Not yet imported anywhere: ${unusedNonEmpty.map(rel).join(', ')}`);
}

/* ---------------------------------------------------------------- report */

const label = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

console.log('MANAK static consistency check');
console.log('='.repeat(64));
console.log(`root: ${ROOT}\n`);

if (notes.length) {
  console.log('Inventory');
  for (const note of notes) console.log(`  · ${note}`);
  console.log('');
}

if (errors.length) {
  console.log(`ERRORS (${errors.length}) — these would fail a build`);
  for (const line of errors) console.log(`  ✗ ${line}`);
  console.log('');
}

if (warnings.length) {
  console.log(`WARNINGS (${warnings.length}) — safe at runtime, worth knowing`);
  for (const line of warnings) console.log(`  ! ${line}`);
  console.log('');
}

console.log('-'.repeat(64));
console.log(
  errors.length === 0
    ? `PASS — no wiring errors. ${label(warnings.length, 'warning')}.`
    : `FAIL — ${label(errors.length, 'error')}, ${label(warnings.length, 'warning')}.`,
);
console.log('Not covered here: type checking, JSX validity, CSS output, runtime behaviour.');

process.exit(errors.length === 0 ? 0 : 1);
