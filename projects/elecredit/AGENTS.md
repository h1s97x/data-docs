# AGENTS.md — Elecredit Agent 入口

任何 Agent 进入本仓库后先读本文件。项目品牌为 **Elecredit（元素数智企业风控）**。

## 必读顺序

1. 根 `README.md` — 项目总览和最短上手路径。
2. `plugins/skills/elecredit-skill/SKILL.md` — Agent 路由、签名算法、错误分类。
   **该目录是独立仓库的本地克隆（`plugins/` 整个目录已 gitignore，本仓不内嵌）**；未克隆时跳过，
   改用 `docs/api/elecredit/README.md`（签名黄金样本 + 错误码）+ `docs/signature.md`。
3. 按需加载：Python SDK、Node.js CLI、REST API 契约，或**能力服务对外接入**
   （`mcp/README.md`、`skills/elecredit-service/SKILL.md`、`openapi/service.yaml`）。
   注意区分两条路线：MCP/Skill 面向已部署能力服务（调用方 Token），
   独立 `elecredit-skill` 面向服务商 REST 直连（App ID/Key 签名）。
4. 维护 / 排障：`docs/wiki/README.md` — 架构、逐模块说明、依赖、runbook、问题登记册（`docs/wiki/08` 是待办的事实源）。

## 项目边界

| 子项目 | 路径 | 语言 | 覆盖 |
|--------|------|------|------|
| Node.js CLI | `sdks/typescript/` | TypeScript | 10 端点 + 动态命令注册 + 惰性认证 |
| Python SDK + CLI | `sdks/python/elecredit/` | Python 3.10+ | 10 端点便捷方法 + Typer CLI（10 个子命令；SDK 只用标准库也能跑，CLI 需 `typer`） |
| Agent Skill | `plugins/skills/elecredit-skill/`（本地克隆，不入库） | Markdown | 路由决策 + 签名黄金样本 + 错误分类（独立 skill 仓库，专家仓通过 submodule 引用） |
| REST API 契约 | `openapi/openapi.yaml`（机器真源）· `docs/api/elecredit/*.md`（人读，被契约测试守护） | OpenAPI + Markdown | 10 端点参数/响应字段 |
| Java SDK | `sdks/java/` | Java 17 | 10 端点便捷方法 + 错误契约 + `elecredit-java` CLI（10 子命令） |
| Go SDK | `sdks/go/` | Go 1.22 | 标准库零依赖 + 10 端点方法 + 错误契约 + `elecredit-go` CLI（10 子命令） |
| C SDK | `sdks/c/` | C11 | libcurl + OpenSSL：10 端点方法 + 错误契约 + `elecredit-c` CLI（10 子命令） |
| Rust SDK | `sdks/rust/` | Rust 1.85 | libcurl + serde_json：10 端点方法 + 错误契约 + `elecredit-rs` CLI（10 子命令） |
| C# SDK | `sdks/csharp/` | .NET 8 | 零 NuGet：10 端点方法 + 错误契约 + `elecredit-cs` CLI（10 子命令） |
| **能力服务** | `service/` | Python 3.12 标准库 | 可独立部署的 HTTP 服务：7 能力 + `full` 聚合；对外契约 `openapi/service.yaml`，部署见 `service/README.md`。主仓只发能力名 + 企业名，不接触签名/产品码/凭据 |
| **MCP Server** | `mcp/` | Python 3.12 标准库 | 9 个 MCP tools；两种 transport 共用 `handle_request()`：`server.py` = stdio，`http_server.py` = Streamable HTTP 单端点 `/mcp`（可选容器 `mcp/Dockerfile`）。配置见 `mcp/README.md` |
| **能力服务 Skill** | `skills/elecredit-service/` | Markdown + 标准库脚本 | 面向已部署服务的 Agent Skill：先 `normalize` 补全全称再查询、错误分类、大结果落盘。与 `plugins/skills/elecredit-skill`（直连服务商、需 App Key 签名）**定位不同，不要混用** |

**代码准入门槛**：**不进 CI 的代码不入库**。示例 / 演示工程只有两种形态 —— 进 CI（`typecheck` / `build` /
冒烟），或者放独立仓库（本仓只留链接）。接口测试与 Mock 一律走 Apifox + `openapi/openapi.yaml`，
仓库内不养第二个「接口测试载体」，避免与契约真源形成双信源。

## 凭据

**不同于单一 API Key**，Elecredit 需要 **App ID + App Key 二元组**。

探测顺序（只报告来源，不显示值）：

1. 环境变量：`ELECREDIT_APP_ID` + `ELECREDIT_APP_KEY`（两者同时存在）。
2. Python 额外支持 `./.env` 与 `~/.elecredit/.env`（需 `python-dotenv`）。
3. Node.js CLI 额外支持系统钥匙环：`elecredit-ts auth login --app-id <App ID> --app-key <App Key>`，`auth status` / `auth logout`。

安全纪律：
- 不得把 Key 复述给用户、写入命令参数、日志、代码、公开配置或 Git 提交。
- 用户主动提供时接受，不复述。
- 获取地址：[https://api.elecredit.com/admin]

## 签名（生产环境已验证）

```python
sn        = uuid.uuid4().hex
ts        = str(int(time.time() * 1000))
body      = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
signStr   = sn + ts + body + appKey
signature = hashlib.md5(signStr.encode("utf-8")).hexdigest()
# 签名放 HTTP Header，不是 body
```

黄金样本：`body={"entName":"贵州茅台"}` → 生产返回 SYS005 → **签名正确**。

## 关键端点差异

| 端点 | 路径 | 特殊 |
|------|------|------|
| F09 graph | `/saic/equityPenetration` | 60s 超时，递归树结构，大结果必须落盘 `--output` |
| D11 judicial | `/risk/sifaInfo/wh` | `entityName` 聚合；`type` 单值（12 种前缀），`range` ≤ 20 |
| A03 deep | `/saic/enterprise/deep/wh` | 4 个标识字段至少填一个 |

## 错误分类

| code | 分类 | 处理 |
|------|------|------|
| 000 / 001 | 业务 | 成功（001 = 查无结果，**同样计费**），正常取 `resultData` |
| SYS001（签名错）/SYS002（过期）/SYS003（应用不存在）/SYS004（算法不支持）/SYS006（IP 受限） | 认证 | 重查凭据和签名，不重试 |
| **SYS005** | **业务** | **签名已通过，提示充值**，**不要重试** |
| SYS007（流水号重复） | 上游 | 换新 `request-sn` 重试一次 |
| SYS008 | 限流 | 降速后退避重试 |
| SYS009（请求体过大） | 参数 | 缩小请求体（如降低 F09 的 `--level`） |
| SYS044 | 上游 | **资源不存在**（多为路径大小写错），核对路径，**不要重试** |
| 400 | 参数 | 修正字段 |
| 999 | 上游 | 有界退避 |
| 4xx | 参数 | 修正字段 |
| 5xx/NETWORK | 上游 | 有界退避 |

退出码（**Node 与 Python 两套 CLI 一致**）：`1` internal / `2` validation /
`3` authentication·billing / `4` upstream·rate_limit（`5`/`6` 保留未用）。
失败信封 `{"ok":false,"error":{code,category,message,hint?,retryable}}`，
其中 `category` ∈ `validation` / `authentication` / `billing` / `rate_limit` / `upstream` / `internal`。
**重试与否以 `retryable` 为准** —— 同为 `upstream`，`SYS044` 不可重试、`999` 可重试。
唯一真源：`sdks/typescript/src/infrastructure/elecredit/envelope.ts:ERROR_CONTRACT` 与
`sdks/python/elecredit/envelope.py:ERROR_CONTRACT`（由 `sdks/typescript/tests/error-contract-consistency.test.ts` 双向校验）。

## 大数据纪律

禁止把全量原始结果输出到对话。大结果（graph 深层穿透、分页全集）必须落盘，只报告路径、行数和摘要。

## 执行验证

```bash
# Python SDK 冒烟（核心零依赖）
export ELECREDIT_APP_ID=... ELECREDIT_APP_KEY=...
cd sdks/python
python3 -c "from elecredit import ElecreditClient; print(ElecreditClient.from_env().fuzzy(ent_name='贵州茅台'))"
elecredit-py capabilities               # CLI：列出 10 个端点元数据（需 typer）
elecredit-py fuzzy --ent-name 贵州茅台
python -m elecredit.signature        # 签名自测试（exit 0 = 通过）
python3 -m pytest tests/ -q          # 单元测试
python -m unittest discover -s service/tests -v   # 能力服务单测（零依赖）
docker build -f service/Dockerfile -t elecredit-service .   # 服务镜像（上下文=仓库根）
# Node CLI
cd sdks/typescript && npm ci && npm run verify
node dist/cli/main.js auth status    # 凭据来源检查（不需要真实凭据）
node dist/cli/main.js capabilities

# CI（在 CNB 跑，GitHub Actions 侧已无 CI）
#   push main / PR → 增量（ifModify 命中才跑）；每周一 09:00 全量（Python 3.10+3.12、Node 22+24、arm64）
.cnb.yml      # ci-python-sdk / ci-typescript-cli / ci-openapi-contract 三条 pipeline
```
