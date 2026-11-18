# 01 概览

## 定位

`xyj-api` 仓库有两层：

1. **协议 SDK**（`sdks/python/xyj_api/`）：对上游 `/xyj-api/external/*` 的封装——`SHA1withRSA` 请求签名、
   统一信封解析、响应验签（只覆盖 `data`）、3 端点与通用 `request()`。只做协议，不做编排。
2. **接入层**（本轮参考 altdatahub / elecredit 新增）：围绕 SDK 的三层薄封装——
   `service/`（能力服务，凭据隔离）、`mcp/`（AI 接入，两种 transport）、`skills/`（Agent Skill）。

## 能力矩阵

| 能力 | SDK 方法 | 服务路径 | MCP tool | 需要网关凭据 |
|---|---|---|---|---|
| 能力清单 | — | `GET /v1/capabilities` | `xyj_capabilities` | 否 |
| 上下游查询 | `query_general_data` | `POST /v1/query/upstream` | `xyj_upstream` | 是 |
| 报告申请 | `apply_report` | `POST /v1/query/report-apply` | `xyj_report_apply` | 是 |
| 报告查询 | `query_report` | `POST /v1/query/report-query` | `xyj_report_query` | 是 |
| 健康检查 | — | `GET /v1/ping` | `xyj_ping` | 否 |

机器真源是 `contract/capabilities.json`；上表是派生的人读视图。

## 仓库地图

```
contract/capabilities.json   能力/路由/MCP/Skill 唯一真源 + 一致性门禁 (verify.py)
sdks/python/xyj_api/                 协议 SDK（签名/信封/验签/客户端/CLI）
service/                     能力服务（Token/ACL/限流/缓存/降级）默认 127.0.0.1:8804
mcp/                         MCP stdio + Streamable HTTP 默认 8805
skills/xyj-service/          Agent Skill（SKILL.md + 零依赖 query.py）
openapi/                     两份契约：上游协议 / 能力服务
docs/                        协议、集成、发布、工程 wiki
```

## 全局约束

- **凭据只在服务端**：`XYJ_PRIVATE_KEY` / `XYJ_PUBLIC_KEY` 不进调用方、不进 CLI 参数、不进日志；
- **业务失败不抛异常**：SDK 返回信封；服务返回 `success=false`（仍 HTTP 200）；
- **诚实口径**：空数据不是故障；验签只覆盖 `data` 不能替代 TLS；
- **零依赖边界**：接入层只用标准库；SDK 运行时只 `requests` + `cryptography`（CLI 零额外依赖）；
- **单一真源**：能力注册表驱动服务路由、MCP tool、Skill 命令与文档，改一处、全链路一致。
