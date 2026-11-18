# Elecredit — 企业风控数据

企业风控统一入口，覆盖 **10 个 REST 端点**：工商模糊/深度查询、大中小微划型、税务信用、行政处罚、
司法（12 种 type）、限消人员、企业股权图谱、招投标、实控人。

- **网关**：`https://api.elecredit.com`（POST + JSON body）
- **认证**：HTTP Header 签名 `MD5(sn + ts + body + appKey)`，凭据 App ID + App Key 从 [https://api.elecredit.com/admin] 获取
- **架构**：契约驱动 + 代码生成（`contract/sdk.json` → `tools/gen_code.py` → 7 语言产物），CI `--check` 门禁

> **要调用已部署的「elecredit 能力服务」**（只需一个调用方 Token）请看
> [`docs/INTEGRATION.md`](docs/INTEGRATION.md)：服务地址、Token 申请、Apifox 导入、
> 免写码接入路径与上线检查。
>
> 本页与 `sdks/` 讲的是**直连上游 `api.elecredit.com`**（App ID / App Key + MD5 签名），
> 面向数据商直连场景，**不适用于能力服务的接入方**；不要向接入方索要 App Key。

## 诚实口径

| 能力 | 状态 | 说明 |
|---|---|---|
| 10 端点 + 签名协议 | ✅ 可用 | 签名 MD5(sn+ts+body+appKey)，Header 传输；真实响应验证 |
| 契约驱动生成 | ✅ 可用 | `contract/sdk.json` → 7 语言端点/错误/司法枚举产物；CI `--check` 门禁 |
| 错误契约（19 条） | ✅ 可用 | category / exitCode(1-4) / retryable 三元组，跨语言一致 |
| 能力服务 / MCP / Skill | ✅ 可用 | 独立 HTTP 服务 + AI 接入层；凭据只在服务端 |
| 历史两步验证 | ⚠️ 已知 | 旧库曾发布不可用版本（`0.0.1`/`0.0.2`），可用版本从 `0.0.3` 起；详见 [`docs/publishing.md`](docs/publishing.md) |

## 快速开始

```bash
# 1. 配置凭据
export ELECREDIT_APP_ID=<你的 App ID>
export ELECREDIT_APP_KEY=<你的 App Key>

# 2a. Python SDK（requests 缺失时自动回退标准库 urllib）
cd sdks/python
python3 -c "
  from elecredit import ElecreditClient
  c = ElecreditClient.from_env()
  print(c.fuzzy(ent_name='贵州茅台'))
"

# 2b. Python CLI
elecredit-py fuzzy --ent-name 贵州茅台

# 2c. Node.js CLI
cd sdks/typescript && npm install && npm run build
node dist/cli/main.js enterprise fuzzy --ent-name 贵州茅台

# 2d. REST 直接调（任何语言）
curl -X POST https://api.elecredit.com/mohu/wh \
  -H 'Content-Type: application/json' -H 'app-id: [appId]' \
  -H 'timestamp: [ts_ms]' -H 'request-sn: [sn]' \
  -H 'signature: [md5_hex]' -H 'sign-type: MD5' -d '{"entName":"贵州茅台"}'
```

## 10 端点速查

| 命令 | 方法 | 路径 | 说明 |
|------|------|------|------|
| `enterprise fuzzy` | `POST` | `/mohu/wh` | 工商模糊查询 |
| `enterprise deep` | `POST` | `/saic/enterprise/deep/wh` | 工商深度查询（4 选 1） |
| `enterprise scale` | `POST` | `/enterprise/companyLevel/wh` | 大中小微划型 |
| `enterprise tax-credit` | `POST` | `/enterprise/taxInfo` | 税务信用/欠税/处罚/非正常户 |
| `enterprise admin-punishment` | `POST` | `/enterprise/adminPunishment` | 行政处罚 |
| `risk judicial-fuzzy` | `POST` | `/risk/sifaInfo/wh` | 司法查询（`entityName` + 单值 `type`，range ≤ 20） |
| `litigation xgbzxr` | `POST` | `/litigation/xgbzxrPeople/wh` | 限消人员 |
| `enterprise graph` | `POST` | `/saic/equityPenetration` | 企业股权图谱（60s 超时） |
| `enterprise bidding` | `POST` | `/enterprise/biddingYPageWh` | 招投标信息（参数名必须是 `entInfo`） |
| `enterprise actual-controller` | `POST` | `/saic/SaicinvWh` | 实控人（法人/股东穿透；路径小写 w） |

## 多语言 SDK

| 语言 | 目录 | 说明 |
|---|---|---|
| Python | [`sdks/python/`](sdks/python/README.md) | `elecredit`，核心零第三方依赖 + CLI |
| TypeScript | [`sdks/typescript/`](sdks/typescript/README.md) | `@h1s97x/elecredit` CLI + 可嵌入库 |
| Java / Go / C# | `sdks/java/`、`sdks/go/`、`sdks/csharp/` | 各自 Maven / 标准库 / 零 NuGet |
| Rust / C | `sdks/rust/`、`sdks/c/` | Rust 按需引入依赖；C 走系统库 |

## 仓库结构

```
.
├── contract/
│   ├── sdk.json             10 端点 / 19 错误 / 12 司法 type 唯一真源
│   ├── vectors.json         跨语言行为向量
│   └── capabilities.json    能力注册表
├── tools/gen_code.py        生成 11 份产物（--check 门禁）
├── sdks/                    7 种语言 SDK + CLI（无 C++）
├── service/ mcp/ skills/    能力服务 / AI 接入 / Agent Skill
├── openapi/                 上游协议 / 能力服务契约
├── docs/                    API 契约、签名、排障、发布、工程 wiki
└── .cnb.yml                 CI + 发布 + GitHub 同步
```

## 文档入口

| 目标 | 文档 |
|---|---|
| 在线文档站 | [Data Docs](https://h1s97x.github.io/data-docs/)（三项目统一站；各主仓 `docs/` 为事实源） |
| REST API 契约（10 端点） | [`docs/api/elecredit/README.md`](docs/api/elecredit/README.md) |
| 架构：契约驱动 + 代码生成 | [`docs/architecture.md`](docs/architecture.md) |
| 契约驱动生成 | [`contract/sdk.json`](contract/sdk.json) · [`tools/gen_code.py`](tools/gen_code.py) |
| 签名算法 / 错误码 | [`docs/signature.md`](docs/signature.md) · [错误码](#错误码) |
| 排障 | [`docs/troubleshooting.md`](docs/troubleshooting.md) |
| 发版与 tag 约定 | [`docs/publishing.md`](docs/publishing.md) |
| 工程 wiki | [`docs/wiki/README.md`](docs/wiki/README.md) |
| 能力服务 / MCP / Skill | [`service/README.md`](service/README.md) · [`mcp/README.md`](mcp/README.md) · [`skills/elecredit-service/SKILL.md`](skills/elecredit-service/SKILL.md) |

## 开发

```bash
python tools/gen_code.py --check                       # 生成物必须与契约一致（CI 也跑）
(cd sdks/python && python -m ruff check elecredit/ tests/ && python -m pytest tests/ -q)
(cd sdks/typescript && npm ci && npm run build && npm test -- --run)
```

## 发布

双包 monorepo：`cli-v<version>` 发 TS CLI（CNB npm `h1s97x/npm` + npmjs.org），
`sdk-v<version>` 发 Python SDK（CNB PyPI `h1s97x/pypi` + pypi.org）。详见 [`docs/publishing.md`](docs/publishing.md)。

```bash
git tag cli-v0.1.3 && git push origin cli-v0.1.3   # TS CLI
git tag sdk-v0.1.2 && git push origin sdk-v0.1.2   # Python SDK
```

## 安全

- App ID / App Key 只经环境变量注入，绝不进代码或 Git；能力服务接入方只需调用方 Token；
- 机器时钟需同步（`SYS002`），出口 IP 变化需服务商加白（`SYS006`）；
- `SYS005 余额不足` 是**正确业务响应**（签名有效、凭据有效、API 可达），充值后即可继续。

## License

MIT
