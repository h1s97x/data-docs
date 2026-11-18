---
layout: home

hero:
  name: altdatahub
  text: 替代数据通
  tagline: 51 个数据产品，收敛成一套可验证的契约
  actions:
    - theme: brand
      text: API 文档
      link: /reference/altdatahub/api/index
    - theme: alt
      text: MCP 文档
      link: /reference/altdatahub/mcp/index
    - theme: alt
      text: 快速开始
      link: /reference/altdatahub/getting-started/install

features:
  - title: 10 大类 / 51 产品
    details: 557 个顶层字段、12 个子结构（397 字段）、2 个查询参数，全部来自分册 V1.0 的可重放解析。
  - title: 契约驱动生成
    details: products.json / capabilities.json / vectors.json 驱动 7 语言强类型模型，手改下游必红。
  - title: 能力服务 + MCP
    details: 5 个能力端点、5 个 MCP tool，调用方不接触网关地址与 EDS_* 凭据。
---

## 诚实口径（先读）

本项目是**第三方实现**，非征信中心官方发布，与征信中心无隶属关系。

| 能力 | 状态 |
|---|---|
| 离线产品目录（51 产品 / 字段字典） | ✅ 完全可用，不需要凭据 |
| 能力服务 / MCP / Skill | ✅ 可用，仍需服务端 `EDS_*` 凭据 |
| EDS 网关在线查询 | ✅ 已完成 51 个产品全量验证；部分 0 行为正常空结果 |
| 本站在线调试台 / 试用 Token | ❌ 不提供 |

缺凭据时返回 `success=false` + `degrade_reason`，这是「数据源未接入」而非「查无记录」；`data: []` 才是正常成功。

## 三大板块

| 板块 | 内容 | 入口 |
|---|---|---|
| API 文档 | 总览与鉴权、逐端点参数与 curl、数据契约、能力矩阵 | [API 文档](./api/index) |
| MCP 文档 | 5 个 tool 的 inputSchema、JSON-RPC 示例、双 transport 部署 | [MCP 文档](./mcp/index) |
| 开发工具 | 安装与 CLI、多语言 SDK、能力服务、生成器与排障 | [工具链](./guides/toolchain) |

## 三步跑通离线能力

```bash
pip install --index-url https://pypi.cnb.cool/h1s97x/pypi/-/packages/simple altdatahub
altdatahub categories
altdatahub schema S0101
```

离线目录不需要任何凭据。安装方式与构建门禁见 [安装与 CLI](./getting-started/install) 与 [工具链](./guides/toolchain)。

## 给 AI 读

本站内容同样按 AI 友好的方式组织：能力真源见 [能力矩阵](./contract/capabilities)，原始文档见 [原始文档镜像](./reference/index)。
