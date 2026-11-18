# Tools 参考

`contract/capabilities.json` 是能力、路由与 MCP tool 的唯一真源，5 个 tool 的名称、`description` 与 `inputSchema` 全部由它派生，与 HTTP 端点一一对应。

| Tool | 能力 | 对应 HTTP | 网关 |
|---|---|---|---|
| `altdatahub_categories` | 列出 10 个大类（离线） | `GET /v1/categories` | 不需要 |
| `altdatahub_catalog` | 产品清单，可按大类过滤（离线） | `GET /v1/catalog` | 不需要 |
| `altdatahub_schema` | 单产品字段字典（离线） | `GET /v1/schema/{productCode}` | 不需要 |
| `altdatahub_query` | 按 `productCode` 查询（在线） | `POST /v1/query/{productCode}` | 需要 `EDS_*` |
| `altdatahub_ping` | 检查能力服务可达（不鉴权） | `GET /v1/ping` | 不需要 |

## `altdatahub_categories`

`inputSchema`：

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

## `altdatahub_catalog`

```json
{
  "type": "object",
  "properties": { "category": { "type": "string", "description": "大类 key，如 judicial；省略返回全部 51 个产品" } },
  "additionalProperties": false
}
```

## `altdatahub_schema`

```json
{
  "type": "object",
  "properties": { "product_code": { "type": "string", "description": "productCode，如 S0101" } },
  "required": ["product_code"],
  "additionalProperties": false
}
```

## `altdatahub_query`

```json
{
  "type": "object",
  "properties": {
    "product_code": { "type": "string", "description": "productCode，如 S0101；先用 catalog/schema 确认" },
    "params": { "type": "object", "description": "平铺业务参数，如 {\"entName\":\"贵州茅台\"}；不许含 eds_ 前缀" }
  },
  "required": ["product_code"],
  "additionalProperties": false
}
```

## `altdatahub_ping`

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

## 调用示例（JSON-RPC 2.0）

stdio 模式下一行一个请求：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"altdatahub_categories","arguments":{}}}
```

完整错误码与降级口径见 [API 文档端点参考](../api/endpoints)；部署配置见 [部署与配置](deploy)。
