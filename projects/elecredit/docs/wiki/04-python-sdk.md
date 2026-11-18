# 04 · Python SDK 模块详解

子项目根：`/workspace/sdk`（包名 `elecredit`，v0.1.0，MIT，requires-python ≥ 3.10）

> ⚠️ 根 `README.md` / `AGENTS.md` 写作 `python/toolkit/elecredit/`，实际路径是 **`sdks/python/elecredit/`**；`AGENTS.md` 中提到的 `scripts/elecredit.py`、`elecredit_client.py` **均不存在**。

## 4.1 包结构

```
sdks/python/
├── elecredit/
│   ├── __init__.py       门面：ElecreditClient + 12 个模块级函数 + 异常 + 签名工具
│   ├── __main__.py       python -m elecredit → cli.main()
│   ├── _version.py       __version__ = "0.1.0"
│   ├── client.py         ElecreditClient（核心，297 行）
│   ├── endpoints.py      ENDPOINTS 注册表
│   ├── signature.py      签名 + 黄金样本自测试
│   ├── envelope.py       响应解析 + 错误分类
│   ├── errors.py         异常层次
│   ├── credentials.py    凭据探测链
│   └── cli.py            Typer CLI
├── tests/
│   ├── conftest.py                 sys.path 注入项目根
│   ├── test_signature.py           签名相关用例（9）
│   ├── test_errors.py              错误分类参数化用例（13）
│   ├── test_endpoints.py           注册表完整性用例（14）
│   ├── test_product_payload.py     产品码解包 / 探测（17）
│   ├── test_judicial_params.py     D11 参数构造与校验（18）
│   ├── test_judicial_summary.py    D11 汇总视图（11）
│   ├── test_judicial_all.py        D11 扇出（22）
│   ├── test_cli.py                 Typer CLI（44）
│   ├── test_version.py             版本号一致性（2）
│   └── test_client_integration.py  生产集成测试（mark: integration）
├── pyproject.toml
└── README.md
```

## 4.2 模块职责表

| 模块 | 职责 |
|------|------|
| `__init__.py` | 重导出 `ElecreditClient`、`ENDPOINTS`、`Endpoint`、`endpoint_product_code`、`product_payload`、`detect_product_code`、6 个异常、`sign_request`、`verify_golden_sample`、`GOLDEN_SAMPLE`；提供 `fuzzy/deep/scale/tax/admin_punishment/judicial/xgbzxr/graph/bidding/actual_controller` 模块级便捷函数（内部每次 `from_env()` 新建 client） |
| `__main__.py` | `python -m elecredit` 入口 |
| `client.py` | HTTP 双实现（requests / urllib）+ 签名 + 重试 + 10 个便捷方法 + 通用 `query()` |
| `endpoints.py` | `ENDPOINTS: dict[str, Endpoint]`（`Endpoint` 是 `NamedTuple`：`code`/`path`/`description`/`paging`/`product_code`），以及 `endpoint_path()` / `endpoint_id()` / `endpoint_product_code()` |
| `signature.py` | `SignedRequest` dataclass、`compact_json`、`sign_request`、`GOLDEN_SAMPLE`、`verify_golden_sample` |
| `envelope.py` | **`ERROR_CONTRACT`（跨语言唯一真源）**、`contract_for`、`classify_error`、`parse_response`、`is_success`、`extract_result_data`、`product_payload`、`detect_product_code` + 由契约反查出的三组码集合 |
| `errors.py` | `ElecreditError` 基类 + 5 个子类 |
| `credentials.py` | `Credentials` dataclass + `resolve_credentials()` |
| `cli.py` | Typer 应用：`capabilities` + 10 命令（**描述符驱动**，由 `CLI_SPEC` 生成签名）；`_invoke` / `_emit` / `_handle_error` / `_err_exit` |

## 4.3 关键类与函数

### `class ElecreditClient` — `client.py`

```python
ElecreditClient(
    app_id: str,
    app_key: str,
    base_url: str = "https://api.elecredit.com",
    timeout: float = 15.0,        # 常规端点
    graph_timeout: float = 60.0,  # 仅 graph 端点
    max_attempts: int = 3,
)
ElecreditClient.from_env(base_url=DEFAULT_BASE_URL) -> ElecreditClient   # 类方法工厂
```

构造即校验：`app_id` 或 `app_key` 为空 → `ValueError("app_id 和 app_key 都不能为空")`；`base_url` 去尾部斜杠。

| 方法 | 说明 |
|------|------|
| `_post(path, body, *, timeout=None)` | 签名一次 → 循环最多 `max_attempts` 次调用 `_do_post`；`SYS005` 与 `SYS001/002/003/004/006` **立即抛出不重试**；其余 `sleep(2**attempt * 0.1)` 后退避 |
| `_do_post(path, signed, timeout)` | 组装 headers（`SignedRequest.as_headers(app_id)` + `Content-Type`），按 `_HAS_REQUESTS` 分派 |
| `_post_requests(...)` | `requests.post`；`Timeout`→`UpstreamError("TIMEOUT")`；`ConnectionError`→`UpstreamError("NETWORK")` |
| `_post_urllib(...)` | `urllib.request.urlopen(..., context=ssl.create_default_context())`；`HTTPError`→`classify_error`；`URLError`→`UpstreamError("NETWORK")`；`TimeoutError`→`UpstreamError("TIMEOUT")` |
| `query(endpoint_key, **kwargs)` | 通用调用：查 `ENDPOINTS` → 选超时（graph 用 `graph_timeout`）→ 成功返回 `extract_result_data`，否则 `raise classify_error(...)` |
| `fuzzy / deep / scale / tax / admin_punishment / judicial / xgbzxr / graph / bidding / actual_controller` | 10 个便捷方法，内部构造 body 后调 `query()`（与 Node CLI 命令、REST 契约一一对应；B04/P0020019 的字段是 `entInfo`，D11 是 `entityName`；实控人路径是大小写敏感的小写 `SaicinvWh`） |
| `judicial_summary(entity_name)` | **D11 汇总视图**（非端点方法）：1 次调用返回 `{totalCount, totalPage, types: {12 类: {count, pages}}, meta, …}`。用于「这家公司各类诉讼有多少」；要明细再按 `type` 逐类型取。内部**不传分页参数**（曾试 `range=1` 压小返回体，但那会让上游按每页 1 条重算 `totalPage`，语义被改坏） |
| `judicial_all(entity_name, *, types=None, max_pages=1, range=20, concurrency=1)` | **D11 多类型明细扇出**：先 1 次汇总，再对**计数非 0** 的类型各取首页（`max_pages` 按该类型总页数自动夹紧，防 `pageNo` 超界 `999`），跨类型按 `entryId` 去重后分桶。返回 `{summary, byType(恒定 12 键), records, fetched, errors, truncated, calls}`；`calls` 即实际计费调用次数。单类型失败只进 `errors`，不影响其它类型 |

**10 个便捷方法签名**

```python
fuzzy(ent_name, *, type=None, region_id=None, page_no=None, range=None) -> Any
deep(*, ent_name=None, credit_code=None, reg_no=None, org_code=None) -> Any   # 4 选 1，全空 ValueError
scale(ent_info) -> Any
tax(entity_name, *, type=None, page_no=None, range=None) -> Any
admin_punishment(ent_info, *, type=None, page_no=None, range=None, start_date=None, end_date=None) -> Any
judicial(entity_name=None, *, type=None, page_no=None, range=None, ent_name=None) -> Any
#   ↑ D11：标识字段是 entityName；type 单值（见 client.D11_TYPES）；range ≤ 20；ent_name 为兼容旧名
xgbzxr(pers_name, id_no) -> Any
graph(ent_info, *, level=None, down=None, up=None) -> Any
bidding(ent_info, *, page_no=None, range=None, position=None, start_date=None, end_date=None) -> Any
actual_controller(ent_info) -> Any
```

所有方法只把非 `None` 的参数放进 body；`deep()` 通过 `locals()[py_key]` 遍历四个标识字段。

> 注意：`range` 与 `type` 是 Python 内置名，被有意用作参数名（与 API 字段一致）。

### `ENDPOINTS` — `endpoints.py`

```python
class Endpoint(NamedTuple):
    code: str                       # 接口编号（短码；P0020019 上游只给产品码，故与 product_code 相同）
    path: str
    description: str
    paging: bool
    product_code: str | None = None # 计费产品码，见下表；None = 尚未实测

ENDPOINTS: dict[str, Endpoint] = {
    "fuzzy":            Endpoint("A07", "/mohu/wh",                    "企业工商模糊查询",        True,  "P0010068"),
    "deep":             Endpoint("A03", "/saic/enterprise/deep/wh",    "企业工商深度查询",        False, "P0010058"),
    "scale":            Endpoint("A04", "/enterprise/companyLevel/wh", "企业大中小微划型",        False, "P0010070"),
    "tax":              Endpoint("B06", "/enterprise/taxInfo",         "企业税务信用查询",        True,  "P0030125"),
    "admin_punishment": Endpoint("D07", "/enterprise/adminPunishment", "行政处罚",                True,  "P0030126"),
    "judicial":         Endpoint("D11", "/risk/sifaInfo/wh",           "企业司法模糊查询",        True,  "P0030089"),
    "xgbzxr":           Endpoint("D14", "/litigation/xgbzxrPeople/wh", "限消人员",                False, "P1020054"),
    "graph":            Endpoint("F09", "/saic/equityPenetration",     "企业股权图谱（60s 超时）", False, "P0020023"),
    "bidding":          Endpoint("B04", "/enterprise/biddingYPageWh",  "招投标信息",              True,  "P0010034"),
    "actual_controller":Endpoint("P0020019", "/saic/SaicinvWh",        "实控人（法人/股东穿透）",  False, "P0020019"),
}

endpoint_path(key) -> str            # → ENDPOINTS[key].path（下标 [1] 仍可用）
endpoint_id(key)  -> str             # → ENDPOINTS[key].code（下标 [0] 仍可用）
endpoint_product_code(key) -> str | None   # → ENDPOINTS[key].product_code
```

**产品码**（`resultData` 里 `<产品码>Data` / `<产品码>Status` 的码部分）：

| key | 短码 | 产品码 | 来源 |
|-----|------|--------|------|
| fuzzy | A07 | `P0010068` | 本仓库实测 |
| deep | A03 | `P0010058` | 消费方 registry |
| scale | A04 | `P0010070` | 消费方 registry |
| tax | B06 | `P0030125` | 消费方 registry |
| admin_punishment | D07 | `P0030126` | 消费方 registry |
| judicial | D11 | `P0030089` | 消费方 registry |
| xgbzxr | D14 | `P1020054` | 本仓库实测 |
| graph | F09 | `P0020023` | 本仓库实测 |
| bidding | B04 | `P0010034` | 本仓库实测 |
| actual_controller | P0020019 | `P0020019` | 本仓库实测 |

**兼容性**：`NamedTuple` 保住了**下标访问**（`ENDPOINTS[key][1]` 照旧可用），
但 **4 元组解包会失效**（字段由 4 个变 5 个）：`a, b, c, d = ENDPOINTS[key]` 需改为
`ep = ENDPOINTS[key]` 后取属性，或用上面三个 helper。

`paging` 字段当前**未被代码消费**，仅作元数据（与 Node CLI 描述符、契约文档对齐用）。

### `signature.py`

```python
@dataclass(frozen=True)
class SignedRequest:
    request_sn: str; timestamp_ms: str; signature: str
    sign_type: str = "MD5"; body_string: str = ""
    def as_headers(self, app_id: str) -> dict[str, str]:
        # → {app-id, timestamp, request-sn, signature, sign-type}

compact_json(body) -> str     # json.dumps(ensure_ascii=False, separators=(",", ":"))
sign_request(body, app_key) -> SignedRequest
GOLDEN_SAMPLE: dict           # 凭据从 ELECREDIT_APP_ID / ELECREDIT_APP_KEY 读取（禁止硬编码）
verify_golden_sample() -> bool  # 自测试：手工复算 md5 比对 + 打印签名
```

> 历史版本把一对生产凭据硬编码在 `GOLDEN_SAMPLE` 中（已改为环境变量读取）。
> 那对凭据**必须轮换**。

`python -m elecredit.signature` 可直接运行自测试，成功 exit 0。

### `envelope.py`

```python
# 错误契约（唯一真源）：码 → (category, exit_code, retryable)，共 19 条
ERROR_CONTRACT: dict[str, tuple[str, int, bool]] = {"SYS001": ("authentication", 3, False), ...}
CODE_HINT: dict[str, str]                         # 各码专属 hint
contract_for(code, http_status=None) -> tuple[str, int, bool]
BILLING_CODES    = _sys_codes_in("billing")        # {"SYS005"}
AUTH_CODES       = _sys_codes_in("authentication") # {"SYS001".."SYS004", "SYS006"}
RATE_LIMIT_CODES = _sys_codes_in("rate_limit")     # {"SYS008"}

parse_response(raw_text) -> dict          # JSON 解析，空串 → {}
is_success(envelope) -> bool              # code in ("", "000", "001")
extract_result_data(envelope) -> Any      # envelope["resultData"]（外层，未解产品码）
classify_error(code, msg, raw=None, *, http_status=None) -> ElecreditError

# 产品码解包（纯新增，不改上面任何函数的行为）
detect_product_code(payload) -> str | None        # 探测 "[产品码]Data" 里的码，如 "P0030089"
product_payload(payload, code=None) -> dict       # 取内层业务体；未命中 {}，永不抛
```

`classify_error` 判定顺序：**码表 → `429` → `5xx` → `4xx` → code 以 `4` 开头 → code 以 `5`
开头 → `UNKNOWN_CODE`**（与 Node 的 `contractFor()` 顺序一致，顺序不同会得到不同分类）。
拿到契约三元组后按 `category` 选异常类，并把 `category` / `exit_code` / `retryable` / `hint`
写进异常实例。

> **2026-10-12 对齐前**：这三个字段是写死在 if/elif 分支里的，于是 Python 与 Node 各有一套
> 口径（SYS005 一边 `billing` 一边 `authentication`、SYS008 一边 `rate_limit` 一边 `upstream`、
> 999/5xx 一边退出码 4 一边 5、未识别码一边 4 一边 6）。现在唯一真源是同名 `ERROR_CONTRACT`，
> 跨语言一致性由 `sdks/typescript/tests/error-contract-consistency.test.ts` 双向校验。

`product_payload` / `detect_product_code` 的入参**既可以是完整信封，也可以是 `resultData` 本身**
（后者正是 `client.judicial(...)` 这类便捷方法在非 raw 模式下的返回值）：

```python
product_payload(client.query("judicial", raw=True, entName="贵州茅台"))  # 完整信封
product_payload(client.judicial(entity_name="贵州茅台"))                  # resultData 本身
product_payload(raw, "P0030089")                                        # 精确指定产品码
```

不传 `code` 时**按结构探测**（匹配 `^P\d+Data$`），所以上游换产品码也不会失效 ——
这是为了替掉消费方原先的硬编码兜底（`result_data.get("P0030089Data") or ...`）。
`resultData` 是 JSON 字符串时同样能解；异常输入一律返回 `{}`。

### `errors.py`

```
ElecreditError(code, msg, raw=None)      # 基类；__eq__/__hash__ 按 (code, msg)；str → "[code] msg"
├── AuthError         SYS001/002/003/004/006
├── BillingError      SYS005（签名已通过，正常业务响应）
├── RateLimitError    SYS008 / HTTP 429
├── ValidationError   HTTP 4xx / code 以 4 开头
└── UpstreamError     HTTP 5xx / NETWORK / TIMEOUT
```

### `credentials.py`

```python
@dataclass(frozen=True)
class Credentials:
    app_id: str; app_key: str; source: str = "environment"
    def is_valid(self) -> bool: ...

resolve_credentials(app_id=None, app_key=None) -> Credentials
```

探测顺序：

1. 两个参数都显式传入 → `source='explicit'`
2. 依次尝试加载 `./.env`、`~/.elecredit/.env`（`override=False`；无 `python-dotenv` 时静默跳过）
3. `ELECREDIT_APP_ID` + `ELECREDIT_APP_KEY` 同时非空 → `source='environment'`
4. 都没有 → `ValueError("未找到凭据。请设置 ELECREDIT_APP_ID + ELECREDIT_APP_KEY")`

### `cli.py`

- 运行时探测 `typer`；缺失时 `_HAS_TYPER=False`，`main()` 打印安装提示并 `exit(1)`。
- **描述符驱动**（2026-10-12 起）：10 个端点子命令不再各写一个函数，而是由 `CLI_SPEC` 数据表
  经 `_build_command()` 生成签名后注册。每个条目声明
  `command` / `help` / `method` / `options` / `positional` / `keyword` / `prepare`，
  执行体统一收敛在 `_invoke()`（预处理 → 建客户端 → 调用 → `_emit` / `_handle_error`）。
  生成签名用了 `exec`：Typer 只从**函数签名**里取选项，`**kwargs` 承接的话一个选项都看不到；
  重构前是靠「10 个函数里手抄签名」走通的，那正是被消灭的重复。
- 全局选项：`--app-id`、`--app-key`、`--output/-o`（由生成器统一追加，不在表里重复声明）。
- 命令：`capabilities` + 10 个端点命令 `fuzzy`、`deep`、`scale`、`tax`、`admin-punishment`、
  `judicial`、`xgbzxr`、`graph`、`bidding`、`actual-controller`。
  `tax` / `judicial` 分别是 Node 侧 `tax-credit` / `judicial-fuzzy` 的扁平短名
  （两套 CLI 命名风格差异，已在一致性测试里登记为别名，新增差异必须先改那张表）。
- 跨语言守护：`sdks/typescript/tests/endpoint-contract-consistency.test.ts` 直接解析本表，
  断言「子命令名 ↔ Node 叶子名（含登记别名）」与「Python 选项 ⊆ Node 描述符选项」。
- 本地前置校验：D11 的 `--type` 白名单（`_prepare_judicial`）、`graph` 的
  `--down/--up` 把 `False` 归一为 `None`（`_prepare_graph`）——都在 `CLI_SPEC` 的 `prepare` 里声明。
- `_emit(result, output)`：`{"ok": true, "data": result}`（ensure_ascii=False, indent=2）；给了 `--output` 则写文件并打印「已写入 [path]」。
- `_handle_error(e)` → `_err_exit(exit_code, category, code, msg)`：

| 异常 | category | 退出码 | retryable |
|------|----------|-------|-----------|
| `BillingError` | `billing` | 3 | 否 |
| `AuthError` | `authentication` | 3 | 否 |
| `RateLimitError` | `rate_limit` | 4 | 是 |
| `ValidationError` | `validation` | 2 | 否 |
| `UpstreamError` | `upstream` | 4 | 是（`SYS044` 例外：否） |
| 其他 `ElecreditError` | `upstream` | 4 | 是 |
| 非预期异常 | —（信封只有 `message`） | 1 | — |

错误信封形状：`{ok:false, error:{code, category, message, hint?, retryable}}` —— 字段与顺序
与 Node 的 `commands/error-output.ts` **逐字一致**。退出码 `5`、`6` 已退回保留位（对齐前
Python 分别用它们表示 upstream / unknown）。判断依据全部来自异常自身的契约字段，
`_handle_error` 不再有 if/elif 映射。

- `_make_client`：显式参数优先，否则 `from_env()`；失败打印到 stderr 并 `exit(3)`。

## 4.4 模块级便捷函数（`__init__.py`）

```python
from elecredit import fuzzy, deep, scale, tax, admin_punishment, judicial, xgbzxr, graph, bidding, actual_controller
fuzzy(ent_name="贵州茅台")            # 内部 _global_client().fuzzy(...)
```

每个调用都会 `ElecreditClient.from_env()` 新建 client —— **批量调用请复用 `ElecreditClient` 实例**，避免重复解析凭据。

## 4.5 测试

| 文件 | 覆盖 |
|------|------|
| `test_signature.py` | 中文不转义、`SignedRequest` 字段长度、公式手工复算、headers 组装、黄金样本 body、签名不在 body 内，以及**安全回归**（源码不得出现 32 位 hex key / 长数字 App ID 字面量） |
| `test_errors.py` | 各码集合参数化分类、HTTP 400/429/500、兜底、异常相等性、`str(err)` 含 code 与 msg |
| `test_endpoints.py` | 恰好 10 个端点（8 契约 + B04 + 实控人）、键集合、路径以 `/` 开头且唯一、graph 描述含 "60s"、`endpoint_id`/`endpoint_path`，以及**大小写回归护栏**（实控人路径必须是小写 `SaicinvWh`） |
| `test_product_payload.py` | 产品码解包与结构探测（`product_payload` / `detect_product_code`），含上游换码、空壳、缺键等形态 |
| `test_judicial_params.py` | D11 真实契约：标识字段是 `entityName`（`entName` 一律 400）、`type` **单值**（12 个实测前缀；旧文档那套 `xsy`/`xcr` 全非法）、`range` 上限 20（21 返回 999 而不是静默截断） |
| `test_judicial_summary.py` | D11 汇总：`types` 恒定 12 项（上游空串 / 整键缺失都归一为 0，计数是字符串 → int）、`001 查无数据` 返回全 0 而不抛异常 |
| `test_judicial_all.py` | D11 扇出（离线 mock）：只对计数非 0 的类型调用、`max_pages` 按 `{t}PageNum` 自动夹紧、跨类型按 `entryId` 去重、单类型失败只进 `errors` 不影响其它类型 |
| `test_cli.py` | **Typer CLI**：10 个命令的「选项 → 客户端调用参数」全量精确比对（省略的选项必须是 `None`）、错误分类 → exit code（与 `SKILL.md` 错误分类表一致）、`--output` 落盘、D11 `type` 白名单本地前置拦截、无 typer 时的降级提示 |
| `test_version.py` | 版本号一致性（解析 `pyproject.toml` 与 `_version.py`） |
| `test_client_integration.py` | `pytestmark = integration`；无凭据自动 skip；对 `ENDPOINTS` 全部端点（现 10 个）各发最小参数请求，`BillingError` 视为**签名通过**，`AuthError` 视为失败 |

`pyproject` 注册 markers：`integration`（需真实凭据）、`slow`（>1s）。ruff 规则 `E,F,I,N,W,UP`，忽略 `E501`，line-length 100，target py310。

**覆盖率门槛**（2026-10-12 加）：CI 跑 `pytest --cov=elecredit --cov-fail-under=74`。门槛由 55 抬高而来 —— P2-8 补上 `cli.py` 的测试后，`cli.py` 自身 0% → 97%、总覆盖率 55.78% → 76.53%，门槛得以跟着水位走。留约 2.5pt 余量吸收 Python 3.10 / 3.12 的统计差异。

> 上表的用例数（9/13/14/…）是 2026-10-12 的实测值，会随迭代变化；`pyproject` 的覆盖率门槛才是硬约束，用例数只是快照。
