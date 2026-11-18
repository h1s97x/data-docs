# 企业风控数据（Elecredit）

> **单一真源**
> - 机器契约：[`openapi/openapi.yaml`](../../../openapi/openapi.yaml)（Apifox / Redoc / Scalar / Prism / Spectral 均从此读取，用法见 [openapi/README.md](../../../openapi/README.md)）。
> - 人读总览：本文（通用约定、签名黄金样本、`resultData` 产品码、错误码、10 端点列表）。
> - 端点原子文档：本文「端点列表」中链接的 10 篇 md，逐端点记录参数与响应字段。

10 个企业风控端点，覆盖工商、司法、税务、限消、行政处罚、股权图谱、招投标和实控人。
全部为 `POST` + JSON body，签名放 HTTP Header（非 body）。
签名的序列化细节与排错见 [签名算法与自测](../../signature.md)，按现象排障见
[常见问题与排障](../../troubleshooting.md)。

## 通用约定

| 项目 | 契约 |
|---|---|
| Base URL | `https://api.elecredit.com` |
| 方法 | 全部 `POST` + JSON body |
| 认证 | HTTP Header 签名（`app-id` + `timestamp` + `request-sn` + `signature` + `sign-type`） |
| 签名算法 | `MD5(requestSn + timestamp_ms + bodyCompactJson + appKey).hex()` |
| 签名位置 | **HTTP Header**，不是 body |
| body 序列化 | 紧凑 JSON（`separators=(",", ":")`），中文**不转义** |
| 成功判断 | 响应 `code` 为空或 `000` |
| 响应信封 | `{code, msg, orderNo, resultCode, resultData}` |
| 时区 | 时间戳按 `Asia/Shanghai` 解释 |

获取凭据：<https://api.elecredit.com/admin>（App ID + App Key，不是单一 API Key）。

## 签名黄金样本（生产环境已验证）

> 凭据用占位符表示，真实 App ID + App Key 不要写入文档或代码。

```
appId  = <yourAppId>
appKey = <yourAppKey>
body   = {"entName":"贵州茅台"}

sn       = a7ecea084efb42e2a24adc596a40950e   # 32 位随机（示例值）
ts       = <毫秒时间戳>
signStr  = sn + ts + body + appKey              # 字符串拼接
signature= MD5(signStr).hex()

# 凭据正确时生产返回 SYS005 余额不足 → 签名正确
```

最小请求示例（curl）：

```bash
curl -X POST 'https://api.elecredit.com/mohu/wh' \
  -H 'Content-Type: application/json' \
  -H 'app-id:        <appId>' \
  -H 'timestamp:     <ts_ms>' \
  -H 'request-sn:    <sn>' \
  -H 'signature:     <md5_hex>' \
  -H 'sign-type:     MD5' \
  -d '{"entName":"贵州茅台"}'
```

Python 参考实现：

```python
import hashlib, json, time, uuid
sn = uuid.uuid4().hex
ts = str(int(time.time() * 1000))
body = json.dumps({"entName": "贵州茅台"}, ensure_ascii=False, separators=(",", ":"))
sign_str = sn + ts + body + APP_KEY
sig = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
```

## resultData 包裹结构（产品码对照）

上游把业务数据再包一层：`resultData` = `{ <产品码>Status, <产品码>Data }`，各端点产品码不同。
**取内层业务体**：Python 用 `elecredit.product_payload(result_data)`（不传码则按结构探测，上游换码也不失效）；
其它语言按 `resultData[f"{product_code}Data"]` 自行取。

| 端点 | 短码 | 产品码 | 来源 |
|---|---|---|---|
| `/mohu/wh` | A07 | `P0010068` | 本仓库实测（2026-09-30） |
| `/saic/enterprise/deep/wh` | A03 | `P0010058` | 消费方 registry |
| `/enterprise/companyLevel/wh` | A04 | `P0010070` | 消费方 registry |
| `/enterprise/taxInfo` | B06 | `P0030125` | 消费方 registry |
| `/enterprise/adminPunishment` | D07 | `P0030126` | 消费方 registry |
| `/risk/sifaInfo/wh` | D11 | `P0030089` | 消费方 registry |
| `/litigation/xgbzxrPeople/wh` | D14 | `P1020054` | 本仓库实测（2026-09-30） |
| `/saic/equityPenetration` | F09 | `P0020023` | 本仓库实测（2026-09-30） |
| `/enterprise/biddingYPageWh` | B04 | `P0010034` | 本仓库实测（2026-09-30） |
| `/saic/SaicinvWh` | P0020019 | `P0020019` | 本仓库实测（2026-09-30） |

实测样本（真实响应体）：

```json
{
  "code": "001",
  "msg": "查询成功无结果",
  "orderNo": "a14eb808e0c245f4b15c1123b0e2265b",
  "resultData": { "P0010034Status": "1", "P0010034Data": { "resultList": [] } }
}
```

> 「消费方 registry」= 智慧风控一期（`whbkfkhd`）线上在用的产品码，本仓库尚未逐一复测；
> `resultData` 内部字段当前一律原样透传（不做字段级校验）。

## 错误码

| code | 分类 | 含义 | 处理 |
|---|---|---|---|
| `000` | 业务 | 成功且有结果（**计费**） | 取 `resultData` |
| `001` | 业务 | 成功但无结果（**同样计费**） | 按「查无记录」处理，不是错误 |
| `SYS001` | 认证 | 签名错或凭据无效 | 检查 appId/appKey、签名算法、时钟差 |
| `SYS002` | 认证 | 请求过期 | 同步本机时钟后重试 |
| `SYS003` | 认证 | 应用 ID 不存在 | 核对 `app-id` 是否与后台一致 |
| `SYS004` | 认证 | 签名算法不支持 | 使用 MD5（或 SHA256） |
| `SYS005` | **业务** | **余额不足** | 提示充值，**签名已通过**，不重试 |
| `SYS006` | 认证 | 请求 IP 受限 | 联系服务商加白名单，不重试 |
| `SYS007` | 上游 | 请求流水号重复 | 换新 `request-sn` 重试一次 |
| `SYS008` | 限流 | 频率限制 | 有界退避，降速后重试 |
| `SYS009` | 参数 | 请求体过大 | 缩小请求体（如降低 F09 的 `level`） |
| `SYS044` | 路由 | 资源不存在（多为端点路径大小写写错） | 核对端点路径，**不重试** |
| `400` | 参数 | 请求体校验失败 | 修正字段 |
| `999` | 服务 | 上游服务异常 | 有界退避重试 |
| HTTP 5xx | 服务 | 上游异常 | 有界退避重试 |

## 端点列表

> **两套 CLI 同名，注意区分**。下表「CLI 命令」列列的是 **Node CLI** 的全称形式
> （`elecredit-ts <group> <name>`，如 `elecredit-ts enterprise fuzzy --ent-name …`）。
> Python SDK 自带的 CLI 入口**也叫 `elecredit`**，但子命令是**扁平**的
> （`elecredit-py fuzzy --ent-name …`）。各端点页的示例可能用其中任一种，两者都能跑。

### 工商域（A 系列）

| ID | 端点 | CLI 命令 | 核心参数 |
|---|---|---|---|
| A07 | [模糊查询](fuzzy.md) | `enterprise fuzzy` | `entName`（必填），支持分页 |
| A03 | [深度查询](deep.md) | `enterprise deep` | `entName` / `creditCode` / `regNo` / `orgCode`（4 选 1） |
| A04 | [大中小微划型](scale.md) | `enterprise scale` | `entInfo`（任一关键字） |

### 税务域（B 系列）

| ID | 端点 | CLI 命令 | 核心参数 |
|---|---|---|---|
| B06 | [税务信用/欠税/处罚/非正常户](tax.md) | `enterprise tax-credit` | `entityName` + 可选 `type`（4 种） |

### 招投标域（B 系列）

| ID | 端点 | CLI 命令 | 核心参数 |
|---|---|---|---|
| B04 | [招投标信息](bidding.md) | `enterprise bidding` | `entInfo`（必填，**不是 `entName`**），支持分页与日期区间 |

### 风险域（D 系列）

| ID | 端点 | CLI 命令 | 核心参数 |
|---|---|---|---|
| D07 | [行政处罚](admin-punishment.md) | `enterprise admin-punishment` | `entInfo` + 可选日期范围 |
| D11 | [司法模糊查询](judicial.md) | `risk judicial-fuzzy` | `entityName` + 可选单值 `type`（12 种，`range` ≤ 20） |

### 诉讼域（D/L 系列）

| ID | 端点 | CLI 命令 | 核心参数 |
|---|---|---|---|
| D14 | [限消人员](xgbzxr.md) | `litigation xgbzxr` | `persName` + `idNo` |

### 图谱域（F 系列）

| ID | 端点 | CLI 命令 | 核心参数 |
|---|---|---|---|
| F09 | [企业股权图谱](graph.md) | `enterprise graph` | `entInfo` + 可选 `level`（60s 超时） |

### 实控人（P 系列）

| ID | 端点 | CLI 命令 | 核心参数 |
|---|---|---|---|
| P0020019 | [实控人（法人/股东穿透）](actual-controller.md) | `enterprise actual-controller` | `entInfo`（必填；路径是**小写 w** 的 `/saic/SaicinvWh`） |
