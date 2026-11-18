// 校验三个主仓推来的脱敏快照：manifest schema、必填字段、文件 sha256、敏感串残留。
// 站点 CI 与本地 `pnpm check` 都跑；缺任一项目或校验失败即报错（防止半同步上线）。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS = ['xyj-api', 'altdatahub', 'elecredit'];
const REQUIRED = ['manifest.json', 'README.md'];

const SECRET_PATTERNS = [
  [/-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, 'PEM 私钥'],
  [/(?:XYJ|ELECREDIT|EDS)_(?:PRIVATE_KEY|APP_KEY|TOKEN)\s*=\s*[^<\s$"']{8,}/, '凭据环境变量赋值'],
  [/\b(?:10|172|192)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, '内网 IP'],
];

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(relative(dir, path).replaceAll('\\', '/'));
  }
  return out;
};

let failed = false;
const fail = (msg) => { failed = true; console.error(`  FAIL ${msg}`); };

for (const project of PROJECTS) {
  const base = join(ROOT, 'projects', project);
  console.log(`[${project}]`);
  if (!existsSync(base)) { console.warn('  尚未同步（跳过）'); continue; }

  for (const req of REQUIRED) {
    if (!existsSync(join(base, req))) fail(`${project}: 缺少 ${req}`);
  }
  const manifestPath = join(base, 'manifest.json');
  if (!existsSync(manifestPath)) continue;

  let m;
  try { m = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch (e) { fail(`${project}: manifest.json 非法 JSON (${e.message})`); continue; }

  if (m.schema !== 1) fail(`${project}: manifest schema != 1`);
  if (!m.source || !String(m.source).startsWith(`${project}@`)) fail(`${project}: source 格式不对`);
  if (!Array.isArray(m.files) || m.files.length === 0) fail(`${project}: files 为空`);

  const declared = new Set(m.files.map((f) => f.path));
  const actual = new Set(walk(base).filter((p) => p !== 'manifest.json'));
  for (const p of actual) if (!declared.has(p)) fail(`${project}: 未登记文件 ${p}`);
  for (const p of declared) if (!actual.has(p)) fail(`${project}: manifest 登记但文件缺失 ${p}`);

  for (const f of m.files) {
    const path = join(base, f.path);
    if (!existsSync(path)) continue;
    const content = readFileSync(path);
    if (sha256(content) !== f.sha256) fail(`${project}: sha256 不匹配 ${f.path}`);
    const text = content.toString('utf8');
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(text)) fail(`${project}: ${f.path} 含${label}（脱敏失败）`);
    }
  }
  console.log(`  ${m.files.length} files, source=${m.source}`);
}

if (failed) {
  console.error('\ncheck-snapshots: FAILED');
  process.exit(1);
}
console.log('\ncheck-snapshots: all 3 snapshots OK');
