# Elecredit MCP Server

把已部署的 [elecredit 能力服务](../service/README.md) 包装成
[Model Context Protocol](https://modelcontextprotocol.io) 工具，让支持 MCP 的
AI 客户端（Claude Desktop、CodeBuddy、Cursor、Cline 等）直接查询企业征信数据。

**纯标准库、零 pip install**，提供两种 transport，共用同一套 9 个 tools 与同一个
`handle_request()`：

| transport | 入口 | 适用 |
|---|---|---|
| `stdio` | `python -m mcp` | AI 客户端与代码在**同一台机器**（本机插件） |
| **Streamable HTTP** | `python -m mcp.http_server` → 单端点 `POST /mcp` | **远程** AI 客户端、多个 Agent、容器化部署 |

stdio 是「客户端 spawn 一个本地子进程、stdin/stdout 一行一个 JSON」；
Streamable HTTP 是「常驻服务 + 一个 URL」，客户端只要能访问那个 URL。
下面 §1 是 stdio，§2 是 HTTP。

## 它解决什么

已有的 `elecredit-skill` 是**直连服务商 REST API** 的：AI 侧要持 `ELECREDIT_APP_ID`
+ `ELECREDIT_APP_KEY` 自己算 MD5 签名。这里不一样：

| | 直连 Skill | 本 MCP server |
|---|---|---|
| AI 侧持有 | App ID + App Key（可直连服务商、可刷额度） | 一个**调用方 Token** |
| 签名 / 产品码 / 端点 | AI 侧脚本 | 能力服务内部 |
| 权限控制 | 无 | 服务侧 `scopes` / 过期 / 吊销 |
| 审计 | 无 | 服务侧 `caller=` 日志 |
| 出网 | AI 客户端直连公网 | 只连能力服务地址 |

## 暴露的工具

| 工具 | 对应能力 | 入参 |
|---|---|---|
| `elecredit_normalize` | 简称 → 工商全称 | `company_name` |
| `elecredit_query_basic` | 工商基本信息 | `company_name` |
| `elecredit_query_scale` | 大中小微划型 | `company_name` |
| `elecredit_query_risk` | 司法风险 | `company_name` |
| `elecredit_query_admin_punishment` | 行政处罚 | `company_name` |
| `elecredit_query_tax` | 税务信用 | `company_name`, 可选 `tax_type` |
| `elecredit_query_shareholding` | 股权穿透 | `company_name`, 可选 `level` / `ratio` |
| `elecredit_query_full` | 四模块聚合 | `company_name` |
| `elecredit_health` | 健康检查（不鉴权） | 无 |

## 1. stdio transport（本机）

先给 AI 客户端**单独签一个只读 Token**（不要复用 backend 的 `*` Token）：

```bash
cd /path/to/elecredit
python service/issue_token.py \
  --caller mcp-assistant --scopes normalize,basic,risk,full --quiet
# 明文只输出一次，填进下面配置的 env
```

MCP 客户端配置（以 `mcpServers` 为例）：

```json
{
  "mcpServers": {
    "elecredit": {
      "command": "python3",
      "args": ["-m", "mcp"],
      "cwd": "/path/to/elecredit",
      "env": {
        "ELECREDIT_SERVICE_URL": "http://127.0.0.1:8800",
        "ELECREDIT_SERVICE_TOKEN": "<上一步签出的调用方 Token>"
      }
    }
  }
}
```

> 生产形态的 `service/compose.internal.yml` **不发布端口**，只有同一 compose
> 网络内的 backend 能访问。AI 客户端在宿主机上时，三选一：
> - 开发/本机：用 `service/compose.yml`（只绑 `127.0.0.1:8800`）
> - 远程接入：起下面 §2 的 MCP HTTP 网关（它自己在该网络内，客户端走 8801）
> - 生产：前置带 mTLS / IP 白名单的反向代理，把 `ELECREDIT_SERVICE_URL` 指向它

## 2. Streamable HTTP transport（远程 / 容器）

新增 `mcp/http_server.py` + `mcp/Dockerfile` + `mcp/compose.yml`。常驻容器暴露
`POST /mcp`（单端点、无状态），远程 AI 客户端只需 URL + Token，不必在本机
安装 Python 或拉仓库。工具清单与 `handle_request()` 与 stdio 版完全共用。

**双 Token，权限不放大**：

| 方向 | 变量 | 作用 |
|---|---|---|
| 入站 | `MCP_AUTH_TOKEN` | 谁能连 MCP 网关（远程客户端持有） |
| 出站 | `MCP_ENTCREDIT_TOKEN` | 网关代客户端调能力服务；**独立只读 scope**，不复用 backend-prod 的 `scope=*`，避免远程客户端继承全部权限 |

`WITH_MCP=1 ./scripts/deploy.sh` 会自动完成两件事：生成强随机入站 Token，
并用 `service/issue_token.py --caller mcp-gateway --scopes <明确能力列表>` 签发
独立的出站 Token，两者都回填主仓 `.env`，明文不回显。能力服务审计里会显示
`caller=mcp-gateway`，与 backend 区分。

```bash
cd /workspace
WITH_MCP=1 ./scripts/deploy.sh
./scripts/deploy.sh status    # 多一项 mcp /healthz
```

手动部署时自己签一次（明文只输出一次，写入主仓 `.env` 的 `MCP_ENTCREDIT_TOKEN`）：

```bash
cd /path/to/elecredit
python service/issue_token.py --caller mcp-gateway \
  --scopes normalize,basic,scale,risk,admin_punishment,tax,shareholding,full --quiet
```

手动起：

```bash
cd /path/to/elecredit
DUEAGENT_NETWORK=workspace_default \
  docker compose -f mcp/compose.yml --env-file /workspace/.env up -d --build
```

客户端配置（支持远程 MCP 的客户端）：

```json
{
  "mcpServers": {
    "elecredit": {
      "url": "https://mcp.internal.example/mcp",
      "headers": { "Authorization": "Bearer [MCP_AUTH_TOKEN]" }
    }
  }
}
```

curl 冒烟：

```bash
TOKEN=$(grep '^MCP_AUTH_TOKEN=' /workspace/.env | cut -d= -f2-)
curl -s http://127.0.0.1:8801/healthz
curl -s -X POST http://127.0.0.1:8801/mcp \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**协议细节**：单端点 `POST /mcp`；`notifications/*` 返回 `202 Accepted` 空体；
支持 JSON-RPC 批处理数组；`GET /mcp` 返回 405（无状态实现不提供服务端推送流）；
`GET /healthz` 不鉴权。

**安全默认值**：端口只绑 `127.0.0.1:8801`；`MCP_AUTH_TOKEN` 为空且非回环监听时
**拒绝启动**；可配 `MCP_ALLOWED_CIDRS`（IP 白名单，配错 fail closed）与
`MCP_RATE_LIMIT_PER_MIN`。跨主机远程访问**不要直接改成 `0.0.0.0`**，
应前置带 TLS/mTLS 的反向代理——多开一个对外端口就是多一个攻击面。

## 环境变量

| 变量 | 默认 | 适用 | 说明 |
|---|---|---|---|
| `ELECREDIT_SERVICE_URL` | `http://127.0.0.1:8800` | 两者 | 能力服务地址；容器内用服务名 |
| `ELECREDIT_SERVICE_TOKEN` | 空 | 两者 | 调用方 Token（**不是** App Key）；HTTP 容器内由主仓 `.env` 的 `MCP_ENTCREDIT_TOKEN` 注入 |
| `MCP_MAX_CHARS` | 40000 | 两者 | 单个 tool 结果上限；超限时返回**结构化摘要**（合法 JSON），不回传半截响应 |
| `MCP_AUTH_TOKEN` | 空 | HTTP | 远程客户端入站 Token；非回环必填 |
| `MCP_HOST` / `MCP_PORT` | `127.0.0.1` / `8801` | HTTP | 监听地址 |
| `MCP_ALLOWED_CIDRS` | 空（compose 给内网默认值） | HTTP | 来源 IP 白名单 |
| `MCP_RATE_LIMIT_PER_MIN` | 0（compose 给 120） | HTTP | 全局每分钟请求上限 |
| `LOG_LEVEL` | WARNING / INFO | 两者 | 日志级别；stdio 版日志只写 stderr |

## stdio 手动冒烟（不装任何 MCP 客户端）

```bash
cd /path/to/elecredit
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"elecredit_health","arguments":{}}}' \
  | python3 -m mcp
```

## 行为约定

- 上游 401/403/429、`SYS005` 等失败转成 `isError: true` 的**文本结果**，
  让模型能读到原因并如实告知用户，而不是静默当空数据
- 结果超过 `MCP_MAX_CHARS` 时返回 `{"_truncated": true, ...}` 结构化摘要，
  仍是合法 JSON；模型应据此改用单能力查询，而不是把半截 JSON 当结论
- `notifications/*`：stdio 不回包，HTTP 返回 `202 Accepted` 空体；
  `resources/list` / `prompts/list` 返回空列表
- stdio 的 `stdout` 只有 JSON-RPC，日志全部走 `stderr`
- HTTP 网关的鉴权失败只记来源 IP / 路径，不记 Token；`/healthz` 不鉴权
- Token 不出现在命令行、日志或工具结果里

## 测试

```bash
python -m unittest discover -s mcp/tests -v      # stdio + Streamable HTTP，25 个用例
```
