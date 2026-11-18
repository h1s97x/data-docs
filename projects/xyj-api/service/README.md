# xyj-api 能力服务

把「**协议 SDK**」包装成「**只需一个调用方 Token 的 HTTP 能力**」。调用方无需接触
`XYJ_PRIVATE_KEY` 等网关凭据，凭据只在本服务进程内解析；企业侧系统 / AI 客户端统一走本服务。

设计对齐 `h1s97x/whccb/altdatahub` 与 `elecredit` 的 `service/` 层：能力注册表驱动路由、
Token 哈希注册表、scope / IP 白名单 / 限流 / 缓存、失败结构化降级、有界结果投影。

## 启动

```bash
# 方式一：本地进程（默认 127.0.0.1:8804）
python -m service

# 方式二：Docker（只绑回环）
docker compose -f service/compose.yml --env-file .env up -d --build

# 生产：不发布端口，加入调用方网络；tokens.json 只读挂载
docker compose -f service/compose.internal.yml --env-file .env up -d --build
```

> 安全守卫：未配置 Token 且监听非回环地址时直接 `SystemExit(2)`；`SERVICE_ALLOWED_CIDRS`
> 解析失败时 fail closed（拒绝全部来源）。

## 配置

| 变量 | 说明 |
|---|---|
| `SERVICE_HOST` / `SERVICE_PORT` | 监听地址，默认 `127.0.0.1:8804` |
| `SERVICE_AUTH_TOKEN` | 简易单 Token（legacy 模式，仅调试） |
| `SERVICE_TOKENS_FILE` | Token 注册表路径，默认 `service/tokens.json`（存在即启用 registry 模式） |
| `SERVICE_ALLOWED_CIDRS` | 来源 IP 白名单（逗号分隔 CIDR） |
| `SERVICE_RATE_LIMIT_PER_MIN` | 每 caller+能力 的每分钟限流，默认 120 |
| `SERVICE_CACHE_TTL` | 成功结果缓存秒数，默认 600 |
| `XYJ_BASE_URL` / `XYJ_ORG_CODE` / `XYJ_ORG_NAME` / `XYJ_PRIVATE_KEY` | 网关凭据（仅服务端） |
| `XYJ_PUBLIC_KEY` | 可选：开启响应验签（只覆盖 `data`） |

Token 管理：

```bash
python -m service.issue_token issue --caller app-a --scopes upstream,report_apply --days 30
python -m service.issue_token list
python -m service.issue_token revoke <sha256 前缀>
```

注册表只存 SHA-256 哈希，`chmod 600`，原地覆盖写入以适配 bind mount。

## 端点

| 方法 | 路径 | 说明 | scope | 网关凭据 |
|---|---|---|---|---|
| GET | `/v1/ping` | 健康检查（不鉴权，不代表凭据可用） | — | 否 |
| GET | `/ui` | 极简调试台（不鉴权） | — | 否 |
| GET | `/v1/capabilities` | 能力清单 | `capabilities` | 否 |
| POST | `/v1/query/upstream` | 企业上下游查询 | `upstream` | 是 |
| POST | `/v1/query/report-apply` | 申请报告 | `report_apply` | 是 |
| POST | `/v1/query/report-query` | 查询报告 | `report_query` | 是 |

请求体为平铺 JSON，例如：

```bash
curl -X POST http://127.0.0.1:8804/v1/query/upstream \
  -H 'Authorization: Bearer <TOKEN>' -H 'Content-Type: application/json' \
  -d '{"company_name":"某企业","nsrsbh":"9133...","data_key":"220_xxx"}'
```

## 响应语义（重要）

- **上游业务失败仍返回 HTTP 200**，必须通过 body 的 `success` 判定，不能只看状态码；
- 失败信封含 `category` / `retryable` / `degrade_reason` / `hint` / `msg`：
  - `configuration`：服务端未配 `XYJ_*`，不重试；
  - `validation`：参数问题，不重试；
  - `upstream`：网络/网关问题，按 `retryable` 决定是否退避重试；
  - `contract`：信封解析或验签失败，不重试；
- `data: []` / `upstreamTotal=0` 是**正常空结果**，不是服务故障，不得伪造数据；
- 大结果经有界投影（始终合法 JSON），被压缩时带 `_compacted: true`。

`ping` 只证明服务进程存活，**不证明**网关凭据可用；真正可用性以具体能力的 `success` 为准。

## 能力边界

- 轮询、落库、排序取前 N、扫码授权页留在调用方；
- 一个服务实例对应一套 `XYJ_*` 凭据；上下游与报告若为两套网关/私钥，请部署两个实例；
- 路由 / MCP tool / Skill command 的唯一真源是 `../contract/capabilities.json`。

## 测试

```bash
cd /workspace && python -m unittest discover -s service/tests -v
```
