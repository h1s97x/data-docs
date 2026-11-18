# 接入方快速开始：elecredit 能力服务

面向「要调用**已部署**能力服务」的团队或项目。你只需要一个**调用方 Token**：
不需要 `ELECREDIT_APP_ID` / `ELECREDIT_APP_KEY`，不需要实现 MD5 签名，
服务商端点、产品码、参数名与凭据全部留在服务侧。

> ⚠️ **不要拿 `sdks/` 下的 Python / Go / C / Java SDK 来对接本服务。**
> 那些 SDK 直连上游 `api.elecredit.com`（10 个原生端点），需要 App ID/Key 并自行签名。
> 把它们交给接入方，等于把服务商凭据散出去，并绕过本服务的鉴权、脱敏与审计。
> `skills/elecredit-service/SKILL.md` 也明确写了「不要混用，不要向用户索要 App Key」。

## 1. 先拿到三样东西

| 项 | 来源 | 说明 |
|---|---|---|
| 服务地址 | 运维提供 | 形如 `http://[HOST]:8081`；写进环境变量，不要硬编码 |
| 调用方 Token | 服务侧签发（见下） | 每个调用方独立，注册表只存哈希，明文只出现一次 |
| 契约 | [`openapi/service.yaml`](../openapi/service.yaml) | OpenAPI 3.1，Apifox 可直接导入 |

Token 由服务维护方在**能力服务仓库**里签发：

```bash
# scopes 按最小权限给；--quiet 只输出明文，立即交给调用方
python service/issue_token.py --caller team-xxx \
  --scopes normalize,basic --expires 2026-12-31 --quiet

python service/issue_token.py --list              # 只列哈希前缀
python service/issue_token.py --revoke team-xxx   # 单独吊销
```

调用方把 Token 存进自己的环境变量 `ELECREDIT_SERVICE_TOKEN`，
**不要写进代码、Git、聊天记录或日志**。

## 2. 三条接入路径（都不用手写 HTTP 请求）

### A. 人调试 / 联调：Apifox

1. 项目设置 → 导入数据 → OpenAPI/Swagger，选 `openapi/service.yaml`。
2. 「环境管理」里把 server 的 `host` / `port` 填成运维提供的地址
   （契约里第二条 server 用了变量，避免把地址写死进仓库）。
3. 配置全局认证 `bearerAuth`，值填调用方 Token。
4. 直接选能力、填 `company_name`、发送。契约按 `健康检查` / `征信能力` 两组分类。

> 契约是唯一真源，请在 Apifox 里「导入 / 同步」，不要在 Apifox 中改完再导出。

### B. 命令行 / 临时脚本

仓库自带零依赖脚本，凭据只从环境变量读（不进命令行参数与进程列表）：

```bash
export ELECREDIT_SERVICE_URL=http://[HOST]:8081
export ELECREDIT_SERVICE_TOKEN=<你的 Token>

python skills/elecredit-service/scripts/query.py \
  --capability basic --company-name 威海银行股份有限公司

python skills/elecredit-service/scripts/query.py \
  --capability shareholding --company-name 威海银行股份有限公司 \
  --set level=3 --set ratio=5
```

能力名、可选参数与字段坑见
[`skills/elecredit-service/references/capabilities.md`](../skills/elecredit-service/references/capabilities.md)。

### C. 项目集成

- **Python**：复制主仓（DueAgent）的 `src/tools/query_client/entcredit_client.py`
  （约 130 行、纯标准库、自带 TTL 缓存与失败信封处理），或按契约用
  `openapi-generator` / `openapi-typescript` 生成任意语言客户端。
  建议长期抽成一个内部 `elecredit-client` 包，避免各项目复制代码。
- **AI Agent / MCP 客户端**：起本仓 `mcp/` 的 Streamable HTTP 网关
  （单端点 `POST /mcp`，9 个 tools，入站 `MCP_AUTH_TOKEN`），
  客户端只需 URL + Token，完全不用写请求代码。详见 [`mcp/README.md`](../mcp/README.md)。

## 3. 接口速查

统一请求体 `{"company_name": "企业全称"}`；`tax` 可加 `tax_type`，
`shareholding` 可加 `level` / `ratio`。

| 能力 | 路径 | 说明 |
|---|---|---|
| 健康检查 | `GET /v1/ping`、`GET /healthz` | 不触达上游、不需要 Token |
| 名称标准化 | `POST /v1/normalize` | `data: {normalized, is_likely_full, original, verified}` |
| 工商基本信息 | `POST /v1/query/basic` | `data.company_profile`（注册资本带单位等） |
| 大中小微划型 | `POST /v1/query/scale` | |
| 司法风险 | `POST /v1/query/risk` | |
| 行政处罚 | `POST /v1/query/admin_punishment` | |
| 税务信用 | `POST /v1/query/tax` | 可带 `tax_type` |
| 股权穿透 | `POST /v1/query/shareholding` | 可带 `level` / `ratio` |
| 聚合查询 | `POST /v1/query/full` | 另有 `partial` / `modules` / `errors` / `warning` |

字段细节见 [`service/README.md`](../service/README.md)，
按现象排障见 [`docs/troubleshooting.md`](troubleshooting.md)。

## 4. 响应与错误语义

- 成功：`{"success": true, "data": {...}}`
- 失败：`{"success": false, "error": "..."}`，SDK 错误可能带
  `code` / `category` / `retryable` / `hint`
- **`001` 查无结果 → `success: true, data: {}`**：这是正常结果，不是故障，别误告警
- **`SYS005` 余额不足**：`degrade_reason=数据接口套餐余额不足`，
  不可重试；下游报告必须如实标注缺失，不能编造
- `401` Token 缺失/错误，`429` 触发按能力限流
- **上游失败也返回 HTTP 200**，必须按响应体 `success` 判定；
  `/v1/ping` 返回 200 只说明进程活着，不代表上游凭据已配置

## 5. 上线前必查

- **来源 IP 白名单 `SERVICE_ALLOWED_CIDRS`**：默认只放行
  `<INTERNAL_IP>/12`、`<INTERNAL_IP>/8`、`<INTERNAL_IP>/16`、`127.0.0.1/32`。
  调用方网段不在其中会被拒，需让运维把网段加入白名单，或在前面挂反向代理做 mTLS。
- **限流 `SERVICE_RATE_LIMIT_PER_MIN`**（默认 120，按能力 60 秒滑动窗口）。
- **最小权限**：Token 的 `scopes` 只给需要的能力，设 `expires`；泄露时用 `--revoke` 单独吊销。
- **自检**：`python service/check_deploy.py --url http://[HOST]:8081`
  （Token 从环境变量读，不打印）。鉴权链路应为「无 Token 401 / 有 Token 200」。

## 6. 契约维护

- `openapi/service.yaml` 是**能力级**契约唯一真源；
  `openapi/openapi.yaml` 是**上游 10 端点**契约，二者不要混用。
- 改动后 CI 会跑 Spectral：`npx -y @stoplight/spectral-cli@6 lint openapi/service.yaml`，
  本地等价命令相同；判据为 0 errors。
- Apifox / Redoc / Scalar / Prism 都只是这份契约的视图。
