# 常见问题与排障

按「看到的现象」查。凭据来源与探测顺序见 [AGENTS.md](../AGENTS.md)，
错误码分类见 [REST API 契约总览](api/elecredit/README.md#错误码)，
签名细节见 [签名算法与自测](signature.md)。

## 凭据与签名

### 一直返回 `SYS005 余额不足`

**因为你的接入是对的。** `SYS005` 意味着签名已通过校验、凭据有效、网关可达，
只是账户余额不足。去 [https://api.elecredit.com/admin] 充值后即可拿到真实数据。
不要把它当认证失败去改签名——这是上手最常见的无效排错。

### 我有 API Key，能用吗

不能。Elecredit 用的是 **App ID + App Key 二元组**，不是单一 API Key，两者必须同时配置才生效。

### 报 `SYS001 签名校验失败`，怎么快速定位

按这个顺序检查（覆盖 90% 的场景）：

1. **body 是紧凑 JSON 吗？** `{"entName":"贵州茅台"}` ✅ / `{"entName": "贵州茅台"}` ❌
2. **中文转义了吗？** 必须 `ensure_ascii=False`，不能出现 `\u8d35...`
3. **时间戳是毫秒吗？** `int(time.time() * 1000)`，13 位
4. **签名和发送的是同一个 body 字符串吗？** 若序列化了两次，很可能不一致

详细排查见 [签名算法与自测](signature.md)。

### `SYS002 请求过期` 怎么办

时间戳必须是**毫秒**（不是秒）。同时确认本机时钟同步（容器里常见时钟漂移）。

### `.env` 与容器里的钥匙环

Python SDK 可自动加载 `./.env` 或 `~/.elecredit/.env`（需 `python-dotenv`）；
`.env` **必须加入 `.gitignore`**，一旦提交就是生产凭据泄漏。
Node CLI 的系统钥匙环在无 Secret Service 的 Linux 容器中不可用，
`auth status` 会带 `keyringError` 字段提示，此时改用环境变量。

## 数据与参数

| 现象 | 原因 | 修法 |
|---|---|---|
| `400 企业信息不能为空` | 参数名写错 | `B04 招投标` 与 `P0020019 实控人` 必须用 `entInfo`，不是 `entName` |
| `400 type值不在允许范围内` | `D11` 的 `type` 非法 | 用 [D11 的 12 个合法值](api/elecredit/judicial.md)之一，**大小写敏感** |
| `SYS044 资源不存在` | 路径大小写错误 | `P0020019` 必须是小写 w 的 `/saic/SaicinvWh`；`SYS044` 与「路径确实不存在」同码，极易误判 |
| `999 系统异常` | `D11` 的 `range` > 20 或 `pageNo` 超总页数 | `range` 上限 20 |
| HTTP `400` | 请求体校验失败 | 修正字段名与取值 |
| HTTP `5xx` / 网络错误 | 上游异常 | 有界退避重试 |

### 为什么传了企业名却返回 `001 查询成功无结果`

`001` 是**正常业务响应**（且同样计费），表示查询成功但没有匹配数据。可能原因：

- 名称不是工商登记全称（先用 A07 模糊查询拿到准确全称）
- 该企业确实没有对应记录（例如从未被行政处罚）

### 司法查询能一次拿多个 `type` 吗

不能。`D11` 的 `type` 是**单值、大小写敏感、不支持逗号多选**，
一次拿多种类型只能逐类型调用。只想看「各类型有多少条」用 Python SDK 的
`judicial_summary()`（1 次调用）；要「每个类型都有代表记录」用 `judicial_all()`
（自动跳过空类型、自动夹紧页数）。

`range` 上限 **20**（默认 10），超过会硬失败返回 `999`，不是静默截断。
另外 `types`（复数）、`startDate`、`endDate` 上游**静默忽略**——传了不报错但完全无效。

## 结果与性能

### `resultData` 里面为什么还有一层 `P0010068Data`

上游会把业务体再包一层：`resultData = { "[产品码]Status", "[产品码]Data" }`，
**产品码每个端点都不同**。Python SDK 用 `product_payload()` 自动探测
（匹配 `^P\d+Data$`，上游换码也不会失效），未命中返回 `{}` 不抛异常；
其它语言按 `resultData["[产品码]Data"]` 取，对照表见
[REST API 契约总览](api/elecredit/README.md#resultdata-包裹结构产品码)。

### 图谱（F09）请求很久没返回，是失败了吗

不是。`F09` 的**超时是 60 秒**（其它端点默认 10 秒），深层穿透数据量很大。
客户端超时设置需 ≥ 60s，用 `--level` 控制递归层数（默认 3 层、5% 持股阈值）。

### 结果太大，终端被刷屏 / 被截断

大结果必须落盘，落盘后只汇报**路径、行数和摘要**；Agent 场景尤其如此，
不要把全量 JSON 塞进对话上下文：

```bash
elecredit-ts enterprise graph --ent-info 贵州茅台 --level 4 --output graph.json
```

### 常见「看起来是错误」的正常情况

| 你看到的 | 实际情况 |
|---|---|
| `code: "SYS005"` | 签名正确，账户没余额 → 充值即可 |
| `code: "001"` | 查询成功，只是没有匹配数据 |
| `SYS044 资源不存在` | 很可能是**路径大小写**写错了 |
| `resultData.xxxCount: ""` 或键缺失 | 该类型无数据，归一为 0 处理 |
| 传了 `types` / `startDate` 没报错但没效果 | 上游**静默忽略**这些字段 |

## 接入方式选择

### CLI 和 SDK 覆盖的端点一样吗

完全一样，都是 10 个，不存在「CLI 能做、SDK 不能做」的差异。选哪个只取决于场景：

| 场景 | 选它 |
|---|---|
| 终端、CI、Agent | Node.js CLI（稳定 JSON 信封与退出码） |
| 数据分析、服务集成 | Python SDK（对象化返回值与异常分类） |
| 任何其它语言 | REST 直连 + 自行 MD5 签名 |

### 能在浏览器里直接调吗

**千万不要。** App Key 必须只在服务端使用，注入浏览器端 bundle 等于公开泄漏：
不要加 `NEXT_PUBLIC_` 之类的前缀，也不要在客户端组件里 `import` SDK。

正确做法是**服务端中转** —— 前端只调自己的 API，凭据只存在于服务端进程环境：

```ts
// Next.js App Router：app/api/elecredit/[capability]/route.ts
import { CliError, createClientFromEnv, query, type ErrorCategory } from '@h1s97x/elecredit';

export const runtime = 'nodejs'; // 需要 fetch + process.env，不要用 edge runtime

/** 6 个错误分类 → HTTP 状态（与 sdks/typescript/src/contracts/errors.ts 的 ErrorCategory 一一对应） */
const STATUS: Record<ErrorCategory, number> = {
  validation: 400,
  authentication: 401,
  billing: 402,
  rate_limit: 429,
  upstream: 502,
  internal: 500,
};

export async function POST(req: Request, ctx: { params: Promise<{ capability: string }> }) {
  const { capability } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await query(createClientFromEnv(), capability, body);
    return Response.json({ ok: true, data: result.data });
  } catch (err) {
    if (err instanceof CliError) {
      // SYS005 是余额不足：签名已通过，映射 402 提示充值，**不要重试**
      return Response.json(
        { ok: false, code: err.code, message: err.message },
        { status: STATUS[err.category] },
      );
    }
    throw err;
  }
}
```

其它框架同理（Express / Fastify / FastAPI …），不变的只有三件事：
**凭据留在服务端**、错误按 `category` 映射状态码、`SYS005` 不重试。

还有问题请查 [已知问题与待办登记册](wiki/08-known-issues.md)。
