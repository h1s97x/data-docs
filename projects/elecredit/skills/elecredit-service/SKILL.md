---
name: elecredit-service
version: 1.0.0
description: 通过已部署的 elecredit 能力服务查询企业征信数据（工商、司法、税务、行政处罚、股权穿透、名称标准化）。AI 侧只需一个调用方 Token，不接触服务商 App ID/Key 与签名。当用户要求查企业工商信息、风险、股权、税务或核实企业全称时使用。
---

# Elecredit 企业征信查询（能力服务版）

## 与另一个 Skill 的区别

`elecredit-skill`（独立仓库）是**直连服务商 REST API** 的技能，需要 AI 侧持有
`ELECREDIT_APP_ID` + `ELECREDIT_APP_KEY` 并自行做 MD5 签名。
本 Skill 面向**已部署的 elecredit 能力服务**，只用一个调用方 Token，权限由
服务侧注册表的 `scopes` / 过期 / 吊销统一控制。**不要混用，也不要向用户索要 App Key。**

## 文件地图

```
elecredit-service/
├── SKILL.md                     # 本文件：触发条件、工作流、错误分类
├── scripts/query.py             # 零依赖执行脚本：HTTP → 解析 → 格式化
└── references/capabilities.md   # 能力 × 入参矩阵、字段坑、错误码速查
```

| 文件 | 调用时机 |
|---|---|
| `SKILL.md` | 每次触发全文加载 |
| `scripts/query.py` | 阶段 1 执行查询 |
| `references/capabilities.md` | 不确定能力名 / 可选参数 / 错误含义时按需引用 |

## 触发场景

- 「查一下威海银行的工商信息」
- 「这家公司有没有司法风险 / 行政处罚 / 税务异常」
- 「帮我做一下股权穿透」
- 「核实一下这个企业的工商登记全称」
- 需要一次性拿到企业全景数据（工商 + 规模 + 司法 + 股权）

## 工作流程

### 阶段 0：检查配置（每次触发前置）

检查 `ELECREDIT_SERVICE_URL` 与 `ELECREDIT_SERVICE_TOKEN` 是否配置：

```bash
python -c "import os; print('OK' if os.getenv('ELECREDIT_SERVICE_URL') and os.getenv('ELECREDIT_SERVICE_TOKEN') else 'MISSING')"
```

- `OK` → 进入阶段 1
- `MISSING` → 停止并说明：需要能力服务地址与调用方 Token（由管理员用
  `service/issue_token.py` 签发），**不要向用户索要 App ID/App Key，也不要复述任何凭据值**
- 可用 `elecredit_health` 能力确认服务可达

### 阶段 1：先标准化，再查询（关键）

1. **用户给的是简称时，必须先调 `normalize`**：
   ```bash
   python scripts/query.py --capability normalize --company-name 威海银行
   ```
   取返回的 `data.normalized`。**直接拿简称查 `basic` 会返回一堆空列表**——
   这是上游的匹配行为，不是接口故障。
   若 `verified=false`，明确告知「全称未经数据源核实」，不要替用户补全。
2. **按意图选能力**：见 `references/capabilities.md`。不确定时用 `full` 一次聚合。
3. **执行查询**（一律用标准化后的全称）：
   ```bash
   python scripts/query.py --capability basic --company-name 威海银行股份有限公司
   python scripts/query.py --capability shareholding --company-name 威海银行股份有限公司 --set level=3 --set ratio=5
   python scripts/query.py --capability full --company-name 威海银行股份有限公司 --output full.json
   ```
4. 大结果用 `--output` 落盘，只报告路径、字符数与摘要，**不回显全量 JSON**。

### 阶段 2：呈现结果

- `success=true` 且有数据：按用户语言习惯整理；金额、日期、比例原样转述
- `success=true` 但 `data` 为空 / `001` 查无结果：明确说「未查询到相关记录」，
  **不要编造，也不要说成接口故障**
- `full` 返回 `partial=true` 或 `warning` 含「工商基本信息缺失」：逐条转述 warning，
  报告中相应字段填「未查询到公开数据」
- `success=false`：转述 `error`，并按错误分类给建议动作（下表）
- 严禁把检索失败、越权、额度不足伪装成「这家企业没有风险」

## 错误分类

| 现象 | 含义 | 处理 |
|---|---|---|
| 401 | Token 缺失/无效/已吊销 | 找管理员重新签发调用方 Token；不要反复重试 |
| 403 `capability not allowed` | 该 Token 的 `scopes` 不含此能力 | 说明权限边界，换有权限的能力或申请扩权 |
| 403 `forbidden` | 来源 IP 不在 `SERVICE_ALLOWED_CIDRS` | 网络/白名单问题，不是数据问题 |
| 429 | 触发按能力限流 | 稍后重试，不要并发猛刷 |
| `SYS005` / `degrade_reason=数据接口套餐余额不足` | 服务商额度耗尽 | 提示管理员充值；**接口仍返回 success=true + 空数据**，必须如实标注缺失 |
| `error` 含「无法连接能力服务」 | 服务不可达 | 检查地址与网络，用 `health` 诊断 |
| `success=true` 但 `data` 全空（用简称查时） | 入参未标准化 | 先 `normalize` 再用全称重查 |

## 能力边界

| 擅长 | 超出范围 |
|---|---|
| 工商登记、司法风险、税务信用、行政处罚、股权穿透、名称标准化 | 实时征信评分、企业信用评级 |
| 已登记企业的结构化数据 | 全市场批量扫描、动态图谱可视化 |
| 单企业按需查询（受 scope 与限流约束） | 绕过 Token 权限直连服务商 |

超出范围时明确说明边界，不用近似数据或公开搜索结果冒充征信数据。

## Resources

| 资源 | 路径 |
|---|---|
| 能力矩阵与错误码 | `references/capabilities.md` |
| 执行脚本 | `scripts/query.py` |
| 服务契约 | 仓库 `openapi/service.yaml` |
