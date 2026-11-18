---
layout: home

hero:
  name: Data Docs
  text: 企业风控数据产品族
  tagline: 三套 SDK，一套架构，统一接入
  actions:
    - theme: brand
      text: 共用架构
      link: /guide/architecture
    - theme: alt
      text: 发版约定
      link: /guide/release-conventions

features:
  - title: xyj-api
    details: 企业上下游发票流水 / 报告申请与查询。SHA1withRSA 签名 + 响应验签，8 语言 SDK + 能力服务 / MCP / Skill。
    link: /projects/xyj-api/README
  - title: altdatahub
    details: 替代数据通 10 大类 51 个产品码。契约驱动生成 8 语言强类型模型，离线目录 + 在线查询。
    link: /projects/altdatahub/README
  - title: elecredit
    details: 企业风控 10 端点。App ID + App Key 签名，Python SDK / Node CLI 双包发布。
    link: /projects/elecredit/README
---

## 本站定位

本页是 xyj-api、altdatahub、elecredit 三个项目的**统一文档入口**。三者共用同一套工程架构：

- `contract/sdk.json` → `tools/gen_code.py` → 多语言类型/端点/错误产物
- `contract/vectors.json` 跨语言行为向量（CI `--check` 门禁）
- `service/` 能力服务 + `mcp/` + `skills/` 接入层
- `cli-v<version>` / `sdk-v<version>` 双包 tag 发版

## 内容从哪里来

各项目的 `docs/` 是**唯一事实源**。本站 `projects/<slug>/` 目录由各主仓 CI 推送的**脱敏快照**生成，只读镜像 —— 要改文档请改主仓，不要在此直接编辑。

共用约定（`guide/`）只在本站维护，因为它是三个项目共同的设计决策记录。
