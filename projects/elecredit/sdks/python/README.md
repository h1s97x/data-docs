# Elecredit Python SDK

企业风控数据 Python SDK，提供 **10 个**端点便捷方法：工商模糊/深度查询、大中小微划型、税务信用、行政处罚、
司法（12 种 type）、限消人员、企业股权图谱、招投标（B04）、实控人（P0020019）。
10 个端点与 Node CLI 的 10 个子命令、`docs/api/elecredit` 的 10 篇契约**三处一一对应**（有跨端一致性测试守着）。

## 安装

```bash
cd sdks/python
pip install -e ".[dev]"
```

或直接使用（纯标准库模式，无需安装）：

```python
import sys; sys.path.insert(0, "sdk")
from elecredit import ElecreditClient, fuzzy, graph
```

## 快速开始

```python
from elecredit import ElecreditClient

client = ElecreditClient.from_env()

client.fuzzy(ent_name="贵州茅台")
client.deep(ent_name="贵州茅台")
client.scale(ent_info="贵州茅台")
client.tax(entity_name="贵州茅台", type="satpartyXin")
client.admin_punishment(ent_info="贵州茅台")
client.judicial(entity_name="贵州茅台", type="ktgg", range="20")   # D11：entityName + 单值 type
client.xgbzxr(pers_name="许家印", id_no="110101195804261234")
client.graph(ent_info="贵州茅台", level="2")   # 60s 超时
client.bidding(ent_info="贵州茅台")            # B04 招投标（SDK 独有，不在 REST 契约内）
client.actual_controller(ent_info="国家电网有限公司")   # P0020019 实控人（同上）
```

或用模块级便捷函数（从环境变量读凭据）：

```python
import os
os.environ["ELECREDIT_APP_ID"] = "..."
os.environ["ELECREDIT_APP_KEY"] = "..."

from elecredit import fuzzy, graph
result = fuzzy(ent_name="贵州茅台")
```

### 网关地址（公网 / 内网）

`from_env()` 按「显式入参 > `ELECREDIT_BASE_URL` > `https://api.elecredit.com`」解析网关地址：

```python
from elecredit import ElecreditClient

public = ElecreditClient.from_env()                     # 公网默认
internal = ElecreditClient(app_id="...", app_key="...",
                           base_url="http://[内部网关]/...")  # 内网
```

内网只换 host：签名 `sn + ts + body + appKey` 与紧凑中文 JSON 逐字节不变，
`tests/test_base_url.py` 对此逐字节锁住。两个实务前置条件：签名用毫秒时间戳，机器时钟不同步会吃
`SYS002`；出口 IP 变化后需服务商加白，否则 `SYS006`。

### 端点口径：三端一致（10 端点）

| 端口 | 对应物 |
|------|--------|
| Python SDK | `ENDPOINTS` 10 项（`Endpoint` NamedTuple，含产品码）+ `ElecreditClient` 10 个便捷方法 + `elecredit-py <cmd>` 10 个子命令 |
| Node CLI | `remoteCapabilities` 10 个描述符 → `elecredit-py [group] <name>` 10 个子命令 |
| REST 契约 | `docs/api/elecredit/` 10 篇端点文档 |

三处由 `sdks/typescript/tests/endpoint-contract-consistency.test.ts` 交叉校验（id、路径、文档三向对齐），
避免再出现「代码 10 个、文档 8 个」这类漂移。

仍可用通用 `post()` 直达任意路径（含未注册端点），返回完整信封：

```python
client.post("/enterprise/biddingYPageWh", {"entInfo": "贵州茅台"})     # B04（等同 client.bidding(...)）
```

两个端点的实测坑（已写进代码注释、`docs/api` 与 `docs/wiki/08`）：

| 端点 | 坑 |
|------|-----|
| `B04 /enterprise/biddingYPageWh` | 参数名必须是 `entInfo` —— 传 `entName` 报 `400 企业信息不能为空` |
| `P0020019 /saic/SaicinvWh` | **路径大小写敏感**：`SaicInvWh` 返回 `SYS044 资源不存在`，可用的是小写 w 的 `SaicinvWh`；参数名同样是 `entInfo`。历史提交 4a5d9eb 把大小写改反了，端点因此长期打不通，且因为无凭据时集成测试整体 skip，一直没被发现 |

### 产品码解包（`product_payload`）

上游把业务体再包一层：`resultData = {"[产品码]Status": ..., "[产品码]Data": {...}}`，
产品码各端点不同（完整对照见 `ENDPOINTS[key].product_code` 与
[docs/api/elecredit/README.md](../../docs/api/elecredit/README.md)）。

```python
from elecredit import product_payload, detect_product_code

raw = client.query("judicial", raw=True, entityName="贵州茅台")  # 完整信封
product_payload(raw)              # 自动探测产品码 → 内层业务体
product_payload(raw, "P0030089")  # 也可精确指定

# 便捷方法返回的本来就是 resultData，可直接喂进去：
product_payload(client.judicial(entity_name="贵州茅台"))

detect_product_code(raw)          # "P0030089"；与注册表比对可发现上游改码
```

- **不传产品码时按结构探测**（匹配 `^P\d+Data$`），因此**上游换了产品码也不会失效** ——
  不必再写 `result_data.get("P0030089Data") or ...` 这类硬编码兜底。
- 未命中返回 `{}`，**永不抛异常**；`resultData` 是 JSON 字符串时也照样解。
- `query()` 的默认返回**未改动**（仍是 `resultData`），以上均为纯新增。

### 司法数据汇总（`judicial_summary`）

D11 的 `type` 是**单值**、不支持逗号多选，而聚合返回的 `detailList` 里 `annoType` 是空串 ——
想按类型分组取明细只能逐类型扇出（12 次调用）。这个函数是那个扇出的**第一步**单独拿出来用：
**1 次调用**拿到「各类型有多少条 / 多少页」。

```python
from elecredit import judicial_summary

s = judicial_summary("恒大地产集团有限公司")
s["totalCount"]        # 52713
s["totalPage"]         # 5272（按默认每页 10 条算）
s["types"]["ktgg"]     # {"count": 16723, "pages": 1673}
s["types"]["pccz"]     # {"count": 0, "pages": 0}
s["meta"]              # 原始 detailListMeta，未识别字段不丢
```

- `types` **恒定包含 12 项**（合法类型见 `elecredit.client.D11_TYPES`）：上游对无数据的类型
  可能返回空串、也可能**整个键缺失**，两种都归一为 0；计数在上游是**字符串**，这里统一为 `int`。
- 查无司法数据（业务码 `001`）返回全 0 汇总，**不抛异常**。
- 要明细再逐类型取：`judicial("恒大地产集团有限公司", type="ktgg", page_no="1", range="20")`
  （`range` 上限 20，`pageNo` 超出总页数会返回 `999 系统异常`）。

### 多类型明细扇出（`judicial_all`）

`judicial_summary` 只给计数；要**每个非空类型都有代表记录**就得逐类型取 —— `judicial_all` 把这套编排包好了：

```python
r = judicial_all("恒大地产集团有限公司")            # 默认：每类型 1 页
r["calls"]          # 7  = 1 次汇总 + 6 个「有数据」的类型各 1 页
r["byType"]["ktgg"] # 该类型取到的记录列表（12 个键恒定）
r["fetched"]        # {"ktgg": 20, ...} 各类型实际取到的条数（已去重）
r["truncated"]      # True = 有类型没取全（计数 > 已取页数 × range）
r["errors"]         # {}；单类型失败只记录，不影响其它类型
```

- **省调用的关键**：先读 `detailListMeta`，**计数为 0 的类型直接跳过**（恒大 12 个类型里只有 6 个有数据 → 7 次而不是 13 次）。
- **自动夹紧页数**：`max_pages` 会按该类型的总页数收敛，避免 `pageNo` 超界返回 `999 系统异常`。
- **跨类型按 `entryId` 去重**（实测同一类型的同一页里就会出现重复记录）；没有 `entryId` 时退回稳定序列化。
- ⚠️ **计费**：每次分页都是一次计费调用。`max_pages` 会成倍放大（上限 100），返回值里的 `calls` 是实际次数。
- `concurrency=1`（默认）串行；>1 用线程池并发，注意限流 `SYS008` 与计费峰值。

> 顺带一个实测发现：**聚合调用（不传 `type`）返回的记录自带 `type` 字段**（`annoType` 才是空串）。
> 所以"只想要第一屏混合明细"时不必扇出 —— 1 次 `judicial()` + 按记录的 `type` 自行分桶即可；
> 扇出的价值在于"每个类型都要有代表记录"（例如 `fygg` 共 2420 条，聚合首页只出现 1 条）。

## CLI

```bash
export ELECREDIT_APP_ID=...
export ELECREDIT_APP_KEY=...

pip install -e .
elecredit-py capabilities            # 列出 10 个端点元数据
elecredit-py fuzzy --ent-name 贵州茅台
elecredit-py bidding --ent-info 贵州茅台
elecredit-py actual-controller --ent-info 国家电网有限公司
elecredit-py graph --ent-info 贵州茅台 --level 2 --output graph.json
elecredit-py xgbzxr --pers-name 许家印 --id-no 110101195804261234
```

## 凭据探测

| 优先级 | 来源 |
|--------|------|
| 1 | `ElecreditClient(app_id=..., app_key=...)` 显式传入 |
| 2 | 环境变量 `ELECREDIT_APP_ID` + `ELECREDIT_APP_KEY` |
| 3 | `.env` 文件（项目根 `./.env` 或 `~/.elecredit/.env`，自动加载） |

## 错误分类

| 异常 | code | 含义 |
|------|------|------|
| `AuthError` | SYS001/SYS003 | 签名错或凭据无效 |
| **`BillingError`** | **SYS005** | **签名通过，余额不足（正常业务响应）** |
| `RateLimitError` | SYS008 | 频率限制 |
| `ValidationError` | HTTP 4xx | 参数错误 |
| `UpstreamError` | HTTP 5xx/NETWORK | 上游异常或超时 |

**关键**：`SYS005 余额不足` = 签名正确、凭据有效、API 可达。充值后拿真实数据。

## 签名算法

```
sn        = uuid.uuid4().hex
ts        = str(int(time.time() * 1000))
body      = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
signStr   = sn + ts + body + appKey
signature = MD5(signStr).hex()

# 签名放 HTTP Header（不是 body）
Content-Type: application/json
app-id:        [appId]
timestamp:     [ts]
request-sn:    [sn]
signature:     [md5_hex]
sign-type:     MD5
```

## 测试

```bash
cd sdks/python

# 单元测试（纯 mock，不需要凭据）
pytest tests/ -v

# 签名黄金样本（硬编码了生产凭据，验证算法正确）
python -m elecredit.signature

# 集成测试（需要真实凭据）
ELECREDIT_APP_ID=... ELECREDIT_APP_KEY=... \
  pytest tests/test_integration.py -v -s

# lint
ruff check elecredit/ tests/
```

## 项目结构

```
elecredit/
├── __init__.py              公共 API
├── __main__.py              python -m elecredit
├── _version.py
├── client.py                ElecreditClient 主类
├── signature.py             签名算法（含黄金样本自测试）
├── endpoints.py             10 端点注册表（与 Node CLI / docs 契约对齐）
├── errors.py                异常层次
├── envelope.py               响应信封 + 错误分类
├── credentials.py            凭据探测链
└── cli.py                   Typer CLI

tests/
├── conftest.py                  sys.path 注入项目根
├── test_signature.py            签名黄金样本
├── test_errors.py               错误码分类
├── test_endpoints.py            ENDPOINTS 注册表
├── test_product_payload.py      产品码解包与探测
├── test_judicial_params.py      D11 参数构造与校验
├── test_judicial_summary.py     D11 汇总视图 judicial_summary
├── test_judicial_all.py         D11 扇出 judicial_all
├── test_cli.py                  Typer CLI：选项 → 客户端调用映射、错误分类 exit code
├── test_version.py              版本号一致性
└── test_client_integration.py   生产集成测试（mark: integration，需真实凭据）
```

## 依赖

- **运行时**：typer + rich + python-dotenv + requests（都是可选兜底，urllib 也能跑）
- **零 pip install 模式**：仅用标准库

## 生产验证

端点均通过过签名校验（账户无余额时返回 `SYS005`、有余额时返回 `000`/`001`，都说明签名已通过）：
```python
# 跑一遍黄金样本验证签名算法
from elecredit.signature import verify_golden_sample
print(verify_golden_sample())  # True
```
