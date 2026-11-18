# OpenAPI 契约

两份文档定位不同，不要混用：

| 文件 | 视角 | 说明 |
|---|---|---|
| `openapi.yaml` | 上游网关协议 | 3 个 `/xyj-api/external/*` 端点、请求签名、信封；`servers.url` 是占位，真实 host 由部署给出 |
| `service.yaml` | 能力服务 | 调用方视角，Bearer Token；**上游失败仍 HTTP 200，按 `success` 判定** |

规则：

- 能力清单的机器真源是 `contract/capabilities.json`；`service.yaml` 是它的 HTTP 投影，
  `contract/verify.py` 会检查每个能力路径都在 `service.yaml` 中出现；
- OpenAPI 文件是**资产**：导入 Apifox / Redoc 只作为视图，不要从 GUI 反向导出覆盖；
- 修改契约后运行 `python contract/verify.py all`，CI 同款门禁。
