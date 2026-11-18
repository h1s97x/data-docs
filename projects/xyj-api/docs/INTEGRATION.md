# 接入 xyj 能力服务

面向**调用方**：只需一个 Token，不接触 `XYJ_PRIVATE_KEY` 等网关凭据。
如果你要的是「直连上游网关的协议实现」，看 [`protocol.md`](protocol.md) 与 `sdks/python/README.md`；
本页讲的是已部署的 `service/` 能力服务。

## 1. 先拿到三样东西

| 需要 | 来源 |
|---|---|
| 服务地址 | 部署方提供，如 `http://xyj-service:8804` |
| 调用方 Token | 部署方用 `python -m service.issue_token issue --caller <你> --scopes <能力>` 签发 |
| 契约 | [`../openapi/service.yaml`](../openapi/service.yaml)（可导入 Apifox）或本页表格 |

不要把直连 SDK 的 `XYJ_PRIVATE_KEY` 发给调用方；那是服务端凭据。

## 2. 三条免写码 / 低代码路径

### a) 任意语言（curl）

```bash
curl -X POST http://xyj-service:8804/v1/query/upstream \
  -H 'Authorization: Bearer <TOKEN>' -H 'Content-Type: application/json' \
  -d '{"company_name":"某企业","nsrsbh":"9133...","data_key":"220_xxx"}'
```

### b) 标准库脚本（Skill）

```bash
export XYJ_SERVICE_URL=http://xyj-service:8804
export XYJ_SERVICE_TOKEN=<TOKEN>
python skills/xyj-service/scripts/query.py --capability upstream \
  --param company_name=某企业 --param nsrsbh=9133... --param data_key=220_xxx
```

### c) AI 客户端（MCP）

stdio 或 `POST /mcp` 两种 transport，见 [`../mcp/README.md`](../mcp/README.md)。
AI 侧只需 `XYJ_SERVICE_TOKEN`；网关凭据不出服务进程。

## 3. 端点速查

| 方法 | 路径 | 说明 | scope |
|---|---|---|---|
| GET | `/v1/ping` | 存活（不鉴权） | — |
| GET | `/v1/capabilities` | 能力清单 | `capabilities` |
| POST | `/v1/query/upstream` | 企业上下游查询 | `upstream` |
| POST | `/v1/query/report-apply` | 申请报告 | `report_apply` |
| POST | `/v1/query/report-query` | 按 taskNo 查报告 | `report_query` |

## 4. 响应与错误语义（重要）

- **上游业务失败仍返回 HTTP 200**，必须读 body 的 `success`，不能只看状态码；
- 失败信封：`code` / `category` / `retryable` / `degrade_reason` / `hint` / `msg`；
- **重试与否一律跟随 `retryable`**：`configuration` / `validation` / `contract` 不重试，
  `upstream` 按字段决定；HTTP 401/403 重新签发 Token，429 稍后重试；
- `ping` 只证明服务进程存活，**不证明**网关凭据可用；
- `data` 为空 / `upstreamTotal=0` 是正常空结果，**不是**「服务故障」，也不得伪造数据；
- 大结果被有界投影时带 `_compacted: true`，用脚本的 `--output` 取完整 JSON。

## 5. 上线前检查

- [ ] `SERVICE_ALLOWED_CIDRS` 按最小权限配置（非法 CIDR 会被忽略，全非法则拒绝所有）；
- [ ] `SERVICE_RATE_LIMIT_PER_MIN` 设了合理上限；
- [ ] Token 按能力 scope 最小化、设置 `--days` 过期、可随时 `revoke`；
- [ ] `tokens.json` 未进 Git，服务端 `.env` 未进 Git；
- [ ] 非回环部署时 Token 注册表 / `MCP_AUTH_TOKEN` 已配置（否则服务拒绝启动）。

## 6. 契约维护

- `contract/capabilities.json` 是能力/路由/MCP tool/Skill 命令的唯一真源；
- `openapi/openapi.yaml`（上游协议）和 `openapi/service.yaml`（能力服务）定位不同，勿混；
- 改完跑 `python contract/verify.py all`；Apifox 只是视图，不要反向导出覆盖。
