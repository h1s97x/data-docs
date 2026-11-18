# xyj-api

`xyj-api` 外部网关（`/xyj-api/external/*`）的**多语言协议 SDK**：`SHA1withRSA` 签名 + 统一信封解析 +
响应验签（只覆盖 `data`）+ 3 端点与通用 `request()`。**8 种语言**统一在 `sdks/` 下，由
[`contract/vectors.json`](contract/vectors.json) 的四组跨语言向量保证行为一致。

## 诚实口径

| 能力 | 状态 | 说明 |
|---|---|---|
| 协议 SDK（签名 / 信封 / 验签 / 3 端点） | ✅ 可用 | 签名有黄金样本回归；验签范围由真实响应实测反推 |
| 响应验签范围 | ⚠️ 样本局限 | 实测 `data` 恒为空数组；非空 `data` 的规范化口径待复核（`xyj verify-probe`） |
| 契约驱动生成 | ✅ 可用 | `contract/sdk.json` → `tools/gen_code.py` → 11 份产物；CI `--check` 门禁 |
| 能力服务 `service/` | ✅ 可用 | Token/ACL/限流/缓存/降级；凭据只在服务端；离线单测覆盖 |
| MCP Server `mcp/` | ✅ 可用 | stdio + Streamable HTTP 双 transport，工具定义从能力注册表派生 |
| Agent Skill `skills/` | ✅ 可用 | 零依赖脚本，凭据只从环境变量读取 |
| 报告轮询 / 落库 / 排序取前 N | ⛔ 不在范围内 | 属于消费方编排，不塞进 SDK |

## 快速开始

### 直连 SDK（Python）

```bash
pip config set global.index-url https://cnb:[你的CNB访问令牌]@pypi.cnb.cool/h1s97x/pypi/-/packages/simple
pip install xyj-api
```

```python
from xyj_api import XyjClient, is_success
from xyj_api.envelope import extract_data

client = XyjClient.from_env()  # XYJ_BASE_URL / XYJ_ORG_CODE / XYJ_ORG_NAME / XYJ_PRIVATE_KEY
env = client.query_general_data("某企业", "91330000TEST0000XX", data_key="220_xxx")
if is_success(env):
    parsed = XyjClient.parse_upstream_downstream(extract_data(env) or [])
```

### 能力服务（推荐给业务系统 / AI）

调用方只持 Token，网关私钥不出服务端：

```bash
cp .env.example .env
python -m service.issue_token issue --caller app-a --scopes '*' --days 30
python -m service           # 默认 127.0.0.1:8804
curl -X POST http://127.0.0.1:8804/v1/query/upstream \
  -H 'Authorization: Bearer [TOKEN]' -H 'Content-Type: application/json' \
  -d '{"company_name":"某企业","nsrsbh":"9133...","data_key":"220_xxx"}'
```

## 多语言 SDK

| 语言 | 目录 | 说明 |
|---|---|---|
| Python | [`sdks/python/`](sdks/python/README.md) | `pip install xyj-api`；发布名 xyj-api，import 名 xyj_api |
| TypeScript | [`sdks/typescript/`](sdks/typescript/README.md) | `@h1s97x/xyj-api`，零运行时依赖 |
| Java / Go / C# | `sdks/java/`、`sdks/go/`、`sdks/csharp/` | 各自 Maven / 标准库 / 零 NuGet |
| Rust / C / C++ | `sdks/rust/`、`sdks/c/`、`sdks/cpp/` | Rust/C 按需引入 crypto 依赖；C++ 复用 C 库 |

完整矩阵见 [`sdks/README.md`](sdks/README.md)。

## 仓库结构

```
.
├── contract/
│   ├── sdk.json             SDK 机器可读契约（端点/模型/错误）唯一真源
│   ├── capabilities.json    能力注册表（service/MCP/Skill 唯一真源）
│   ├── vectors.json         跨语言签名/验签/信封四组向量
│   └── generated.json       生成物 sha256 manifest
├── tools/gen_code.py        从 contract/sdk.json 生成 11 份产物（--check 门禁）
├── sdks/                    8 种语言 SDK（python / typescript / java / go / csharp / rust / c / cpp）
├── service/                 能力服务（默认 127.0.0.1:8804）
├── mcp/                     MCP stdio + Streamable HTTP（默认 8805）
├── skills/xyj-service/      Agent Skill
├── openapi/                 上游协议 / 能力服务两份契约
├── docs/                    协议、集成、发布、工程 wiki
└── .cnb.yml                 CI：契约门禁 + SDK 测试 + 接入层测试 + 发布
```

## 文档入口

| 目标 | 文档 |
|---|---|
| 协议契约（签名 / 信封 / 端点 / 错误语义） | [`docs/protocol.md`](docs/protocol.md) |
| 调用方接入指南 | [`docs/INTEGRATION.md`](docs/INTEGRATION.md) |
| 架构：契约驱动 + 代码生成 | [`docs/architecture.md`](docs/architecture.md) |
| 发版与 tag 约定 | [`docs/publishing.md`](docs/publishing.md) |
| 工程 wiki（架构 / runbook / 问题登记册） | [`docs/wiki/README.md`](docs/wiki/README.md) |
| 多语言 SDK 矩阵 | [`sdks/README.md`](sdks/README.md) |
| 能力服务 / MCP / Skill | [`service/README.md`](service/README.md) · [`mcp/README.md`](mcp/README.md) · [`skills/xyj-service/SKILL.md`](skills/xyj-service/SKILL.md) |

## 开发

```bash
python -m pip install -e "./sdks/python[dev]"
(cd sdks/python && python -m ruff check xyj_api/ tests/ && python -m pytest tests/ -q)
python tools/gen_code.py --check       # 生成物必须与契约一致（CI 也跑）
python contract/verify.py all
python -m unittest discover -s service/tests -q
python -m unittest discover -s mcp/tests -q
python -m unittest discover -s skills/xyj-service/tests -q
```

## 发布

双包 monorepo：`cli-v<version>` 发 TS SDK（CNB npm `h1s97x/npm` + npmjs.org），
`sdk-v<version>` 发 Python SDK（CNB PyPI `h1s97x/pypi` + pypi.org）。详见 [`docs/publishing.md`](docs/publishing.md)。

```bash
git tag cli-v0.1.0 && git push origin cli-v0.1.0   # TS SDK
git tag sdk-v0.0.5 && git push origin sdk-v0.0.5   # Python SDK
```

## 安全

- 私钥 / Token 只经环境变量 / `.env` 注入，**绝不**进代码或 Git；仓库带 gitleaks 门禁；
- 服务与 MCP 在非回环监听且未配置 Token 时拒绝启动；Token 注册表只存 SHA-256；
- `sdks/python/tests/_fixtures.py` 的 `TEST_PRIVATE_KEY` 是测试夹具（not-a-secret），仅用于确定性签名断言。
