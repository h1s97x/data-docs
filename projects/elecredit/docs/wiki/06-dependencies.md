# 06 · 依赖关系

## 6.1 外部依赖 — Node.js CLI

**运行时依赖**（`package.json` → `dependencies`）

| 包 | 版本 | 用途 | 实际使用 |
|----|------|------|---------|
| `commander` | 15.0.0 | CLI 参数解析与命令树 | ✅ 核心 |
| `zod` | 4.4.3 | 10 端点输入/输出 schema、响应信封校验 | ✅ 核心 |
| `@napi-rs/keyring` | 1.3.0 | 系统钥匙环原生绑定（Rust/NAPI） | ✅ `auth login/status/logout` 与凭据解析 |
| ~~`skills`~~ | ~~1.5.15~~ | — | 已于 2026-09-30 删除：源码零 import 的运行时依赖（同步移出 `npm-shrinkwrap.json`） |

**开发依赖**（`devDependencies`）

| 包 | 版本 | 用途 |
|----|------|------|
| `typescript` | 6.0.3 | 编译（`tsc -p tsconfig.json`） |
| `typescript-eslint` / `eslint` / `@eslint/js` | 8.63.0 / 10.6.0 / 10.0.1 | Lint |
| `prettier` | 3.9.4 | 格式化（`--check`） |
| `vitest` | 4.1.10 | 单元测试（**当前无测试文件**） |
| `execa` | 9.6.1 | 子进程执行（测试/工具预留） |
| `@types/node` | 22.15.1 | Node 类型 |

**引擎**：`node >= 22.12.0`。锁文件 `npm-shrinkwrap.json`（CI 用 `npm ci --ignore-scripts`）。

## 6.2 外部依赖 — Python SDK

**必需**（`pyproject.toml` → `dependencies`）

| 包 | 版本区间 | 用途 | 缺失时行为 |
|----|---------|------|-----------|
| `typer` | >=0.12,<1 | CLI 框架 | **CLI 不可用**，`main()` 打印提示并 exit 1；SDK 不受影响 |
| `rich` | >=13,<14 | Typer 的富文本输出 | 同上 |
| `python-dotenv` | >=1.0,<2 | 加载 `.env` | `credentials.py` 静默降级（lambda 返回 False） |
| `requests` | >=2.31,<3 | HTTP 客户端 | **自动回退标准库 `urllib`** |

**可选**（`[project.optional-dependencies].dev`）：`pytest>=8,<10`、`ruff>=0.5,<1`。

**标准库依赖**：`json`、`ssl`、`time`、`urllib.request/error`、`hashlib`、`uuid`、`os`、`pathlib`、`dataclasses`、`typing`。

**零依赖模式**：只要不使用 CLI（`python -m elecredit`）且不需要 `.env`，可 `sys.path` 直接引入包，纯标准库运行：

```python
import sys; sys.path.insert(0, "sdk")
from elecredit import ElecreditClient
```

## 6.3 环境变量

| 变量 | 消费方 | 默认 | 说明 |
|------|--------|------|------|
| `ELECREDIT_APP_ID` | Node CLI、Python SDK | — | App ID（**必需**，与 KEY 成对） |
| `ELECREDIT_APP_KEY` | Node CLI、Python SDK | — | App Key（**必需**，与 ID 成对） |
| `ELECREDIT_BASE_URL` | Node CLI (`config.ts`)、Python SDK (`from_env()`)、能力服务 | `https://api.elecredit.com` | 网关覆盖（内网代理）；优先级：显式入参 > 环境变量 > 公网默认，只换 host、签名不变 |
| `ELECREDIT_PROFILE` | Node CLI (`config.ts`) | `default` | profile 名（预留） |
| `ELECREDIT_API_KEY` | — | — | 已随 `api-key-provider.ts` 删除（本项目用 App ID + App Key 二元组） |
| `LC_ALL` / `LC_MESSAGES` / `LANG` | `i18n.ts`（未接线） | `zh-CN` | 语言推断（以 `en` 开头则英文） |
| `NO_COLOR` | `context.ts`（未接线） | — | 禁用颜色 |
| `DEBUG` | `context.ts`（未接线） | — | 含以 `elecredit` 开头的项则开启 debug |


**Node CLI 凭据校验**：`ELECREDIT_APP_ID` 与 `ELECREDIT_APP_KEY` 必须**同时非空**（`.trim()` 后判断），否则回退系统钥匙环；两者都没有才抛 `ELECREDIT_AUTH_REQUIRED`（exit 3）。

## 6.4 内部模块依赖图 — Node CLI

```
cli/main.ts
   └── cli/program.ts
         ├── application/config.ts
         ├── contracts/errors.ts
         ├── commands/error-output.ts ──► infrastructure/credentials/redact.ts（错误消息脱敏）
         ├── commands/register.ts
         │      ├── application/use-cases/remote-query.ts
         │      │      ├── contracts/remote-capabilities.ts ──► zod
         │      │      └── (type-only) infrastructure/elecredit/client.ts
         │      └── (type-only) infrastructure/elecredit/client.ts
         ├── commands/system/capabilities.ts ──► contracts/remote-capabilities.ts
         ├── commands/system/auth.ts ──► credentials/app-key-pair-provider.ts ──► keyring.ts
         └── contracts/remote-capabilities.ts
                └── zod

infrastructure/elecredit/client.ts
   ├── (type) application/ports/auth-provider.ts
   ├── contracts/errors.ts
   ├── infrastructure/elecredit/envelope.ts ──► zod
   ├── infrastructure/elecredit/signature.ts ──► node:crypto
   └── infrastructure/elecredit/retry.ts    ──► node:timers/promises

未接入主链路（仅定义/导出）：无。
  2026-09-30 与 2026-10-12 两轮清理已删除全部零引用模块 ——
  `output/*`、`cli/{context,i18n}.ts`、`contracts/{envelope,registry}.ts`、
  `infrastructure/process/*`、`schemas/command-envelope.schema.json`，
  详见 [03 §3.3](03-node-cli.md) 的「已删除的遗留模块」两节与 [08](08-known-issues.md)。
  `application/ports/auth-provider.ts` 是纯接口，供 `infrastructure` 实现（依赖倒置），不算未接线。
```

依赖方向：外层（`cli` / `commands`）→ 内层（`application` / `contracts`）→ `infrastructure`。`infrastructure` 只依赖 `contracts` 与 `application/ports`（接口），符合依赖倒置。

> **2026-10-12 修复**：此前 `contracts/errors.ts` 有一行 `export { redactText } from '../infrastructure/credentials/redact.ts'`，
> 使 `contracts → infrastructure` 出现**反向边**（依赖倒置的例外）。该转出零引用，已删除；
> 脱敏改为由 `commands/error-output.ts` 直接依赖 `credentials/redact.ts`。现在 `grep -rn "infrastructure/" src/contracts/` 为 0 命中。

## 6.5 内部模块依赖图 — Python SDK

```
__init__.py
   ├── _version.py
   ├── client.py
   │      ├── credentials.py
   │      ├── endpoints.py
   │      ├── envelope.py ──► errors.py
   │      ├── errors.py
   │      └── signature.py
   └── signature.py

__main__.py ──► cli.py ──► client.py, errors.py, (lazy) endpoints.py
cli.py ──► typer（运行时可选 import）
client.py ──► requests（try/except ImportError，可选）
credentials.py ──► python-dotenv（try/except ImportError，可选）
```

无循环依赖；`client.py` 内部的 `UpstreamError` 导入被有意延迟到 except 分支内，避免顶层循环。

## 6.6 外部服务依赖

| 依赖 | 地址 | 用途 |
|------|------|------|
| Elecredit 网关 | `https://api.elecredit.com` | 8 个业务端点 |
| 凭据管理后台 | `https://api.elecredit.com/admin` | 获取 App ID + App Key |
| npm registry | — | Node CLI 依赖安装 / 发布 |
| PyPI | — | Python SDK 依赖安装 |

无数据库、无消息队列、无本地持久化（未接线的 keyring 模块除外）。

## 6.7 CI 矩阵（含成本控制）

> 2026-11-03 迁移：CI 从 GitHub Actions 全量搬到 CNB，配置只有一份 `.cnb.yml`。
> 迁移动因是 GitHub 侧三条 workflow 长期全红且本地无从复现（python CI 的
> `working-directory` 写成不存在的 `sdk/`、CLI 的 lint/format 门禁红），
> 加上 5 平台矩阵的分钟成本。GitHub 侧现只剩 `sync-cnb.yml`（手动逃生口）。

三条 pipeline，按改动路径（`ifModify`）并行、互不阻塞：

| pipeline | 内容 | 触发 |
|----------|------|------|
| `ci-python-sdk` | `pip install -e ".[dev]"` → `ruff check` → `pytest --cov-fail-under=74` → `python -m elecredit.signature` | `sdks/python/**` |
| `ci-typescript-cli` | 架构断言 → `npm ci --ignore-scripts` → `npm run verify` → `lint && format` → `test:coverage` → `npm pack --dry-run` | `sdks/typescript/**` + 契约一致性命中的 docs / README / AGENTS.md |
| `ci-openapi-contract` | `spectral-cli@6 lint openapi/openapi.yaml`（0 errors 通过） | `openapi/**`、`.spectral.yml` |

事件分档：

| 事件 | 覆盖 | 说明 |
|------|------|------|
| **push 到 main** | 增量（命中才跑） | 改哪块跑哪块，全绿才算这次 push 绿 |
| **pull_request** | 增量（同上） | 挂在 `**` 兜底分支下，任何分支的 PR 都会跑 |
| **crontab 周一 09:00**（Asia/Shanghai） | 全量 6 条 | Python 3.10 + 3.12、Node 22 + 24、Node 22 arm64、OpenAPI |
| **tag_push** | 不跑 CI，只发布 | 发布链路见 `docs/publishing.md` |

成本控制：`ifModify` 路径过滤（文档类改动不跑 CI）、每 stage `timeout: 20m`、
pip / npm 目录缓存（`docker.volumes`，节点内有效）。

⚠️ **平台边界**：CNB 官方节点只有 Linux（`cnb:arch:amd64` / `cnb:arch:arm64:v8`），
Windows / macOS 无法复现，原「5 平台 × 2 Node」收敛为「Linux 双架构 × 2 版本」。
arm64 那一条用 `EXPECT_ARCH=arm64` 做架构断言，顺带覆盖原生依赖（`@napi-rs/keyring`）。

⚠️ **am64 job 不要设 `EXPECT_ARCH=amd64`**：`docker.image`（`node:22` / `node:24`）是官方
多架构镜像，平台按 manifest 解析出 `linux/amd64` 容器，容器内 Node 报的 `process.arch` 是
**`x64`** 而非 `amd64` —— 直接字符串比较必然不等，`arch check` 会红在 install 之前
（2026-11-03 构建 `cnb-56t-1k6fgp44e` 即此因）。现约定：**amd64 侧留空只打印**（节点选择
已由 `runner.tags: cnb:arch:amd64` 保证），断言脚本把 `amd64`/`aarch64` 归一化后再比较。
`npm run verify` = `typecheck` + `build` + `node dist/cli/main.js capabilities --format json`。

**SDK `full` 矩阵**：Python 3.10 + 3.12（`quick` 只跑下限）。
为什么下限最重要：`requires-python = ">=3.10"`，下限最容易踩坑 —— `tests/test_version.py`
曾直接用 `tomllib`（3.11+ 才进标准库），让 3.10 的 job 一直红；现已 `try/except` 回退
`tomli`，dev 依赖带 `tomli>=2; python_version < '3.11'`。
步骤：`pip install -e ".[dev]"` → `ruff check`（便宜的先跑）→ `pytest tests/ -q` →
`python -m elecredit.signature`。
