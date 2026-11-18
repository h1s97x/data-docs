# xyj-api

`xyj-api` 网关（`/xyj-api/external/*`）的 Python SDK。

- `SHA1withRSA` 签名（镜像对方 Java `RSAUtils.signByMapSort`，含黄金样本回归测试）
- 统一信封解析：`success is True` 或 `code ∈ {"200", "0000"}`
- 响应验签：可选校验响应里的 `sign`（**签名范围只覆盖 `data`**，见「响应验签」一节）
- 3 个端点便捷方法 + 通用 `request()`
- GET 无关：所有端点均为 `POST`；网络/超时/5xx 自动重试（指数退避），4xx 不重试
- 运行时依赖只有 `requests` + `cryptography`

## 安装

```bash
pip config set global.index-url https://cnb:[你的CNB访问令牌]@pypi.cnb.cool/h1s97x/pypi/-/packages/simple
pip install xyj-api
```

## 用法

```python
from xyj_api import XyjClient, is_success
from xyj_api.envelope import extract_data, extract_task_no

# 一个 client = 一套网关凭据。
# 上下游与报告是不同网关、不同私钥，因此各建一个实例。
upstream = XyjClient(
    base_url="http://gw-a:58085",
    org_code="WHYH001",
    org_name="某某银行",
    private_key=UPSTREAM_PRIVATE_KEY,   # Base64 PKCS#8 裸体或完整 PEM 均可
    tls_verify=True,
    max_attempts=3,
)

env = upstream.query_general_data("某企业有限公司", "91330000TEST0000XX", data_key="220_xxx")
if is_success(env):
    parsed = XyjClient.parse_upstream_downstream(extract_data(env) or [])
    print(len(parsed["upstream"]), len(parsed["downstream"]))

# 报告：申请 → 取 taskNo → 查询
report = XyjClient(
    base_url="http://gw-b:8082",
    org_code="WHYH001",
    org_name="某某银行",
    private_key=REPORT_PRIVATE_KEY,
)
applied = report.apply_report("某企业有限公司", "91330000TEST0000XX", report_key="803_PRE_CREDIT_REPORT_V1.0")
task_no = extract_task_no(applied)
if task_no:
    result = report.query_report(task_no)   # 轮询编排由消费方实现
```

### 从环境变量构造

```bash
export XYJ_BASE_URL=http://gw-a:58085
export XYJ_ORG_CODE=WHYH001
export XYJ_ORG_NAME=某某银行
export XYJ_PRIVATE_KEY=<base64 pkcs8>
export XYJ_PUBLIC_KEY=<base64 public key>   # 可选：开启响应验签
```

```python
client = XyjClient.from_env()
```

### 响应验签

传 `verify_public_key`（或设 `XYJ_PUBLIC_KEY`）即对每个响应验签，失败抛 `ResponseVerifyError`：

```python
client = XyjClient(
    base_url="http://gw-a:58085",
    org_code="WHYH001",
    org_name="某某银行",
    private_key=UPSTREAM_PRIVATE_KEY,
    verify_public_key=UPSTREAM_PUBLIC_KEY,   # 就是交给网关的那把公钥
)
```

**签名范围（实测反推，非猜测）**：`sign = SHA1withRSA(canonicalize_value(data))`，
用**消费方自己密钥对的私钥**签，故用配对公钥即可验签。

> ⚠️ `code` / `msg` / `timestamp` / `success` **不在签名范围内**（同一请求两次调用
> `timestamp` 变而 `sign` 不变，可证）。因此验签只保证 `data` 未被篡改，
> **不能**替代 HTTPS —— 改写 `success: true` 不会被发现。
>
> ⚠️ 该口径由「空 `data` 样本」反推；拿到非空样本后用 `xyj verify-probe` 复核。

### 错误处理

业务失败**不抛异常**（信封里带 `code`/`msg`，用 `is_success()` 判定）；
只有传输层/本地配置问题才抛：

```python
from xyj_api import (
    ConfigError,
    ResponseVerifyError,
    SignatureError,
    UpstreamError,
    ValidationError,
)

try:
    env = client.query_general_data("某企业", "9133", data_key="220_x")
except UpstreamError as exc:      # 网络/超时/重试耗尽/响应非 JSON
    ...
except (ConfigError, SignatureError) as exc:  # 本地配置/私钥问题
    ...
except ResponseVerifyError as exc:  # 开启了 verify_public_key 且验签失败
    ...
```

## 命令行（CLI）

安装后自带 `xyj` 命令（也可 `python -m xyj_api`）。**零额外依赖**（标准库 `argparse`）：

```bash
xyj capabilities        # 列出端点（离线）
xyj doctor              # 检查配置 + 私钥 + 签名自检（离线；私钥/签名自动脱敏）
xyj doctor --public-key "$UPSTREAM_PUBLIC_KEY"   # 顺带做一次公私钥配对自检，不配对则退出码 3

xyj verify-probe --company "某企业有限公司" --nsrsbh "91330000TEST0000XX" --data-key "220_xxx" \
  --public-key "$UPSTREAM_PUBLIC_KEY"   # 拉一次真实响应，核对 sign 的签名范围
xyj upstream --company "某企业有限公司" --nsrsbh "91330000TEST0000XX" --data-key "220_xxx"
xyj report-apply --nsrmc "某企业有限公司" --nsrsbh "91330000TEST0000XX" --report-key "803_PRE_CREDIT_REPORT_V1.0"
xyj report-query --task-no "T-123"
```

连接/凭据缺省读 `XYJ_*` 环境变量或 `.env`，也可逐个传：

```bash
xyj upstream --company .. --nsrsbh .. --data-key .. \
  --base-url http://gw:58085 --org-code WHYH001 --org-name 某某银行 --private-key "$UPSTREAM_KEY"
```

其它开关：`--timeout`、`--max-attempts`、`--insecure`、`--json`（输出原始信封）、
`--public-key`（响应验签；`doctor` 会顺带做一次公私钥配对自检）。

退出码：`0` 成功 / `1` 业务失败（信封 code 非成功）/ `2` 用法错误 /
`3` 配置或传输错误（含 `doctor` 的公私钥配对自检失败）。

## 边界

SDK **只做协议**：签名、HTTP、信封、3 端点。以下留在消费方：

- 数据库缓存（如 `invoice_flow_customers` 落库/查库）
- 「先查库 → 查不到调接口 → 写回」编排、报告轮询
- 扫码授权回调页、审计日志
- 按金额排序取前 N 等展示策略

`parse_upstream_downstream()` 只做**方向切分与字段改名**，不排序、不截断。
