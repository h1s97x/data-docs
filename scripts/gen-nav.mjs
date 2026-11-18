// 从 projects/*/manifest.json 生成 VitePress 导航配置，新增项目无需改 config。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.vitepress', 'nav.generated.mjs');
const PROJECTS = [
  { id: 'xyj-api', label: 'xyj-api', desc: '企业上下游 / 报告 · SHA1withRSA' },
  { id: 'altdatahub', label: 'altdatahub', desc: '替代数据通 · 51 产品目录' },
  { id: 'elecredit', label: 'elecredit', desc: '企业风控 · 10 端点' },
];

const lines = [
  '// 由 scripts/gen-nav.mjs 从 projects/*/manifest.json 生成，勿手改。',
  'export const projects = [',
];
for (const p of PROJECTS) {
  const manifest = join(ROOT, 'projects', p.id, 'manifest.json');
  if (!existsSync(manifest)) {
    console.warn(`skip ${p.id}: no manifest`);
    continue;
  }
  const m = JSON.parse(readFileSync(manifest, 'utf8'));
  const readme = m.files.some((f) => f.path === 'README.md');
  if (!readme) { console.warn(`skip ${p.id}: no README in manifest`); continue; }
  lines.push(`  { id: ${JSON.stringify(p.id)}, label: ${JSON.stringify(p.label)}, desc: ${JSON.stringify(p.desc)}, version: ${JSON.stringify(String(m.source).split('@')[1]?.slice(0, 8) || '')} },`);
}
lines.push('];');
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`gen-nav: wrote ${relative(ROOT, OUT)} (${PROJECTS.length} slots)`);

function relative(root, path) { return path.startsWith(root) ? path.slice(root.length + 1) : path; }
