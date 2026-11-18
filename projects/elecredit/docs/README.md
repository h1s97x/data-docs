# 文档中心

Elecredit 企业风控数据的公开文档。根 [`README.md`](../README.md) 负责项目总览与最短上手路径；
本目录是**文档事实源**（API 契约、签名与排障、工程 wiki）。机器契约真源是
[`openapi/openapi.yaml`](../openapi/openapi.yaml)。

## 入口

| 目标 | 文档 |
|------|------|
| 项目总览和最短上手路径 | [根 README](../README.md) |
| **调用已部署能力服务**（接入方快速开始、Token、免写码接入路径） | [**接入方快速开始**](INTEGRATION.md) |
| REST API 契约（10 端点参数/响应、通用约定、错误码、产品码） | [REST API 契约总览](api/elecredit/README.md) |
| 签名序列化细节、TS 参考实现与自测 | [签名算法与自测](signature.md) |
| 按现象排障（凭据 / 参数 / 结果 / 接入选择） | [常见问题与排障](troubleshooting.md) |
| Python SDK 使用 | [Python README](../sdks/python/README.md) |
| Node.js CLI 使用 | [CLI README](../sdks/typescript/README.md) |
| Agent Skill（路由 + 签名黄金样本） | [`elecredit-skill`](https://cnb.cool/h1s97x/plugins/skills/elecredit-skill)（独立仓库，本仓不内嵌） |
| Agent 专家插件 | [`elecredit-expert`](https://cnb.cool/h1s97x/plugins/experts/elecredit-expert)（submodule 引用上述 skill） |
| npm / PyPI 发布与 CNB → GitHub 同步运维 | [发布与同步运维](publishing.md) |
| 工程 wiki（架构 / 逐模块 / 依赖 / runbook / 问题登记册） | [`wiki/`](wiki/README.md) |
| OpenAPI 唯一真源、离线渲染 / Mock 方案 | [openapi/README.md](../openapi/README.md) |

## 边界

- `docs/` 是**主仓事实源**：`docs/api/elecredit/` 被跨端一致性测试直接引用，
  `docs/wiki/08-known-issues.md` 是「待办登记 + 处置留痕」的登记册（改代码与登记同一次提交完成，
  见 `.cnb.yml`、`sdks/typescript/src/contracts/errors.ts` 等处的引用），
  根 `README.md` / `AGENTS.md` 的端点表与错误分类表同样被测试解析。
- 机器契约真源是 `openapi/openapi.yaml`（Apifox / Redoc / Scalar / Prism / Spectral 均从此读取），
  见 [openapi/README.md](../openapi/README.md)；10 端点的人读文档在 `docs/api/elecredit/` 按端点拆分。
- 不再维护独立 `elecredit-docs` 仓库或 VitePress 站点；历史提案的结论与未完成项已并入
  [`docs/wiki/08-known-issues.md`](wiki/08-known-issues.md)。
- Python SDK 和 CLI 文档只说明运行方式，不复制 REST 响应字段——直接链接 `docs/api/elecredit/`。
- 凭据获取：[https://api.elecredit.com/admin]。**App ID + App Key 二元组**，不要写入代码或 Git。
- 签名算法见根 README 和 [REST API 契约总览](api/elecredit/README.md) 的黄金样本；
  序列化细节与排错见 [签名算法与自测](signature.md)。

## 文档入口

| 在线文档站 | [Data Docs](https://h1s97x.github.io/data-docs/)（三项目统一站；各主仓 `docs/` 为事实源） |
