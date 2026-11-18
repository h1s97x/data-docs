# 端点参考

能力服务把 51 个产品收敛成 5 个对外端点。Base URL 为你自己部署的能力服务地址：本机 `http://127.0.0.1:8802`，内网生产 `http://altdatahub-service:8802`。除 `ping` / `healthz` 外均需 `Authorization: Bearer <token>`。

## 端点总览

| 方法 | 路径 | 能力 | scope | 网关 |
|---|---|---|---|---|
| `GET` | `/v1/ping` | 健康检查 | — | 不需要 |
| `GET` | `/healthz` | 同 `/v1/ping` | — | 不需要 |
| `GET` | `/v1/categories` | 10 个产品大类 | `categories` | 不需要 |
| `GET` | `/v1/catalog` | 51 个产品摘要（可按 `category` 过滤） | `catalog` | 不需要 |
| `GET` | `/v1/schema/{productCode}` | 单产品字段字典 | `schema` | 不需要 |
| `POST` | `/v1/query/{productCode}` | 通用在线查询 | `query` | 需要 `EDS_*` |

## `GET /v1/ping`

不鉴权。返回服务信息、能力清单与目录/网关状态。

```bash
curl http://127.0.0.1:8802/v1/ping
```

```json
{ "success": true, "service": "altdatahub-service", "capabilities": ["categories","catalog","schema","query"], "catalog_offline": true }
```

## `GET /v1/categories`

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8802/v1/categories
```

响应 `data.count` 为大类数，`data.categories[]` 含 `key` / `name` / `section_id` / `product_count`。

## `GET /v1/catalog`

可选 query 参数 `category`（大类 key，如 `judicial`；省略返回全部 51 个产品）。

```bash
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8802/v1/catalog?category=judicial"
```

响应 `data.products[]` 为 `ProductBrief`：`product_code` / `name` / `section_id` / `section_name` / `field_count` / `structure_names`。

## `GET /v1/schema/{productCode}`

`productCode` 必须先在 catalog 白名单里存在，例如 `S0101`。

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8802/v1/schema/S0101
```

响应 `data` 含产品摘要与 `fields[]`（名称 / 类型 / 长度 / 非空 / 中文名 / 说明）。

## `POST /v1/query/{productCode}`

请求体是**平铺的业务参数**；8 个 `eds_*` 公共参数由服务端注入，业务参数带 `eds_` 前缀会被拒绝。参数名只允许标识符字符，值必须是标量（最多 40 个 / 8000 字符）。

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"entName":"贵州茅台","page":"1","pageSize":"20"}' \
  http://127.0.0.1:8802/v1/query/S0101
```

成功与结构化降级**都返回 HTTP 200**，以 `success` 字段区分：

```json
{ "success": true, "data": { "product_code": "S0101", "row_count": 1, "rows": [{}] } }
{ "success": false, "error": "缺少 EDS 网关公共参数", "category": "configuration", "retryable": false, "degrade_reason": "未配置 EDS 网关公共参数" }
```

`data.rows: []` 是**正常成功**（码表里没有「查无数据」），不能改写为「未查到」。

## 错误处置

| 现象 | 分类 | 重试 | 建议 |
|---|---|---|---|
| `1000` / `2000` / `3000` | validation / authentication | 否 | 核对参数、服务号与 `eds_account` |
| `9999` | upstream | 是 | 有界退避（3 次，2^n × 500ms） |
| HTTP `401` | 鉴权 | 否 | 重新签发 Token |
| HTTP `403` | ACL | 否 | 检查 scope 与来源 IP 白名单 |
| HTTP `429` | 限流 | 是 | 稍后重试 |

一律以响应里的 `retryable` 为准。机器版契约见 `/projects/altdatahub/openapi/service.yaml`。
