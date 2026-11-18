---
layout: home

hero:
  name: 风控数据 API
  text: 企业风控数据产品族
  tagline: 三套 SDK，一套契约架构，统一接入
  actions:
    - theme: brand
      text: 接口总览
      link: /reference/elecredit/api/index
    - theme: alt
      text: 产品 API
      link: /reference/altdatahub/api/index
    - theme: alt
      text: 共用架构
      link: /guide/architecture

features:
  - title: elecredit · 企业风控
    details: 10 个端点，工商 / 税务 / 司法 / 图谱全覆盖。App ID + App Key 签名，Node CLI、Python SDK、Agent Skill 四种接入形态。
    link: /reference/elecredit/api/index
  - title: altdatahub · 替代数据通
    details: 10 大类 51 个 productCode，契约驱动生成 7 语言强类型模型；离线目录可用，在线查询全量验证。
    link: /reference/altdatahub/api/index
  - title: xyj-api · 上下游发票
    details: 企业上下游发票流水与报告申请查询，SHA1withRSA 签名与响应验签，8 语言 SDK + 能力服务 / MCP / Skill。
    link: /projects/xyj-api/README
---

## 接口总览

三套产品共享「契约驱动 + 能力服务 + MCP」架构，但各自有独立的 REST 契约与接入方式。从左侧产品树选择对应端点，或从下方入口进入：

| 产品 | 接口总览 | 快速开始 | 鉴权方式 |
|---|---|---|---|
| elecredit | [API 参考](./reference/elecredit/api/index) | [快速开始](./reference/elecredit/guide/quick-start) | App ID + App Key（MD5 签名） |
| altdatahub | [API 文档](./reference/altdatahub/api/index) | [安装与 CLI](./reference/altdatahub/getting-started/install) | Bearer Token（服务端注入 EDS 凭据） |
| xyj-api | [项目 README](./projects/xyj-api/README) | [集成指南](./projects/xyj-api/docs/INTEGRATION) | SHA1withRSA 签名 |

## 内容分层

- `reference/` 是面向读者的 API 文档与接入指南，其中 elecredit / altdatahub 两部分从已归档文档仓同步而来，是本站**唯一手写维护区**；
- `projects/` 是各主仓 CI 推送的**脱敏快照只读镜像**，事实源在各自主仓的 `docs/`；
- `guide/` 记录三项目共用的契约驱动架构、发版约定与 SDK 矩阵。

要改文档请改主仓（或 `reference/` 的手写内容），不要在 `projects/` 快照里直接编辑。
