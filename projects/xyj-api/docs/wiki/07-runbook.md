# 07 Runbook

## 安装与测试

```bash
cd /workspace
python -m pip install -e "./sdks/python[dev]"

(cd sdks/python && python -m ruff check xyj_api/ tests/ && python -m pytest tests/ -q)
python -m unittest discover -s service/tests -v
python -m unittest discover -s mcp/tests -v
python -m unittest discover -s skills/xyj-service/tests -v
python contract/verify.py all
(cd sdks/python && python -m xyj_api capabilities)
python -m service.issue_token --help
```

## 启动能力服务

```bash
# 1. 配 .env：XYJ_BASE_URL / XYJ_ORG_CODE / XYJ_ORG_NAME / XYJ_PRIVATE_KEY
#    （可选 XYJ_PUBLIC_KEY 开启响应验签）
# 2. 签 Token
python -m service.issue_token issue --caller dev --scopes '*' --days 7
# 3. 起服务（本地回环）
python -m service
# 或 Docker：docker compose -f service/compose.yml --env-file .env up -d --build
```

## 起 MCP

```bash
python -m mcp                          # stdio
python -m mcp --http                   # Streamable HTTP，默认 127.0.0.1:8805
# Docker：docker compose -f mcp/compose.yml up -d --build
```

## 加一个新能力

1. 在 `contract/capabilities.json` 加一条（id / method / path / handler / scope / mcpTool / mcpInputSchema / skillCommand）；
2. 在 `service/capabilities.py` 的 `_dispatch` 加一个分支与 `_REQUIRED` 参数校验；
3. 跑 `python contract/verify.py all`——OpenAPI / MCP tool / Skill 覆盖检查会提示漏改；
4. 在 `service/tests/test_service.py` 加 FakeClient 用例（不联网）。

## 排障

| 现象 | 排查 |
|---|---|
| 服务起不来，日志「拒绝启动」 | 非回环监听未配 Token；补 `SERVICE_TOKENS_FILE` 或 `SERVICE_AUTH_TOKEN` |
| 401 | Token 无效/被吊销；重新签发 |
| 403 | scope 不足或 IP 不在白名单；检查 `SERVICE_ALLOWED_CIDRS` |
| `category=configuration` | 服务端缺 `XYJ_*`；补 `.env` 后重启 |
| `category=contract` | 验签失败/信封不符；核对 `XYJ_PUBLIC_KEY` 是否配对 |
| `SYS` 4xx / 验签口径不符 | `xyj doctor` / `xyj verify-probe`（见 `sdks/python/README.md`） |
| 结果被压缩 | 带 `_compacted`，用 Skill `--output` 取完整 JSON |

## 集成测试（可选）

`sdks/python/tests/test_client_integration.py` 带 `integration` marker，默认不跑；需要真实凭据时显式启用。
`SYS005`-类「签名已到达上游」的响应应视为链路通畅，而不是失败。
