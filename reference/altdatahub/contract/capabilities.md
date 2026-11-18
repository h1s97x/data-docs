# 能力矩阵

能力、路由、MCP tool、Skill 命令与降级口径的唯一真源是主仓 `contract/capabilities.json`；本页是面向读者的对照表。

## 五个能力

| 能力 id | HTTP | 需要网关 | MCP tool | Skill 命令 | scope |
|---|---|---|---|---|---|
| `ping` | `GET /v1/ping` | 否 | `altdatahub_ping` | `--capability ping` | — |
| `categories` | `GET /v1/categories` | 否 | `altdatahub_categories` | `--capability categories` | `categories` |
| `catalog` | `GET /v1/catalog` | 否 | `altdatahub_catalog` | `--capability catalog` | `catalog` |
| `schema` | `GET /v1/schema/{productCode}` | 否 | `altdatahub_schema` | `--capability schema` | `schema` |
| `query` | `POST /v1/query/{productCode}` | 是（`EDS_*`） | `altdatahub_query` | `--capability query` | `query` |

## 降级口径

| 类别 | 含义 | 是否重试 |
|---|---|---|
| `configuration` | 未配置 EDS 网关公共参数 | 否，服务端补 `EDS_*` |
| `validation` | 请求参数不合法 | 否 |
| `contract` | 响应信封未按预期解析 | 否 |
| `upstream` | 上游错误 | 看 `retryable`，按指示退避 |
| HTTP `401` | Token 无效或吊销 | 否，重新签发 |
| HTTP `403` | scope 不足或 IP 不在白名单 | 否 |
| HTTP `429` | 限流 | 是，稍后重试 |

## 在线验证状态

EDS 网关已完成全量在线验证（2026-11-16 S0101；2026-11-17 其余 50 个产品）：51 个 `productCode` 经能力服务查询均返回 HTTP 200（部分 0 行为正常空结果）；响应信封与错误码字段名已由真实响应确认；服务号按 `izxzx{product_code}` 模板全量可用。**请勿把空数据当作「确无记录」。**

逐端点参数与 curl 见 [端点参考](../api/endpoints)；tool schema 见 [Tools 参考](../mcp/tools)。
