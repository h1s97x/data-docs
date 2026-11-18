# 02 架构

## 分层与请求链路

```
调用方 / AI
  │  Bearer Token
  ▼
service/  ── 鉴权链：IP CIDR → Token → scope → 限流 → 缓存
  │  XyjClient.from_env()（凭据只在这里解析）
  ▼
sdks/python/xyj_api  ── build_head（SHA1withRSA 对 body 签名）→ POST → 信封解析 → 可选验签(data)
  ▼
上游网关 /xyj-api/external/*
```

MCP 与 Skill 不直连网关，统一走 `service/`，因此 AI 侧只持有调用方 Token。

细节协议（规范化规则、验签范围、错误码）见 [`../protocol.md`](../protocol.md)，本页不复述。

## 能力编排（`service/capabilities.py`）

- 路由与工具定义从 `contract/capabilities.json` 读取，不硬编码；
- `invoke()` 统一流程：参数校验（平铺标量 + 白名单）→ 凭据缺失检查 → 调用 SDK → 业务失败降级 → 有界投影；
- 异常按类型映射为 `category` / `retryable`，错误码来自异常自身，不靠字符串解析；
- 本地校验失败（如 `query_type` 非法）在发请求前拦下，不消耗上游额度。

## 鉴权与隔离（`service/auth.py`）

三种模式（优先级）：registry（`tokens.json`，SHA-256 + scope + 过期 + 吊销）>
legacy（`SERVICE_AUTH_TOKEN`）> disabled（仅回环）。任何解析异常 fail closed。
Token 明文只在签发时打印一次；注册表 `chmod 600`、原地写入（bind mount inode 固定）。

## 降级语义

| category | 含义 | retryable |
|---|---|---|
| `configuration` | 服务端没配 `XYJ_*` | 否 |
| `validation` | 参数不合法 | 否 |
| `contract` | 信封/验签异常 | 否 |
| `upstream` | 网络或上游业务失败 | 看字段 |
| `auth` / `internal` | 鉴权 / 服务端异常 | 否 |

**重试一律跟随 `retryable` 字段**，不凭 HTTP 状态码猜。上游业务失败是 HTTP 200 +
`success=false`，调用方必须读 body。

## 有界输出

`service/projection.py` 四级压缩（始终合法 JSON），最终兜底只给字段名清单；
MCP `MCP_MAX_CHARS` 超限返回结构化 `_truncated`；Skill 文本摘要设上限并支持 `--output`。

## 响应验签的边界

`sign` 只覆盖 `data`（消费方自己密钥对的私钥签，故配对公钥可验）。`code` / `success` /
`timestamp` 不在范围内——**验签不能替代 HTTPS**。该口径由空 `data` 样本反推，
拿到非空样本后用 `xyj verify-probe` 复核（见 `docs/protocol.md` §3.1）。
