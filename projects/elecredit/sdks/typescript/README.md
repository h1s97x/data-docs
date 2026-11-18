# Elecredit CLI

Elecredit 企业风控数据服务的 Node.js 命令行客户端，面向人类终端、AI Agent 和自动化脚本。

## 覆盖能力

| 分组       | 端点 ID | CLI 命令                                   | 说明                                                      |
| ---------- | ------- | ------------------------------------------ | --------------------------------------------------------- |
| enterprise | A07     | `elecredit-ts enterprise fuzzy`            | 企业工商模糊查询                                          |
| enterprise | A03     | `elecredit-ts enterprise deep`             | 企业工商深度查询（年报 / 股权出质 / 司法协助 / 严重违法） |
| enterprise | A04     | `elecredit-ts enterprise scale`            | 企业大中小微划型                                          |
| enterprise | B06     | `elecredit-ts enterprise tax-credit`       | 企业税务信用（纳税等级 / 欠税公告 / 涉税处罚 / 非正常户） |
| enterprise | D07     | `elecredit-ts enterprise admin-punishment` | 行政处罚多维风险                                          |
| enterprise | F09     | `elecredit-ts enterprise graph`            | 企业股权图谱（递归穿透对外投资 + 向上股东）               |
| risk       | D11     | `elecredit-ts risk judicial-fuzzy`         | 企业司法模糊查询（12 种 type 混合返回）                   |
| litigation | D14     | `elecredit-ts litigation xgbzxr`           | 限制高消费人员                                            |

## 认证模型

Elecredit 使用 App ID + App Key 二元组，认证不依赖单一 API Key。签名在 HTTP Header 中传输：

```
signStr   = requestSn + timestamp_ms + bodyCompactJson + appKey
signature = MD5(signStr).hex()
```

Body 必须是紧凑 JSON（`separators=(",", ":")`），**中文不转义**。签名错误会返回 `SYS001`~`SYS004`；`SYS005` = 签名正确但账户余额不足，属于正常业务响应（充值后拿真实数据）。

## 安装

```bash
# 全局 CLI
npm install -g @h1s97x/elecredit

# 作为库装进别的项目（pnpm / yarn 同理）
npm install @h1s97x/elecredit

# 本地开发
cd sdks/typescript
npm install
npm run verify
npm link
```

Node.js 要求：>= 22.12.0。

### 从 CNB 私有制品库安装（当前实际渠道）

**现状**：包发布在 CNB 制品库 `npm.cnb.cool/h1s97x/npm`，已发布 **`0.0.1`**、**`0.0.2`**、**`0.0.3`**、**`0.0.4`**、**`0.1.0`**。

> ⚠️ **请使用 `>=0.1.0`**（`0.0.3` 起可用，但 D11 那条命令需 `>=0.0.4`）。
> `0.0.1` 与 `0.0.2` **在生产 API 上不可用**：响应信封 schema 把上游实际
> 返回的数字 `isCompressed: 0/1` 声明成了 `z.boolean()`，导致**所有命令**都报
> `响应信封格式错误: isCompressed expected boolean, received number`（已拉取两个已发布 tarball 实证）。
> `0.0.3` 修复该问题，并新增 `enterprise bidding`（B04 招投标）与 `enterprise actual-controller`
> （P0020019 实控人）两个命令；`0.0.4` 修 `risk judicial-fuzzy`（D11）—— 该命令此前从未
> 调通（标识字段应为 `entityName`、`type` 取值是 12 个前缀而非旧文档那套码）。
> `0.1.0` 统一了**错误契约（与 `0.0.4` 不兼容）**：`error.category` 取值变化（`SYS005` 由
> `authentication` 改 `billing`、`SYS008` 由 `upstream` 改 `rate_limit`）、退出码只用 `1`~`4`
> （`5`/`6` 退回保留位）、错误信封**新增 `retryable`** —— 依赖 `category === 'authentication'`
> 或退出码 `5`/`6` 的调用方需同步改。同批含端点清单收敛（P2-6）与死代码清理（P1-3）。
>
> 坏版本**保留未删除**：npm 版本号不可变，删了重发同名版本会让下游 lockfile / `integrity`
> 对不上、缓存发出旧包（详见 `docs/publishing.md` 的「发布治理」）。

发布由 CNB 流水线完成（推 `cli-v<version>` tag 即触发），用的是平台内置凭据，不需要任何仓库 secret。

**不要**用 `--registry` 全局改地址（本包有 4 个公共依赖，全局改会让它们 401/404），
改用 scope 级映射：

```ini
# 消费方 .npmrc
@h1s97x:registry=https://npm.cnb.cool/h1s97x/npm/-/packages/
always-auth=true
//npm.cnb.cool/h1s97x/npm/-/packages/:_authToken=${CNB_TOKEN}
```

只做一次临时安装时，`--registry` 对 `@h1s97x` 这个包本身是安全的：

```bash
npm install @h1s97x/elecredit \
  --registry https://npm.cnb.cool/h1s97x/npm/-/packages/
```

前提是同一 `.npmrc` 里**不要**再写全局 `registry=`；否则公共依赖会一起被指过去。
细节见 [`docs/publishing.md`](../../docs/publishing.md)。

## 在别的项目里使用

包同时是 CLI 和可嵌入的 TS 库，装完即可 `import`，无需改本仓库结构：

```ts
import { createClientFromEnv, query } from '@h1s97x/elecredit';

const client = createClientFromEnv(); // 读 ELECREDIT_APP_ID / ELECREDIT_APP_KEY
const res = await query(client, 'enterprise.fuzzy', { entName: '贵州茅台' });
```

凭据**只在服务端**读取，不要注入浏览器端 bundle。浏览器侧的接入做法（服务端中转 + 错误分类映射）
见 [`docs/troubleshooting.md`](../../docs/troubleshooting.md#能在浏览器里直接调吗)。

### ESM 与 CJS 都能加载

包本身是 ESM（`"type": "module"`），但 `exports` 同时声明了 `import` 与 `default`，
因此在 Node ≥ 22.12（原生支持 `require(esm)`）上 CJS 消费方也能直接 `require`：

```js
// CommonJS：jest、tsx、普通 Node 脚本、部分构建链
const { createClientFromEnv, query } = require('@h1s97x/elecredit');

// ESM
import { createClientFromEnv, query } from '@h1s97x/elecredit';
```

两条路径指向同一份产物 `dist/index.js`，行为一致，**不需要**额外的 `.cjs` 构建产物。
根因和回归测试见 `tests/package-exports.test.ts`。

> 不要用 `git+https://…/elecredit.git` 形式安装：包位于 `sdks/typescript/` 子目录，
> npm / pnpm 的 git 依赖只认仓库根的 `package.json`，该路径不可用。请走 npm registry。
> 版本发布流程见 [`docs/publishing.md`](../../docs/publishing.md)。

## 凭据配置

从 [https://api.elecredit.com/admin] 获取 App ID + App Key，两种配置方式：

```bash
# 方式 1：环境变量（推荐，支持 CI / 容器）
export ELECREDIT_APP_ID=...
export ELECREDIT_APP_KEY=...

# 方式 2：系统钥匙环（Keychain / Credential Manager / Secret Service）
elecredit-ts auth login --app-id <App ID> --app-key <App Key>
```

解析优先级：环境变量 > 系统钥匙环。两个变量必须**同时存在**才视为已配置；
全部缺失时输出 `ELECREDIT_AUTH_REQUIRED` 并以退出码 3 结束。

## 快速上手

```bash
# 列出全部可用端点
elecredit-ts capabilities --format json

# 工商模糊查询
elecredit-ts enterprise fuzzy --ent-name 贵州茅台 --format json

# 工商深度查询（4 选 1 必填）
elecredit-ts enterprise deep --credit-code 91520300MA6H... --format json

# 大中小微划型
elecredit-ts enterprise scale --ent-info 贵州茅台 --format json

# 税务信用（type: satpartyXin=纳税信用等级 / satpartyQs=欠税公告 / satpartyChufa=涉税处罚 / satpartyFzc=非正常户）
elecredit-ts enterprise tax-credit --entity-name 贵州茅台 --type satpartyXin --format json

# 行政处罚（支持工商 / 证监会 / 食药监 / 银监会 / 海关 等多类处罚）
elecredit-ts enterprise admin-punishment --ent-info 贵州茅台 --format json

# 司法模糊查询（type 单值，12 种实测前缀；range ≤ 20）
elecredit-ts risk judicial-fuzzy --entity-name 恒大地产集团有限公司 --type ktgg --format json

# 限制高消费人员
elecredit-ts litigation xgbzxr --pers-name 许家印 --id-no 110101195804261234 --format json

# 企业股权图谱（默认 60s 超时，支持 level / down / up 参数）
elecredit-ts enterprise graph --ent-info 贵州茅台 --level 2 --down --format json
```

## 凭据命令

```bash
# 写入系统钥匙环（不回显值）
elecredit-ts auth login --app-id <App ID> --app-key <App Key>

# 查看凭据来源（环境变量 / 钥匙环），只报告是否已配置
elecredit-ts auth status --format json

# 删除
elecredit-ts auth logout
```

> 钥匙环不可用时（如无 Secret Service 的 Linux 容器），`auth status` 会带 `keyringError`
> 字段提示，此时请改用环境变量。

## 输出格式

当前默认 JSON（`--format json`），输出信封：

```json
{
  "ok": true,
  "bizCode": "000",
  "data": { ... }
}
```

错误同样使用 JSON 信封。**注意「跨语言契约」的边界**：真契约是 `code` / `category` / `exitCode` /
`retryable` 这 4 项（7 门语言的 `ERROR_CONTRACT` 逐条相同），**信封形状不是** ——
目前只有 Node / Python / Java 三门 CLI 输出 `{ok,error:{…}}`，Go / C / Rust / C# 的 CLI 是
「成功打印上游原始响应、失败打印 `[code/category] message` + `提示: …` 到 stderr」。
Python 与 Node 的错误信封字段一致，但**成功信封不同**：Node 多 `bizCode` / `orderNo`，Python 只有 `data`。

```json
{
  "ok": false,
  "error": {
    "code": "SYS044",
    "category": "upstream",
    "message": "SYS044 资源不存在",
    "hint": "核对端点路径的大小写（如 /saic/SaicinvWh 是小写 w）；重试不会改善",
    "retryable": false
  }
}
```

`hint` 仅在非空时出现。`category` 全文只有 6 个取值
（`validation` / `authentication` / `billing` / `rate_limit` / `upstream` / `internal`），
退出码与之一一对应：

| 退出码 | 含义                             | 对应 category                |
| ------ | -------------------------------- | ---------------------------- |
| 1      | 内部错误（非 `CliError` 的兜底） | `internal`                   |
| 2      | 入参或校验失败                   | `validation`                 |
| 3      | 凭据问题或余额不足               | `authentication` / `billing` |
| 4      | 上游异常或限流                   | `upstream` / `rate_limit`    |

未预期的异常（非 `CliError`）只输出 `{ "ok": false, "error": { "message": "…" } }` ——
刻意不带 `category`/`code`，避免把「本地用错」伪装成「上游业务错误」。

> 每个码 → 分类 / 退出码 / 可重试的唯一真源是
> `src/infrastructure/elecredit/envelope.ts` 的 `ERROR_CONTRACT`，它必须与 Python 的
> `sdks/python/elecredit/envelope.py:ERROR_CONTRACT` 逐项相同，由
> `tests/error-contract-consistency.test.ts` 双向校验。

## 仓库结构

```
sdks/typescript/
├── src/
│   ├── application/
│   │   ├── config.ts           运行时配置（baseUrl / profile 环境变量）
│   │   └── use-cases/remote-query.ts  通用远程查询用例
│   ├── cli/
│   │   ├── main.ts             CLI 入口（Commander）
│   │   └── program.ts          程序构建器（含 --format 取值校验）
│   ├── commands/
│   │   ├── register.ts         通用命令注册器（按 descriptor 动态挂载）
│   │   └── system/             capabilities / auth 命令组
│   ├── contracts/
│   │   ├── remote-capabilities.ts  10 端点 Zod schema + 命令选项 + 计费产品码（单一信源）
│   │   └── envelope.ts / errors.ts
│   ├── infrastructure/
│   │   ├── elecredit/
│   │   │   ├── client.ts       ElecreditClient：POST+JSON+签名管道 + 退避重试
│   │   │   ├── signature.ts    MD5 签名 + 紧凑 JSON
│   │   │   ├── envelope.ts     响应信封 + 三分类错误码
│   │   │   └── retry.ts
│   │   ├── credentials/        API Key / Keyring 凭据提供者
│   │   └── process/            shutdown / diagnostics
│   └── ...
├── schemas/
└── package.json
```

## 开发命令

```bash
npm run verify      # typecheck + build + smoke（CI 同样命令）
npm run typecheck   # tsc --noEmit
npm run build       # tsc 输出到 dist/
npm run test        # 构建 + vitest run（10 个测试文件 / 64 个用例）
npm run smoke:live  # 构建 + 对着真实 API 跑 10 端点冒烟（需要凭据）
npm run lint        # eslint
npm run format      # prettier --check
```

## 在线冒烟（live smoke）

单元测试全是 mock，**测不出上游契约漂移**。本仓库历史上两次重大事故都只有实测才能发现：
`isCompressed` 被声明成 boolean 而上游返回数字 `0/1`（Node 侧**全端点**失败）、
D11 字段名与枚举写错（该端点**从未打通**）。

`scripts/live-smoke.mjs` 就是补这条防线：对 10 个端点各发一次最小合法请求。

```bash
npm run smoke:live              # 需要 ELECREDIT_APP_ID + ELECREDIT_APP_KEY
npm run smoke:live -- --json    # 机器可读输出
```

**判据只有三个码**：`000` 成功有结果 / `001` 成功无结果 / **`SYS005` 账户余额不足**。
`SYS005` 之所以算通过——网关**先验签后扣费**，拿到它就证明签名算法、凭据、请求体序列化、
路由全部正确。这正是项目文档反复强调的语义。

三个刻意的设计：

| 设计                              | 原因                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **凭据缺失时 exit 3**，不静默跳过 | 「没凭据就 skip」等于没有冒烟。Python 侧 11 个集成用例静默 skip 就是这个教训                            |
| **内置负向自检**                  | 每次运行都用**错误的 appKey** 发 1 次请求，断言它**不被判为通过**。断言写坏（把什么都当成功）会立刻暴露 |
| **路径从注册表派生**              | 脚本只按能力 id 提供样本，**不复制**端点清单，避免造出第 5 份副本。新增端点忘加样本会直接失败           |

**局限**：账户无余额时，网关可能返回 `SYS005` **早于参数校验**，此时「参数名/字段名」
类回归挡不住（路径类仍能挡）。脚本会在全部 SYS005 时显式打印这条提示。

**执行频率**：CNB 定时任务，每周一 10:00（`Asia/Shanghai`），见根 `.cnb.yml` 的
`"crontab: 0 10 * * 1"`。凭据取自密钥仓库 `h1s97x/secret-env`，**不复制到 GitHub secret**。

## CI

CI 在 CNB 上跑（根 `.cnb.yml` 的 `ci-typescript-cli`），本地等价命令：

```bash
cd sdks/typescript
npm ci --ignore-scripts --no-audit --no-fund
npm run verify && npm run lint && npm run format
npm run test:coverage
npm pack --dry-run --ignore-scripts
```

**触发分档**：push 到 main / PR 命中 `sdks/typescript/**`（以及契约一致性测试会读的
`sdks/python/elecredit/endpoints.py`、`docs/api/elecredit/**`、根 `README.md`、`AGENTS.md`）
才跑；每周一 09:00（`Asia/Shanghai`）跑全量，覆盖 Node 22 / 24 与 arm64（`EXPECT_ARCH=arm64`
做架构断言，同时验证 `@napi-rs/keyring` 的原生二进制）。

> `arch check` 的口径：只有 arm64 job 设 `EXPECT_ARCH`。amd64 job 留空只打印 —— 官方
> `node:22` 镜像跑在 amd64 节点上时 `process.arch` 是 `x64` 不是 `amd64`，写 `EXPECT_ARCH=amd64`
> 会直接红（脚本虽已把 `amd64→x64` 归一化，但没必要两边都设）。

> 平台边界：CNB 官方节点只有 Linux（amd64 / arm64），原 GitHub 时代的 Windows / macOS
> target 已随迁移取消 —— 三平台矩阵在 GitHub 上长期红且无法本地复现，性价比不成立。
