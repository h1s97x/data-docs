# 01 · 项目总览

## 1.1 这是什么

Elecredit 仓库是**企业风控数据服务的多语言接入层（client-side monorepo）**。它不包含服务端实现，而是把同一套上游 REST API 包装成四种可消费形态：

| 形态 | 路径 | 语言 | 面向 |
|------|------|------|------|
| Node.js CLI | `sdks/typescript/` | TypeScript（ESM, NodeNext） | 终端用户、AI Agent、CI 脚本 |
| Python SDK + CLI | `sdks/python/elecredit/` | Python 3.10+ | 数据分析、服务集成 |
| Agent Skill | `plugins/skills/elecredit-skill/` | Markdown | LLM Agent 的路由与执行契约（独立 skill 仓库） |
| REST 契约文档 | `docs/api/elecredit/` | Markdown | 任何语言的自建集成 |

上游网关：`https://api.elecredit.com`，10 个端点，**全部 POST + JSON body**，签名走 HTTP Header。

## 1.2 能力矩阵（10 端点）

| ID | 业务域 | 路径 | 一句话 |
|----|--------|------|--------|
| A07 | 工商 | `/mohu/wh` | 按企业名关键字模糊搜索，支持分页 |
| A03 | 工商 | `/saic/enterprise/deep/wh` | 工商深度详情（年报/股权出质/司法协助/严重违法），4 选 1 标识 |
| A04 | 工商 | `/enterprise/companyLevel/wh` | 大/中/小/微型企业划型 |
| B06 | 税务 | `/enterprise/taxInfo` | 纳税信用等级 / 欠税公告 / 涉税处罚 / 非正常户 |
| D07 | 风险 | `/enterprise/adminPunishment` | 多渠道行政处罚（工商/证监会/食药监/银监/海关…） |
| D11 | 风险 | `/risk/sifaInfo/wh` | 司法查询，按 `entityName` 聚合 + 单值 `type` 过滤 |
| D14 | 诉讼 | `/litigation/xgbzxrPeople/wh` | 限制高消费人员 |
| F09 | 图谱 | `/saic/equityPenetration` | 股权穿透图谱（递归树，**60s 超时**） |

完整参数与响应字段见 [05-endpoints.md](05-endpoints.md) 与 `docs/api/elecredit/` 各端点文档。

## 1.3 真实仓库地图

> 仓库文档曾指向 `python/toolkit/elecredit/`，实际路径为 `sdks/python/elecredit/`（已修正）。

```
/workspace
├── AGENTS.md                        Agent 入口（路由/签名/错误分类速查）
├── README.md                        项目总览 + 最短上手路径
├── LICENSE                          MIT
│
├── sdks/typescript/                   ── Node.js CLI 子项目 ──
│   ├── src/
│   │   ├── cli/                     main.ts（入口）、program.ts（构建器 + --format 校验）
│   │   ├── commands/                register.ts（通用注册器）、error-output.ts、system/{capabilities,auth}.ts
│   │   ├── contracts/               remote-capabilities.ts（10 端点单一信源）、errors.ts
│   │   ├── application/             config.ts、ports/auth-provider.ts、use-cases/remote-query.ts
│   │   ├── infrastructure/
│   │   │   ├── elecredit/           client.ts、signature.ts、envelope.ts、retry.ts
│   │   │   └── credentials/         app-key-pair-provider.ts、keyring.ts、redact.ts
│   ├── tests/                       11 个文件（signature / envelope / 端点一致性 / 错误输出 / 版本一致性 …）
│   ├── scripts/                     check-license.mjs（LICENSE 检查）、live-smoke.mjs（10 端点在线冒烟）
│   ├── package.json / tsconfig.json / vitest.config.ts / eslint.config.js / prettier.config.mjs
│   └── npm-shrinkwrap.json
│
├── sdks/python/                           ── Python 子项目 ──
│   ├── elecredit/
│   │   ├── __init__.py              公共 API（12 个模块级便捷函数）
│   │   ├── __main__.py              python -m elecredit
│   │   ├── _version.py              __version__ = "0.1.0"
│   │   ├── client.py                ElecreditClient（核心）
│   │   ├── endpoints.py             ENDPOINTS 注册表
│   │   ├── signature.py             签名算法 + 黄金样本自测试
│   │   ├── envelope.py              响应解析 + 错误分类
│   │   ├── errors.py                异常层次
│   │   ├── credentials.py           凭据探测链
│   │   └── cli.py                   Typer CLI
│   ├── tests/                       conftest.py + 4 个测试模块
│   ├── pyproject.toml               包定义（console script: elecredit）
│   └── README.md
│
├── plugins/skills/elecredit-skill/         独立 skill 仓库（唯一维护源；本地 clone，`/plugins/` 已 gitignore）
│   ├── SKILL.md                     Agent 路由主文档
│   ├── scripts/                     query_elecredit.py（零依赖执行器）
│   └── references/                  endpoints.md（端点参数 + 错误码）
│
├── docs/
│   ├── README.md                    文档中心入口
│   ├── signature.md / troubleshooting.md   签名细节与排障
│   ├── publishing.md                发布与同步运维
│   └── api/elecredit/               10 个端点文档 + REST 契约总览（通用约定 + 黄金样本）
│
├── .cnb.yml                          CI（Python / Node / OpenAPI）+ 发布 + GitHub 同步
└── .github/workflows/
    └── sync-cnb.yml                 GitHub → CNB 手动逃生口（GitHub 侧已无 CI）
```

## 1.4 全局约束（所有子项目共享）

### 凭据

- 形态：**App ID + App Key 二元组**（不是单一 API Key）。
- 获取：[https://api.elecredit.com/admin]
- 探测（Python）：
  1. 显式传参 `ElecreditClient(app_id=..., app_key=...)`
  2. 环境变量 `ELECREDIT_APP_ID` + `ELECREDIT_APP_KEY`
  3. `.env` 文件（`./.env` 或 `~/.elecredit/.env`，若安装 python-dotenv）
- 探测（Node CLI）：环境变量 → 系统钥匙环，两者同时存在才视为已配置。钥匙环用 `elecredit-ts auth login --app-id <App ID> --app-key <App Key>` 写入，`auth status` / `auth logout` 管理（只报告来源，不回显值）。
- 安全纪律：不得复述 Key、不得写入命令参数/日志/代码/公开配置/Git 提交。

### 签名（生产已验证）

```python
sn        = uuid.uuid4().hex                                        # 32 位，无连字符
ts        = str(int(time.time() * 1000))                            # 毫秒字符串
body      = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))  # 中文不转义！
signStr   = sn + ts + body + appKey
signature = hashlib.md5(signStr.encode("utf-8")).hexdigest()        # 小写 32 hex
```

请求头（`signature` / `sign-type` **在 Header，不在 body**）：

```
Content-Type: application/json
app-id:        [appId]
timestamp:     [ts_ms]
request-sn:    [sn]
signature:     [md5_hex]
sign-type:     MD5
```

### 大数据纪律

- 禁止把全量原始结果输出到对话。
- 大结果（F09 深层穿透、分页全集）必须落盘（`--output <file>`），只报告路径、行数和摘要。

### 错误处置纪律

| code | 语义 | 动作 |
|------|------|------|
| `SYS001`~`SYS004`、`SYS006` | 认证域 | 检查凭据/签名/时钟，**不重试** |
| **`SYS005`** | **余额不足** | **提示充值，不重试**（签名已通过） |
| `SYS008` | 限流 | 降速 + 有界退避重试 |
| `400` 类 | 参数 | 修正字段 |
| `5xx` / 网络 | 上游 | 有界退避重试 |
