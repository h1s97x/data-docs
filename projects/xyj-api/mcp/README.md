# xyj-api MCP Server

让 AI 客户端（CodeBuddy / Claude Desktop / 其它 MCP 客户端）调用 xyj 能力。两种 transport
共享同一个 JSON-RPC 核心，**工具定义来自 `contract/capabilities.json`**，服务层凭据对 AI 完全不可见。

## 工具

由能力注册表派生（共 5 个）：`xyj_capabilities`、`xyj_upstream`、`xyj_report_apply`、
`xyj_report_query`、`xyj_ping`。业务失败作为 `isError: true` 的文本返回，便于模型读取原因。

## 启动

```bash
# stdio（默认）：AI 客户端拉起子进程，走 stdin/stdout；日志只写 stderr
python -m mcp

# Streamable HTTP：单端点 POST /mcp（GET /mcp 返回 405，无状态模式）
python -m mcp --http
# 或 docker compose -f mcp/compose.yml up -d --build
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `XYJ_SERVICE_URL` | 能力服务地址，默认 `http://127.0.0.1:8804` |
| `XYJ_SERVICE_TOKEN` | 出向调用能力服务的 Bearer Token |
| `MCP_MAX_CHARS` | 单工具结果上限，默认 40000（下限 2000），超限返回结构化 `_truncated` |
| `MCP_AUTH_TOKEN` | HTTP 模式入向 Token（非回环监听时必填） |
| `MCP_ALLOWED_CIDRS` / `MCP_RATE_LIMIT_PER_MIN` | HTTP 模式 IP 白名单 / 限流 |

安全守卫与能力服务一致：非回环监听且未配置 `MCP_AUTH_TOKEN` 时 `SystemExit(2)`；
CIDR 非法时拒绝该条规则。stdio 模式的 stdout 是协议通道，任何日志都走 stderr。

## 客户端配置示例（stdio）

```json
{
  "mcpServers": {
    "xyj": {
      "command": "python",
      "args": ["-m", "mcp"],
      "cwd": "/workspace",
      "env": {
        "PYTHONPATH": "/workspace:/workspace/sdk",
        "XYJ_SERVICE_URL": "http://127.0.0.1:8804",
        "XYJ_SERVICE_TOKEN": "<调用方 Token>"
      }
    }
  }
}
```

## 测试

```bash
cd /workspace && python -m unittest discover -s mcp/tests -v
```
