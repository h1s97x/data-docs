# 05 · 端点实现要点（校验与跨语言差异）

10 个端点的路径、参数、响应与产品码**不再在此复述**：
人读契约见 [`docs/api/elecredit/`](../api/elecredit/README.md)（总览 + 10 篇原子文档），
机器契约见 [`openapi/openapi.yaml`](../../openapi/openapi.yaml)。
本文只保留契约文档不覆盖的**工程实现细节**。

## 5.1 端点侧实测坑

> ⚠️ 以下均 2026-09-30 真实凭据实测：
> ① B04 的参数名必须是 `entInfo`，传 `entName` 报 `400 企业信息不能为空`；
> ② P0020019 的路径**大小写敏感**，必须是小写 w 的 `/saic/SaicinvWh`，写成 `SaicInvWh` 返回
> `SYS044 资源不存在`（与「路径不存在」同码，极易误判）。提交 `4a5d9eb` 曾把大小写改反，端点因此长期打不通；
> ③ **D11 的标识字段是 `entityName`**（旧文档写 `entName`）——写错的后果是稳定 400；它的 `type`
> 取值也整体换过一套，旧文档的 12 个码全部非法。

## 5.2 Node 侧 Zod 输入校验规则

| 端点 | 关键校验 |
|------|---------|
| A03 | 四字段至少一个非空（`superRefine`） |
| A04 | `entInfo` 必填非空 |
| A07 | `entName` 必填非空；`type ∈ {0,1,2}`；`pageNo`/`range` 正整数字符串 |
| B06 | `entityName` 必填；`type ∈ 4 个枚举`；`pageNo`/`range` 正整数字符串 |
| D07 | `entInfo` 必填；日期 `YYYY-MM-DD` 或空串 |
| D11 | `entityName` 必填；`type` **单值**且必须是 12 个实测前缀之一（大小写敏感）；`range` ≤ 20 |
| D14 | `persName`、`idNo` 均必填非空 |
| F09 | `entInfo` 必填；`level ∈ 1..5`；`down`/`up` 为 boolean |
| B04 | `entInfo` 必填（**不是 `entName`**）；`pageNo`/`range` 为正整数字符串；日期 `YYYY-MM-DD` |
| P0020019 | `entInfo` 必填；路径固定小写 w 的 `/saic/SaicinvWh` |

输出 schema 当前统一为 `z.object({}).passthrough().catch(() => ({}))` —— **接受任意 `resultData` 结构，不做字段级校验**，待与真实数据对齐后细化。

## 5.3 两语言参数差异一览

| 维度 | Node CLI | Python SDK |
|------|----------|-----------|
| D11 标识字段 | `entityName`（选项 `--entity-name`） | `entityName`（参数 `entity_name`） |
| D11 类型字段 | `type`（选项 `--type`，**单值**） | `type`（**单值**，不支持逗号多选） |
| F09 方向控制 | `--down` / `--up` | `down` / `up` |
| A07 分页 | `--page-no` / `--range` | `page_no` / `range` |
| `pageNo` 类型 | integer 选项 → 转字符串 | 直接字符串 |
| 空字符串过滤 | `queryFor` 丢弃空串 | 只丢弃 `None` |
| 默认超时 | 10s（graph 60s） | 15s（graph 60s） |
| 重试退避 | `min(1000·2ⁿ, 8000)` + 20% jitter | `2ⁿ × 0.1`s |
| 重试次数 | 3 | 3 |
| 签名 | 每次 attempt 重算 | 一次签名复用 |
