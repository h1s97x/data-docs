# xyj-api 协议契约

本 SDK 封装的对方网关（`xyj-api`）协议，逐字镜像自 GraphNexus 中已验证的生产实现
（`app/utils/rsa_utils.py`、`app/services/upstream_downstream_service.py`、`app/services/report_service.py`）。

## 1. 请求结构

所有端点均为 `POST`、`Content-Type: application/json`：

```json
{
  "head": {"orgCode": "WHYH001", "orgName": "某某银行", "sign": "<Base64 签名>"},
  "body": { "……业务参数……": "……" }
}
```

## 2. 请求签名（SHA1withRSA）

`sign` **只对 `body`** 计算（响应侧的验签见 §3.1）：

1. 规范化 `body` 为 `k1=v1&k2=v2`：

   - key 按**小写**排序；
   - 跳过键名恰为 `sign` 的项；
   - 跳过值为 `null` / 空字符串 `""` 的项（**空数组不跳过**，表现为 `key=`）；
   - 嵌套对象递归展开；
   - 数组用 `[...]` 包裹、元素以 `,` 连接；元素是对象时递归展开。

2. 规范化串按 UTF-8 取字节，用 `SHA1withRSA`（PKCS#1 v1.5）签名。

3. 结果做标准 Base64（无换行）。

黄金样本（见 `sdks/python/tests/test_signature.py`，用固定测试私钥做精确断言）：

```
body = {"companyList":[{"companyName":"测试企业有限公司","nsrsbh":"91330000TEST0000XX"}],"type":"1","key":"demo_key","params":""}

canonical = companyList=[companyName=测试企业有限公司&nsrsbh=91330000TEST0000XX]&key=demo_key&type=1
```

> `params=""` 被跳过、`companyList` 与 `key`/`type` 按小写排序——这两点最容易抄错。

私钥格式：Base64 PKCS#8 裸体（项目 `.env` 的存法）或完整 PEM，SDK 均接受。

## 3. 响应信封

```json
{"code": "200", "msg": "……", "data": { "……": "……" }}
```

成功判定：`success is True` **或** `code ∈ {"200", "0000"}`（上游可能返回整数 `200`）。

### 3.1 响应验签

真实响应还带一个 `sign` 字段：

```json
{"code": 200, "msg": "操作成功", "data": [], "datas": {}, "sign": "[Base64]",
 "timestamp": 1790747402129, "success": true}
```

**签名范围（实测反推，2026-09-30 对真实网关）**：

```
sign = SHA1withRSA(canonicalize_value(data), 消费方自己的私钥)
```

也就是**用消费方自己密钥对的私钥签的**——所以「交给网关的那把公钥」即可验签，
不需要额外的网关公钥。规范化口径与请求签名完全一致（见 §2），空数组规范化为空串。

判定手段：同一请求连续两次调用，`timestamp` 每次都变而 `sign` **完全一致** →
可证 `code` / `msg` / `timestamp` / `success` **都不在签名范围内**。

> ⚠️ **局限**：验签只能保证 `data` 未被篡改；`code` / `success` 可被中间人改写而
> 不被发现（例如把 `success` 翻成 `true`）。传输防篡改依赖 HTTPS，验签是对 `data`
> 的额外一层完整性校验，**不能替代 TLS**。

> ⚠️ **样本局限**：实测当日该机构无数据，`data` 恒为空数组（规范化为空串），
> 因此「非空 `data` 的规范化口径」尚无真实样本覆盖。用
> `xyj verify-probe --company .. --nsrsbh .. --data-key .. --public-key ..`
> 可随时复核；口径若不一致会立即以非零码报出。

启用方式：`XyjClient(..., verify_public_key="<Base64 公钥或 PEM>")`，
或 `XYJ_PUBLIC_KEY` 环境变量；失败抛 `ResponseVerifyError`。

## 4. 端点

| key | path | 说明 |
|---|---|---|
| `upstream_downstream` | `/xyj-api/external/queryGeneralData` | 企业上下游查询（发票流水口径） |
| `report_apply` | `/xyj-api/external/report/applyReport` | 报告申请 |
| `report_query` | `/xyj-api/external/report/queryReportInfo` | 报告查询 |

### 4.1 上下游查询

请求 `body`：

```json
{"companyList": [{"companyName": "……", "nsrsbh": "……"}], "type": "1", "key": "[数据key]", "params": ""}
```

- `type`：`"1"` 裂变模式（默认）/ `"2"` 标签模式。

响应 `data` 是流水记录数组，每条用 `jyfx` 标注方向（`上游` / `下游`）。
`XyjClient.parse_upstream_downstream()` 负责按方向切分并统一字段命名——**不排序、不截断**。

### 4.2 报告申请

```json
{"key": "[报告产品key]", "nsrmc": "……", "nsrsbh": "……"}
```

成功时 `data.taskNo` 为后续查询用的任务号，用 `extract_task_no()` 取。

### 4.3 报告查询

```json
{"taskNo": "……", "params": "{\"queryJson\": true}"}
```

> ⚠️ `params` 是**字符串**（内容为 JSON `{"queryJson": true}`），不是嵌套对象。

## 5. 错误语义

- **业务失败不抛异常**：只要 HTTP 能拿到 JSON 信封就原样返回，由调用方用 `is_success()` 判定；
- 传输层问题（网络 / 超时 / 重试耗尽 / 响应非 JSON）抛 `UpstreamError`；
- 本地配置缺失抛 `ConfigError`；私钥非法抛 `SignatureError`；
- 开启 `verify_public_key` 后，验签失败（含缺 `sign`）抛 `ResponseVerifyError`；
- `raise_for_status=True` 时，HTTP ≥ 400 抛 `ValidationError`（4xx）/ `UpstreamError`（5xx）；
- 重试：网络错误与 HTTP `429/500/502/503/504` 按 `max_attempts` 重试并指数退避，其余 4xx 不重试。

## 6. 边界

SDK **只做协议**。以下留在消费方，不要塞进 SDK：

- 数据库缓存（如 `invoice_flow_customers` 的建表/落库/查库）
- 「先查库 → 查不到调接口 → 写回」编排、报告异步轮询
- 扫码授权回调页、审计日志
- 按金额排序取前 N 等展示策略

> 对方改协议时，只要改 `signature.py` / `endpoints.py`，黄金样本测试会第一时间失败提示。
> 响应签名范围见 §3.1，同样有黄金样本回归（`sdks/python/tests/test_verify.py`）。
