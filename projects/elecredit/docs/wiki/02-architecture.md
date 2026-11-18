# 02 · 整体架构

## 2.1 全局架构

```
                      用户 / AI Agent / 脚本
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
   Node.js CLI                                 Python SDK / CLI
   sdks/typescript/src                           sdks/python/elecredit
        │                                           │
        │  ┌────────────── 共同契约 ──────────────┐  │
        └──┤ POST https://api.elecredit.com<path> │──┘
           │ Header 签名: MD5(sn+ts+body+appKey)  │
           │ body: 紧凑 JSON，中文不转义           │
           └────────────────┬────────────────────┘
                            │
                   上游 Elecredit 网关
                            │
                 ┌──────────┴──────────┐
                 │ {code,msg,orderNo,   │
                 │  resultCode,resultData}│
                 └──────────┬──────────┘
                            │
              plugins/skills/elecredit-skill/SKILL.md   ← Agent 侧路由决策（不改数据流）
              docs/api/elecredit/*.md     ← 契约文档（不改数据流）
```

两个客户端**完全独立、无共享代码、无互相依赖**，只共享同一套线上协议。因此功能上基本对等，参数细节存在若干差异（见 [05](05-endpoints.md) 与 [08](08-known-issues.md)）。

## 2.2 Node.js CLI 分层架构

采用**端口与适配器（Hexagonal）风格**的分层，`infrastructure` 不反向依赖 `cli`：

```
┌─ cli 层（表现层）────────────────────────────────────────────┐
│  main.ts        Commander 入口，捕获异常 → JSON → process.exit │
│  program.ts     程序构建器：注册 capabilities + 10 端点命令     │
│                 （--format 仅支持 json，传其它值直接报错）        │
└────────────────────────┬──────────────────────────────────────┘
                         │ 注入 getClient()（惰性）
┌─ commands 层 ──────────┴──────────────────────────────────────┐
│  register.ts          按 descriptor 动态生成 Commander 子命令   │
│  system/capabilities.ts  列出全部端点能力                       │
└────────────────────────┬──────────────────────────────────────┘
                         │
┌─ application 层（用例/端口）───────────────────────────────────┐
│  use-cases/remote-query.ts  CLI opts → body → Zod 校验 → 调用   │
│  config.ts                resolveConfig（baseUrl / profile）    │
│  ports/auth-provider.ts   AuthProvider 抽象接口                 │
└────────────────────────┬──────────────────────────────────────┘
                         │ 依赖倒置
┌─ infrastructure 层（适配器）───────────────────────────────────┐
│  elecredit/client.ts       POST + 签名 + 超时 + 退避重试 + 分类 │
│  elecredit/assemble.ts     凭据 → client 的**唯一**组装点（组合根）│
│  elecredit/signature.ts    MD5/SHA256 签名、紧凑 JSON           │
│  elecredit/envelope.ts     业务码/系统码常量 + 重试判定         │
│  elecredit/retry.ts        指数退避 + Retry-After 解析          │
│  credentials/              app-key-pair-provider/keyring/redact │
└────────────────────────────────────────────────────────────────┘

┌─ contracts 层（契约，被所有层引用）────────────────────────────┐
│  remote-capabilities.ts   10 端点 Zod schema + CLI 选项（单一信源）│
│  errors.ts                CliError / ErrorCategory / ExitCode    │
└─────────────────────────────────────────────────────────────────┘
```

**关键设计**：`contracts/remote-capabilities.ts` 是**单一信源**。新增一个端点只需在此数组追加一项 descriptor，`register.ts` 会自动生成命令、选项、校验和执行逻辑，无需新增命令文件。

## 2.3 Python SDK 分层架构

扁平的 4 层结构，无框架依赖：

```
┌─ 门面层 ─────────────────────────────────────────────┐
│  __init__.py    ElecreditClient + 12 个模块级便捷函数  │
│  __main__.py    python -m elecredit                   │
│  cli.py         Typer CLI（描述符驱动，可选依赖）       │
└───────────────────────┬──────────────────────────────┘
                        │
┌─ 客户端层 ────────────┴──────────────────────────────┐
│  client.py   ElecreditClient：12 便捷方法 + query()     │
│              + post() + _post() 重试 + 双 HTTP 实现     │
└───────────────────────┬──────────────────────────────┘
                        │
┌─ 协议层 ──────────────┴──────────────────────────────┐
│  signature.py     SignedRequest / compact_json / sign   │
│  envelope.py      parse_response / is_success / classify│
│  errors.py        ElecreditError + 5 个子类             │
│  endpoints.py     ENDPOINTS 注册表（NamedTuple：code/  │
│                   path/描述/分页/product_code）          │
│  credentials.py   Credentials / resolve_credentials     │
└────────────────────────────────────────────────────────┘
```

**关键设计**：HTTP 实现**运行时自动选择** —— 有 `requests` 用它，否则回退标准库 `urllib`，因此纯标准库模式下也能跑（`cli.py` 除外，它需要 Typer）。

## 2.4 请求生命周期（以 Node CLI 为例）

```
1. main.ts  parseAsync(process.argv)
      │
2. program.ts buildProgram()
      ├─ registerCapabilitiesCommand()            → capabilities
      ├─ resolveConfig()                          → baseUrl / profile
      └─ registerAllCapabilities(…, { getClient })  → 按 command[0] 分组挂载 10 命令
      │
3. Commander 匹配子命令，解析 --flags 为 opts
      │
4. getClient()  ← 惰性触发：此刻才解析凭据
      ├─ AppKeyPairAuthProvider.resolve()：显式 → 环境变量 → 钥匙环
      ├─ 全缺失 → CliError(exit 3)
      └─ assembleClient({ session, config })  ← 唯一组装点（组合根）
      │
5. executeRemoteQuery(client, capability, opts)
      ├─ queryFor()：opts → body（过滤空值；integer 转字符串；queryName 改名）
      └─ capability.inputSchema.safeParse(body)  → 失败抛 validation 错误(exit 2)
      │
6. ElecreditClient.request<T>({ path, body, schema, timeoutMs })
      │
7. for attempt in 0..maxAttempts-1:
      ├─ attempt>0 → sleep(retryDelayMs(attempt, random))
      ├─ signRequest(body, appKey, 'MD5')         → sn/ts/signature/bodyString
      ├─ fetch(POST, headers{signature…}, bodyString, AbortSignal(timeout))
      ├─ !resp.ok → 可重试状态码(429/502/503/504)则 continue，否则抛
      ├─ JSON 解析失败 → upstream 错误
      ├─ elecreditEnvelopeSchema.safeParse()       → 信封形状校验
      ├─ code ∈ {000, 001} → req.schema.safeParse(resultData) → 返回
      └─ 否则 classifyError(env) → 可重试? continue : throw
      │
8. register.ts action 组装 { ok:true, bizCode, data, orderNo? } 输出 JSON
      │
9. 异常 → { ok:false, error:{message} }，process.exit(2)
      │
10. main.ts 顶层捕获 CliError → { ok:false, error:{code,category,message,hint} }，exit(err.exitCode)
```

Python 侧生命周期基本一致，差异在于：签名在 `_post()` 之前**只算一次**（重试复用同一签名），而 Node 每次 attempt 都重新生成 sn/ts。

## 2.5 签名与序列化

| 环节 | 约定 | 踩坑点 |
|------|------|--------|
| `requestSn` | 32 位随机串（UUID 去横线） | Node 用 `randomUUID().replace(/-/g,'')`，Python 用 `uuid.uuid4().hex` |
| `timestamp` | 毫秒 Unix 时间戳**字符串** | 时钟偏差过大触发 `SYS002` |
| `body` | 紧凑 JSON，`separators=(",",":")` | **中文必须不转义**（`ensure_ascii=False`） |
| `signature` | `MD5(sn+ts+body+appKey).hex()` | Node 额外支持 `SHA256`，Python 仅 MD5 |
| 位置 | HTTP Header | **不放 body**，服务端用同样的 body 重算 |
| 空值 | Node `compactJson` 会剔除空字符串值 | 与 Python 行为不同（Python 保留空串） |

## 2.6 响应信封与错误分类

```jsonc
{
  "code": "000",        // "" | "000" 成功有结果 | "001" 成功无结果 | "400" 参数错 | "999" 服务异常 | "SYS001"~"SYS099"
  "msg": "…",           // 描述
  "orderNo": "…",       // 计费订单号
  "resultCode": "…",    // 业务结果码
  "resultData": { },    // 业务数据（结构随端点变化）
  "packetCnt": 1,       // 可选：分页总数
  "isCompressed": 0     // 可选；上游实际返回数字 0/1（不是 boolean）
}
```

**成功判定**：`code` 为空 / `000` / `001`。其中 `000`、`001` **都计费**。

**重试判定（Node `isRetryable`）**：

| 条件 | 是否重试 | 理由 |
|------|---------|------|
| `httpStatus >= 500` | ✅ | 上游异常 |
| `code` 为 `000`/`001` | ❌ | 已计费，重试会重复扣费 |
| `999`（服务异常） | ✅ | 未计费 |
| `SYS008`（限流） | ✅ | 降速后可恢复 |
| `SYS007`（流水号重复） | ✅ | 极少出现 |
| `SYS001`~`SYS006` | ❌ | 认证域，重试无意义 |

**Python 重试判定（client._post）**：`SYS005` 与 `SYS001/002/003/004/006` 立即抛出不重试；其余异常按 `sleep(2**attempt * 0.1)` 退避，最多 `max_attempts=3`。

## 2.7 退出码对照

| 场景 | Node CLI（`contracts/errors.ts`） | Python CLI（`cli.py`） |
|------|----------------------------------|------------------------|
| 成功 | 0 | 0 |
| 未分类内部错误 | 1 | 1 |
| 参数 / 校验失败 | 2（register.ts 捕获任何异常也用 2） | 2 |
| 认证失败 | 3 | 3 |
| 余额不足（SYS005） | 3（`ELECREDIT_SYS_INSUFFICIENT_BALANCE` 归入 authentication 类） | 3 |
| 上游错误 | 4 | 5 |
| 限流 | （归入 upstream/SYS008，4） | 4 |
| 本地数据错误 | 5（保留） | — |
| 保留 | 6 | 6（未知 ElecreditError） |

> 注意：Node 中 `createElecreditClient` 之外的路径（如 `program.ts` 缺凭据）同样使用 exit 3；但实际动作内抛出的错误由 `register.ts` 统一 `process.exit(2)`，尚未接入 `CliError.exitCode`。详见 [08](08-known-issues.md)。
