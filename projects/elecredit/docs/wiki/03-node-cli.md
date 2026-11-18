# 03 · Node.js CLI 模块详解

子项目根：`/workspace/sdks/typescript`（包 `@h1s97x/elecredit`，v0.1.0，MIT，ESM，Node ≥ 22.12.0）

## 3.1 目录结构

```
sdks/typescript/
├── src/
│   ├── cli/            main.ts  program.ts
│   ├── commands/       register.ts  error-output.ts  system/{capabilities,auth}.ts
│   ├── contracts/      remote-capabilities.ts  errors.ts
│   ├── application/    config.ts  ports/auth-provider.ts  use-cases/remote-query.ts
│   ├── infrastructure/ elecredit/{client,signature,envelope,retry}.ts
│   │                   credentials/{app-key-pair-provider,keyring,redact}.ts
├── tests/              signature / envelope / remote-capabilities / remote-query
│                       package-exports / version-consistency
├── scripts/            check-license.mjs
└── 配置                 package.json  tsconfig.json  vitest.config.ts
                        eslint.config.js  prettier.config.mjs  npm-shrinkwrap.json
```

## 3.2 模块职责表

| 模块 | 职责 | 是否被主链路使用 |
|------|------|-----------------|
| `cli/main.ts` | shebang 入口，`buildProgram().parseAsync()`，异常→JSON→exit | ✅ |
| `cli/program.ts` | 构建 Commander 程序树，惰性 `getClient()` 工厂（经 `assembleClient` 装配）；`--format` 取值校验（非 json 报错 exit 2） | ✅ |
| `commands/register.ts` | 按 descriptor 动态注册 10 端点命令 | ✅ |
| `commands/system/capabilities.ts` | `capabilities` 命令，列出端点元数据 | ✅ |
| `commands/system/auth.ts` | `auth status` / `login` / `logout`（只报告来源，不回显值） | ✅ |
| `contracts/remote-capabilities.ts` | **10 端点单一信源**：Zod schema + CLI 选项 + 分页 + 超时 | ✅ |
| `contracts/errors.ts` | `CliError`、`ErrorCategory`、`ExitCode` | ✅ |
| `application/config.ts` | `resolveConfig()`：baseUrl / profile | ✅ |
| `application/ports/auth-provider.ts` | `AuthProvider` 抽象端口 | ❌ 接口 |
| `application/use-cases/remote-query.ts` | `queryFor` / `executeRemoteQuery` | ✅ |
| `infrastructure/elecredit/client.ts` | `ElecreditClient`：签名 + POST + 超时 + 重试 + 错误分类 | ✅ |
| `infrastructure/elecredit/assemble.ts` | `assembleClient()`：凭据 → client 的**唯一**组装点（组合根） | ✅（`index.ts` / `cli/program.ts`） |
| `infrastructure/elecredit/signature.ts` | 签名全流程 | ✅ |
| `infrastructure/elecredit/envelope.ts` | 码表 + `isBillingCode` / `isAuthError` / `isRetryable` + 信封 schema | ✅ |
| `infrastructure/elecredit/retry.ts` | 指数退避、`Retry-After` 解析 | ✅ |
| `infrastructure/credentials/app-key-pair-provider.ts` | App ID + App Key 二元组提供者（环境变量 → 钥匙环） | ✅ |
| `infrastructure/credentials/keyring.ts` | `KeyringCredentialStore`（`profile:<name>` 命名空间） | ✅（经 auth 命令与 program 接线） |
| `commands/error-output.ts` | 错误信封的**唯一**渲染出口（构造 + 脱敏 + 退出码） | ✅（`register.ts` / `main.ts`） |
| `infrastructure/credentials/redact.ts` | `redactText`：打印前脱敏敏感赋值 | ✅（经 `commands/error-output.ts`） |
| `output/*` | JSON/CSV/Table 渲染 | ❌ 未接线 |

> "❌ 未接线" 指模块已实现并导出，但**当前命令执行路径没有 import 它们**（多为从同构的兄弟项目继承的骨架代码）。详见 [08](08-known-issues.md)。

## 3.3 关键类与函数

### `cli/main.ts`

入口。行为：

- `buildProgram().parseAsync()` 成功后 `process.exit(0)`。
- 捕获 `CliError` → 打印 `{ok:false, error:{code,category,message,hint}}` → `exit(err.exitCode)`。
- 捕获其他异常 → `{ok:false, error:{message}}` → `exit(1)`。

### `buildProgram(): Command` — `cli/program.ts`

```ts
program.name('elecredit').version('0.1.0').option('--format [format]', '输出格式', 'json');
registerCapabilitiesCommand(program);
const config = resolveConfig();
// 惰性 client：只有真正发请求时才校验凭据
registerAllCapabilities(program, remoteCapabilities, { getClient });
```

- **惰性认证**：`_clientPromise` 缓存，首次调用才读环境变量。因此 `capabilities`、`--help` 无需凭据即可运行。
- 缺凭据抛 `CliError{code:'ELECREDIT_AUTH_REQUIRED', category:'authentication', exitCode:3}`。

### `resolveConfig(): RuntimeConfig` — `application/config.ts`

| 字段 | 来源 | 默认 |
|------|------|------|
| `profile` | `ELECREDIT_PROFILE` | `'default'` |
| `format` | 固定 | `'json'` |
| `baseUrl` | `ELECREDIT_BASE_URL` | `https://api.elecredit.com` |

### `registerAllCapabilities(root, caps, ctx)` / `registerCapabilityCommand(parent, cap, ctx)` — `commands/register.ts`

- 按 `cap.command[0]`（`enterprise` / `risk` / `litigation`）**自动建组**，组内挂 `cap.command[1]`。
- 选项生成：`--flag <type>`；`required` 用 `requiredOption`；`boolean` 不占位符。
- action 流程：`getClient()` → `executeRemoteQuery()` → 输出 `{ok, bizCode, data, orderNo?}`。
- 异常处理：统一交给 `commands/error-output.ts` 的 `renderCliError(err)` —— `CliError` 输出 `{ok:false, error:{code,category,message,hint?,retryable}}` 并 `exit(err.exitCode)`（2 校验 / 3 认证·余额 / 4 上游·限流）；其他异常输出 `{ok:false,error:{message}}` + `exit(1)`（两条调用路径的兜底码已统一，见 `error-output.ts` 文件头）。`message` / `hint` 打印前走 `redactText` 脱敏。该信封形状与 Python CLI 逐字段一致（`retryable` 是 2026-10-12 补齐的）。

```ts
export interface RegisterContext {
  getClient: () => Promise[ElecreditClient];   // 惰性认证工厂
}
```

### `queryFor(capability, input): Record<string, unknown>` — `application/use-cases/remote-query.ts`

CLI 选项 → API body 的映射：

1. `optionKey('--page-no')` → `pageNo`（长选项去 `--`、去 `no-` 前缀、短横线转驼峰）。
2. 只保留 input 中存在的键；丢弃 `undefined` / `null` / 空串。
3. 字段名优先用 `opt.queryName`，否则用驼峰键。
4. `type === 'integer'` 的值 `String(raw)`。

### `executeRemoteQuery[T](client, capability, input): Promise<ElecreditSuccess[T]>`

`queryFor` → `inputSchema.safeParse` → `client.request({path, body, schema, timeoutMs})`。校验失败抛 `CliError{code:'ELECREDIT_VALIDATION', category:'validation', exitCode:2}`（message 为聚合后的 `path: message; …`）。**应用层认识错误契约**，边界处不再靠调用方猜兜底退出码。

### `class ElecreditClient` — `infrastructure/elecredit/client.ts`

```ts
new ElecreditClient({
  baseUrl, appId, appKey, auth,
  timeoutMs      = 10_000,   // 默认 10s
  maxAttempts    = 3,
  fetch          = globalThis.fetch,
  sleep          = defaultSleep,
  random         = Math.random,
  signal?,                    // 外部取消
})
createElecreditClient(opts)   // 工厂函数
```

**`request[T](req, signType='MD5'): Promise<ElecreditSuccess[T]>`**

| 参数 | 类型 | 说明 |
|------|------|------|
| `req.path` | `string` | 端点路径 |
| `req.body` | `Record<string, unknown>` | 业务体（不含签名字段） |
| `req.schema` | `ZodType<T>` | 用于校验 `resultData` |
| `req.timeoutMs` | `number?` | 覆盖默认（F09 传 60000） |

返回 `ElecreditSuccess[T] = { data, bizCode, orderNo?, resultCode? }`。

**私有 `classifyError(env)`** —— 分类/退出码/可重试**查表**，文案另有覆盖表：

| 命中 | category / exit / retryable | message 覆盖 |
|------|------|------|
| `SYS001` | authentication / 3 / 否 | `签名校验失败，请检查 appKey 是否正确` |
| `SYS002` | authentication / 3 / 否 | `请求过期，请检查本机时钟是否与公共时间服务器同步` |
| `SYS003` | authentication / 3 / 否 | `应用 ID 不存在，请确认 app-id 配置` |
| `SYS004` | authentication / 3 / 否 | `签名算法不支持，请使用 MD5 或 SHA256` |
| `SYS005` | **billing** / 3 / 否 | `账户余额不足，请充值后重试` |
| `SYS006` | authentication / 3 / 否 | `请求 IP 受限，请联系元素数智添加白名单` |
| `SYS007` | upstream / 4 / **是** | — |
| `SYS008` | **rate_limit** / 4 / 是 | — |
| `SYS009` | **validation** / 2 / 否 | hint 指向「缩小请求体」 |
| `SYS044` | upstream / 4 / **否** | hint 指向「端点路径大小写」 |
| `400` | validation / 2 / 否 | — |
| `999` | upstream / 4 / 是 | — |
| 其他 | upstream / 4 / 是 | — |

**唯一真源是 `envelope.ts` 的 `ERROR_CONTRACT`**（19 条，含 `HTTP_429` / `HTTP_4XX` /
`HTTP_5XX` / `NETWORK` / `UNKNOWN_CODE` / `LOCAL_USAGE` / `INTERNAL` 等符号键），
`classifyError` 只负责按表构造 `CliError` 并叠加 `CODE_PRESENTATION` 的文案。
`ERROR_CONTRACT` 必须与 Python 的 `sdks/python/elecredit/envelope.py:ERROR_CONTRACT` 逐项相同
（`tests/error-contract-consistency.test.ts` 双向校验）。

HTTP 非 2xx 走另一条路：`code` 为 `HTTP_<status>`，分类/退出码同样查表，
但**可重试性用 `RETRYABLE_HTTP_STATUS_CODES`**（`{429, 502, 503, 504}`，比契约里的
`HTTP_5XX` 窄 —— 500/501 不重试）。

### 签名模块 — `infrastructure/elecredit/signature.ts`

| 函数 | 签名 | 说明 |
|------|------|------|
| `generateRequestSn()` | `() => string` | `randomUUID()` 去横线，32 位 |
| `generateTimestamp()` | `() => string` | `String(Date.now())` |
| `buildSignStr(sn, ts, body, appKey)` | `(…)=> string` | 四段拼接 |
| `computeSignature(signStr, signType='MD5')` | `(…)=> string` | `md5`/`sha256` hex |
| `compactJson(obj)` | `(unknown)=> string` | 紧凑 JSON，**剔除空字符串值** |
| `signRequest(body, appKey, signType='MD5', overrides?)` | `(…)=> SignedRequest` | 一步产出 `{requestSn, timestamp, signature, signType, bodyString, bodyForSign}` |

`overrides` 可注入固定 `requestSn` / `timestamp`，便于确定性测试。

### 码表模块 — `infrastructure/elecredit/envelope.ts`

```ts
ELECREDIT_BIZ_CODE_OK = '000'            // 成功有结果（计费）
ELECREDIT_BIZ_CODE_OK_EMPTY = '001'      // 成功无结果（计费）
ELECREDIT_BIZ_CODE_PARAM_ERROR = '400'
ELECREDIT_BIZ_CODE_SERVER_ERROR = '999'

ELECREDIT_SYS_AUTH_FAIL = 'SYS001'       // 认证失败/签名错
ELECREDIT_SYS_EXPIRED = 'SYS002'         // 请求过期
ELECREDIT_SYS_APP_NOT_FOUND = 'SYS003'   // 应用不存在
ELECREDIT_SYS_BAD_SIGN_TYPE = 'SYS004'   // 签名算法不支持
ELECREDIT_SYS_INSUFFICIENT_BALANCE = 'SYS005'  // 余额不足
ELECREDIT_SYS_IP_BLOCKED = 'SYS006'      // IP 受限
ELECREDIT_SYS_DUPLICATE_SN = 'SYS007'    // 流水号重复
ELECREDIT_SYS_RATE_LIMIT = 'SYS008'      // 频率过快
ELECREDIT_SYS_PAYLOAD_TOO_LARGE = 'SYS009'
ELECREDIT_SYS_RESOURCE_NOT_FOUND = 'SYS044'  // 资源不存在（多为路径大小写写错）
```

外加一张 **`ERROR_CONTRACT`**（19 条 `码 → { category, exitCode, retryable }`）与取表函数
`contractFor(code, httpStatus)`、`isRetryable(code, httpStatus)`（后者只额外加一条护栏：
`000`/`001` 已计费，永不重试）。`isRetryable` 的判定已从「手写集合」改为查表，
所以「分类」与「能不能重试」不会再有第二套口径。

- `isBillingCode(code)`：`000`/`001` → true
- `isAuthError(code)`：`SYS` 前缀且数字 ∈ [1,6]
- `isRetryable(code, httpStatus)`：见 [02 §2.6](02-architecture.md#26-响应信封与错误分类)
- `elecreditEnvelopeSchema`：Zod 形状校验（`code` 必填字符串，其余可选）

### 重试模块 — `infrastructure/elecredit/retry.ts`

```ts
retryDelayMs(attempt, random)   // base = min(1000 * 2**attempt, 8000); base + base*0.2*random()
parseRetryAfter(value, now, max=30_000)  // 支持秒数与 HTTP 日期两种格式
defaultSleep(ms, signal?)       // node:timers/promises setTimeout
RETRYABLE_HTTP_STATUS_CODES = {429, 502, 503, 504}
RETRYABLE_BUSINESS_CODES    = {4001, 5001, 5002, 5003}   // 当前 client 未使用
MAX_RETRY_AFTER_MS = 30_000
```

示例延迟（random=0.5）：1100 / 2200 / 4400 / 8800 ms。

### 错误契约 — `contracts/errors.ts`

```ts
class CliError extends Error {
  code; category; hint; retryable; exitCode; requestId?; debugStack?;
}
type ErrorCategory = 'validation' | 'authentication' | 'upstream' | 'local-data' | 'internal';
type ExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// 错误渲染统一走 commands/error-output.ts 的 renderCliError(err, fallbackExitCode?)
```

### 10 端点描述符 — `contracts/remote-capabilities.ts`

```ts
interface RemoteCapabilityDescriptor {
  id: string;                       // 'enterprise.fuzzy'
  command: readonly [string,string];// ['enterprise','fuzzy']
  description: string;
  endpoint: string; method: 'POST';
  inputSchema: ZodType<Record<string, unknown>>;
  outputSchema: ZodType[unknown];   // 当前均为 z.object({}).passthrough().catch({})
  options: readonly RemoteOptionDescriptor[];
  paging: 'none' | 'offset' | 'page';
  window: 'none';
  timeoutMs?: number;                // 仅 F09 = 60_000
}
interface RemoteOptionDescriptor {
  flags; description; type: 'string'|'integer'|'number'|'boolean';
  required?; choices?; defaultValue?; queryName?;   // queryName = API body 字段名
}
```

`remoteCapabilities: readonly RemoteCapabilityDescriptor[]` 为**唯一信源**，被 `register.ts`（生成命令）与 `capabilities` 命令（列出元数据）共用。

### `class AppKeyPairAuthProvider` — `infrastructure/credentials/app-key-pair-provider.ts`

凭据解析优先级：**explicit → 环境变量（`ELECREDIT_APP_ID` + `ELECREDIT_APP_KEY`）→ 系统钥匙环**。

键名 `profile:<name>`，值为 JSON `{"appId": "...", "appKey": "..."}`。

| 方法 | 行为 |
|------|------|
| `resolve(profile, explicit?)` | 按上述优先级返回 `AuthSession`（`source: 'explicit' \| 'environment' \| 'keyring'`）；全缺失抛 `ELECREDIT_AUTH_REQUIRED`（exit 3）。钥匙环不可用时不掩盖「缺凭据」主因 |
| `login({profile, appId, appKey})` | 校验非空后写入钥匙环；空值抛 `AUTH_CREDENTIAL_EMPTY`（exit 2） |
| `logout(profile)` | 删除该 profile |
| `status(profile)` | 返回 `{configured}`；钥匙环不可用抛 `AUTH_CREDENTIAL_STORE_UNAVAILABLE` |

### 其他模块

| 模块 | 主要导出 | 说明 |
|------|---------|------|
| `credentials/keyring.ts` | `CredentialStore`、`KeyringCredentialStore` | `@napi-rs/keyring`，service 默认 `'elecredit'` |
| `credentials/redact.ts` | `redactText` | 正则 + 已知秘密替换；敏感键 `apikey/token/authorization/cookie/secret/password` |
| `commands/error-output.ts` | `renderCliError(err, fallbackExitCode?)` | CLI 错误信封的唯一渲染出口；`message`/`hint` 走 `redactText`，形状 `{ok:false,error:{code,category,message,hint?}}`（非 CliError 时 `{ok:false,error:{message}}`） |

### 已删除的遗留模块（2026-10-12）

与下面 2026-09-30 那批同源：都是**另一个股票/基金数据项目**复制过来的残留。本轮按 `docs/wiki/08` 的
**B 项决策**处置——「要么接线、要么删除，不要长期悬着」，证据指向删除：

| 模块 | 删除理由 |
|------|---------|
| `contracts/envelope.ts` | `errorEnvelope` / `successEnvelope` **零引用**（连测试都没有——08 里「仅测试引用」的表述有误）。`ResultMeta.adjust` 注释写着「价格复权模式（`qfq`/`hfq`）」，是证券行情词汇；且其信封形状（`meta.cliVersion`/`schemaVersion`/`error.retryable`）与线上已文档化的契约 `{ok,error:{code,category,message,hint}}` 冲突。同 2026-09-30 删掉的 `schemas/command-envelope.schema.json` |
| `infrastructure/process/shutdown.ts`、`child-diagnostics.ts` | 零引用（`child-diagnostics.ts` 是 `cancelledError()` 的唯一消费方，它一走后者也随之失效） |
| `contracts/errors.ts` 的 `internalError` / `cancelledError` / `throwIfCancelled` | 零引用 |
| `credentials/redact.ts` 的 `redactValue` | 零引用（`redactText` 保留并**真正接线**） |
| `credentials/keyring.ts` 的 `listAccounts` | 零引用（provider 只用 get/set/delete） |

顺带修掉两处结构问题：

1. **反向依赖**：`contracts/errors.ts` 曾 `export { redactText } from '../infrastructure/…'`，
   使 `contracts → infrastructure` 出现反向边。该转出零引用，已删除。
2. **重复实现**：错误信封原本在 `commands/register.ts` 与 `cli/main.ts` **各写了一份逐字符相同**的
   构造（且都没脱敏）。已收敛到 `commands/error-output.ts`，并把 `redactText` 接进真实输出路径
   —— 上游响应文本里若夹带 `token=…` 会在打印前被替换为 `[REDACTED]`。新增 `tests/error-output.test.ts`（5 用例）锁住形状、退出码与脱敏行为。

### 已删除的遗留模块（2026-09-30）

这些模块**零活引用**，且是从**另一个股票/基金数据项目**复制过来的残留（`thscode`、复权因子、基金文案）。
其中「table / csv 输出」这项能力**从未接线**——传 `--format csv` 会被静默忽略，本次一并修掉
（现在传非 `json` 会直接报错并 `exit 2`）：

| 模块 | 删除理由 |
|------|---------|
| `output/renderer.ts`、`output/table.ts` | table/csv 渲染从未接线，却被文档描述为已实现能力 |
| `output/json.ts` | 会把所有键 snake_case 化（注释举例 `thscode`），与当前输出契约（`{ok, bizCode, data, orderNo?}`）冲突 |
| `cli/context.ts` | `CliContext` 只被已删的 renderer 引用 |
| `cli/i18n.ts` | 内容全是 `thscode` / 复权因子 / 基金等股票项目文案 |
| `contracts/registry.ts` | `CommandDescriptor` 契约零引用，实际注册走 `remote-capabilities.ts` |
| `schemas/command-envelope.schema.json` | 描述的是上面那套未接线的信封，零引用（处理方式同 08 里的 18 号遗留项） |

## 3.4 命令树

```
elecredit
├── capabilities                      列出 10 端点元数据（无需凭据）
├── auth
│   ├── status              检查凭据来源（环境变量 / 钥匙环），不回显值
│   ├── login               --app-id --app-key [--profile]，写入系统钥匙环
│   └── logout              [--profile]，删除钥匙环中的凭据
├── enterprise
│   ├── deep                 A03  4 选 1 标识
│   ├── scale                A04  --ent-info（必填）
│   ├── fuzzy                A07  --ent-name（必填）--type --region-id --page-no --range
│   ├── tax-credit           B06  --entity-name（必填）--type --page-no --range
│   ├── admin-punishment     D07  --ent-info（必填）--type --page-no --range --start-date --end-date
│   ├── graph                F09  --ent-info（必填）--level --down --up（60s 超时）
│   ├── bidding              B04  --ent-info（必填）--page-no --range --position --start-date --end-date
│   └── actual-controller    P0020019  --ent-info（必填）
├── risk
│   └── judicial-fuzzy       D11  --entity-name（必填）--type（12 选 1）--page-no --range（≤ 20）
└── litigation
    └── xgbzxr               D14  --pers-name（必填）--id-no（必填）
```

`auth` 组由 `registerAuthCommand(program, provider, defaultProfile)` 注册；
端点命令由 `registerAllCapabilities` 依据 `remote-capabilities.ts` 自动生成。

## 3.5 构建配置要点

| 文件 | 要点 |
|------|------|
| `tsconfig.json` | target ES2022 / module NodeNext / `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`；rootDir `src` → outDir `dist`；产出 d.ts 与 sourceMap；`removeComments` |
| `package.json` | `bin.elecredit-ts → dist/cli/main.js`；`files: ["dist"]`；`postinstall` 空操作（避免 keyring 原生模块安装副作用）；`exports["."]` = `types` + `import` + `default`，`default` 供 CJS 消费方兜底（Node ≥ 22.12 的 `require(esm)`） |
| `vitest.config.ts` | `include: ['tests/**/*.test.ts']`，timeout 15s；11 个测试文件、86 个用例 |
| `eslint.config.js` | `@eslint/js` recommended + `typescript-eslint` recommended |
| `prettier.config.mjs` | 单引号、尾逗号、printWidth 100 |
| `scripts/check-license.mjs` | `prepublishOnly` 前置：缺少 LICENSE 则写 `LICENSE_APPROVAL_REQUIRED` 并置 exitCode 1 |
