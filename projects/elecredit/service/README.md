# Elecredit 能力服务

> 面向**调用方**的接入文档见 [`docs/INTEGRATION.md`](../docs/INTEGRATION.md)
> （服务地址、Token 申请、Apifox 导入、免写码接入路径、上线检查）；
> 本文件面向部署与运维，机器契约见 [`openapi/service.yaml`](../openapi/service.yaml)。

把本仓库的 `sdks/python` SDK 包装成**可独立部署的长期运行 HTTP 服务**。
主仓（DueAgent）只发「能力名 + 企业名」，不接触服务商端点、产品码、
参数名、MD5 签名或 App ID / App Key。

## 为什么需要它

SDK 是库 + 一次性 CLI，自己不会监听端口；本服务是那个"一直开着的窗口"：

```
DueAgent backend（内网，零服务商代码）
   └─ HTTP /v1/query/[capability] ──Bearer──▶  elecredit-service（唯一出网节点）
                                                  ├─ ELECREDIT_APP_ID / APP_KEY
                                                  ├─ SDK 签名 + 10 原生端点
                                                  └─ api.elecredit.com
```

## 启动

```bash
# 1) 凭据（从 https://api.elecredit.com/admin 获取，只在服务端）
export ELECREDIT_APP_ID=...
export ELECREDIT_APP_KEY=...
export SERVICE_AUTH_TOKEN=<与主仓 ENTCREDIT_SERVICE_TOKEN 一致>

# 2a) 直接跑（零第三方依赖）
python -m service

# 2b) 容器
docker build -f service/Dockerfile -t elecredit-service .
docker compose -f service/compose.yml --env-file .env up -d

# 验证
curl http://127.0.0.1:8800/v1/ping
curl -X POST http://127.0.0.1:8800/v1/query/basic \
  -H "Authorization: Bearer $SERVICE_AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"company_name":"威海银行"}'
```

### 内网联调测试台（aarch64 / Docker）

gateway 模式要收窄响应解包器时，在**内网 aarch64 机器**上叠加调试层即可。离线包已自带
`images/python-3.12-slim-arm64.tar.gz`，脚本会先 `docker load` 再用 `--pull=false` 构建，
**全程不需要联网、不需要 pip install**：

```bash
# 先按 .env.example 填好 ELECREDIT_BASE_URL 与 ELECREDIT_GATEWAY_*，然后一键启动：
./start-gateway-debug.sh
```

脚本会校验 `.env`、在缺少注册表时签发测试台 Token（写入 `.local-ui-token`）、
按需创建 `DUEAGENT_NETWORK` Docker 网络、启动 compose 并等待 `/v1/ping`。
浏览器打开 `http://[内网机器IP]:8800/ui`（本机也可 `http://127.0.0.1:8800/ui`）：填调用方
Token、企业名，点「查询能力」看结构化结果，点「查看信封结构（脱敏）」拿字段名 / 类型 / 长度。
**调试层监听 `0.0.0.0:8800`，只应在内网使用，用完删除容器**；调试端点只回结构，不回任何值，
且由 `ELECREDIT_GATEWAY_DEBUG=1` 开启；生产不要叠加 debug 层。把脱敏结构截图回传即可收窄
`service/upstream.py:_business_body()`，不需要回传企业数据或原始报文。

上游协议按**协议形态**选择，不按内网/外网位置选择：

- `ELECREDIT_MODE=direct`（默认）：数据商原生 API，App ID / App Key + MD5 签名，
  Python SDK / Node CLI / 能力服务原有行为不变；`ELECREDIT_BASE_URL` 只换 host。
- `ELECREDIT_MODE=gateway`：统一网关 `POST /edsservice/api/gateway` + `eds_*` 平铺字段、
  无签名，服务号按显式映射表取值（前缀不统一，缺映射即失败）。该模式只在能力服务层
  适配，各语言 SDK 和 `openapi/service.yaml` 对外契约都不变；缺网关公共参数时
  fail closed，不回落到 direct。

gateway 模式所需变量见仓库根 `.env.example`（`ELECREDIT_GATEWAY_*`）；`ELECREDIT_BASE_URL`
在该模式下必须显式指向内网网关。响应形状已按内网实测收敛：同时处理
`data[].[产品码]Data`、`data[].resultData.[产品码]Data` 与 `data[].data` 三类主体壳，
单主体返回业务字典、多主体返回数组。

## 对外契约（能力级，网关门户共 11 个接口）

| 方法 | 路径 | 能力 |
|---|---|---|
| GET | `/v1/ping`、`/healthz` | 健康检查（不触达上游） |
| POST | `/v1/query/basic` | 工商基本信息（A03 / `iP0010058`，业务字段 `entName`） |
| POST | `/v1/query/scale` | 大中小微划型（A04 / `igongshangP0010070`） |
| POST | `/v1/query/risk` | 司法风险（D11 / `igongshangP0030089`，业务字段 `entityName`） |
| POST | `/v1/query/admin_punishment` | 行政处罚（D07 / `igongshangP0030126`） |
| POST | `/v1/query/tax` | 税务信用（B06 / `igongshangP0030125`，业务字段 `entityName`，`tax_type` 可选） |
| POST | `/v1/query/shareholding` | 股权穿透（F09 / `igongshangP0020023`，`level`/`ratio` 可选） |
| POST | `/v1/query/normalize` | 企业名称标准化（A07 / `igongshangP0010068`，业务字段 `entName`） |
| POST | `/v1/query/bidding` | 招投标信息（`igongshangP0010034`） |
| POST | `/v1/query/actual_controller` | 疑似实际控制人（`igongshangP0020019`） |
| POST | `/v1/query/restricted_consumer` | 人员限制高消费（`igongshangP1020054`，必填 `person_name` + `id_no`；旧 key `xgbzxr` 保留兼容） |
| POST | `/v1/query/judicial_comprehensive` | 董监高司法综合（`igongshangP1040010`，必填 `person_name`） |
| POST | `/v1/query/full` | 并发聚合 basic/scale/risk/shareholding，返回 `partial`/`modules`/`warning` |
| POST | `/v1/normalize` | `/v1/query/normalize` 的别名，企业名称标准化 |

请求体统一 `{"company_name": "..."}`（`tax`/`shareholding` 可带可选字段）。网关报文按接口文档
分流：`deep` / `fuzzy` / `judicial_comprehensive` 用 `entName`，`tax` / `judicial` 用
`entityName`，`restricted_consumer`（旧 `xgbzxr`）只用 `persName` + `idNo`，其余用 `entinfo`。
`judicial_comprehensive` 按 E04 文档还必须带 `person_name`（网关报文字段 `persName`），
缺参在本地直接拒绝，不打网关。

名称标准化：递归探测候选列表（不限一层 key）并兼容 `orgName` / `entName` / `entFullName` /
`companyName` / `name`；命中候选即 `verified=true`，输入本身已是全称、候选与输入同名时也算
已核实，不再降级为 `no_match`。只有完全无候选才返回 `degrade_reason=no_match`。

A03 深度查询按文档最长响应 6000ms，网关适配器默认超时 15s，不是代码卡住；若内网链路仍慢，
可用 `ELECREDIT_GATEWAY_VALID_DAY=N` 让网关在 N 天内复用结果。
成功响应 `{"success": true, "data": {...}, "standard_name": ..., "product_name": ...}`；
`/v1/normalize` 的 `data` 为 `{normalized, is_likely_full, original, verified}`；
`/v1/query/full` 顶层另有 `partial`/`modules`/`errors`/`warning`。

失败响应 `{"success": false, "error": ...}`，SDK 错误附带
`code`/`category`/`retryable`/`hint`；`SYS005`（余额不足）附
`degrade_reason=数据接口套餐余额不足`，明确要求下游报告如实标注缺失。

机器可读契约见 `openapi/service.yaml`。

## 环境变量

| 变量 | 说明 |
|---|---|
| `ELECREDIT_MODE` | 协议形态：`direct`（默认）/ `gateway`；未知值直接 fail closed |
| `ELECREDIT_APP_ID` / `ELECREDIT_APP_KEY` | direct 模式的服务商凭据，**只在服务端** |
| `ELECREDIT_BASE_URL` | direct 下只换 host；gateway 下指向内网网关（必填） |
| `ELECREDIT_GATEWAY_ACCOUNT` / `_OPERATE_USER_NAME` / `_ORG_NAME` / `_SCENE` | gateway 模式必填公共参数；机构名固定发 `eds_operateorgname` |
| `ELECREDIT_GATEWAY_SERVICE_CODES` | 可选 JSON 映射，覆盖截图里的服务号表；缺映射即失败 |
| `ELECREDIT_GATEWAY_DEBUG` | 默认 0；联调叠加层设为 1 时开放 `/v1/debug/envelope`（只回字段结构） |
| `SERVICE_AUTH_TOKEN` | 主仓调用方 Bearer Token；为空则无鉴权（仅本地调试） |
| `SERVICE_HOST` / `SERVICE_PORT` | 默认 `127.0.0.1:8800`，容器内设 `0.0.0.0` |
| `SERVICE_CACHE_TTL` | 进程内缓存秒数，默认 600 |
| `LOG_LEVEL` | 默认 INFO |

## 行为约定

- `001`（查无结果）按 `{"success": true, "data": {}}` 返回，不当作调用失败
- 错误重试语义由 SDK 的 `ERROR_CONTRACT` 决定：`SYS005` 不可重试（提示充值），
  `SYS007`/`SYS008`/`999` 由 SDK 内部有界退避
- 审计日志只记能力名、企业名哈希、响应大小与耗时，不落查询明文或上游原始响应
- 任何上游异常都转成结构化 JSON，不回传堆栈

## 主体信息字段提升（`/v1/query/basic`）

A03 深度查询把主体信息藏在 `basicList[0]` / `basicInformationList[0]`，键名全是
英文缩写。服务侧 `profile.py` 会在**裁剪之前**把它们提升到顶层
`company_profile`，`full` 聚合里的 `basic` 模块同样生效；原始字段与英文键名全部保留，
不破坏主仓 SP 已有的引用。

```json
{
  "company_profile": {
    "entName": "威海银行股份有限公司",
    "creditCode": "913700002671339534",
    "estDate": "1997-07-21",
    "regCap": {"raw": "598005.834400", "unit": "万元（服务商口径）",
               "display": "598005.8344 万元（约 59.80 亿元）"},
    "paidInCap": {"raw": "10064.490000", "unit": "万元（服务商口径）", "display": "..."},
    "regAddr": "...", "orgType": "...", "empNum": "3996", "formerName": "...",
    "_note": "...法定代表人不可得，严禁使用 entInvItemList.legRepName..."
  },
  "company_profile_note": "同 _note（顶层兼容字段）"
}
```

**注册资本口径是万元**，必须带单位，否则下游会把 `598005.834400` 当成「元」。

**法定代表人不可得**：A03 深度查询与 A07 模糊查询都不返回本企业法定代表人；
`entInvItemList[].legRepName` 是**被投资企业**的法人，误用会写出错误主体信息。
因此 `company_profile` 里刻意不放该字段，`company_profile_note` 明确要求报告如实
填「未查询到公开数据」。要补这一项只能换数据源或走公开渠道核实，不能靠猜测。
渐进式裁剪会优先保留 `company_profile`，收紧档位不会把它截掉。

## 安全边界

征信接口**按次计费**（`001` 查无结果同样计费），所以「知道地址就能调用」不只是
数据泄露，还等于把 App ID/Key 的账户额度开放给外部刷。已内置的约束：

1. **强制鉴权**：`SERVICE_AUTH_TOKEN` 为空且 `SERVICE_HOST` 不是回环地址时
   **拒绝启动**（`SystemExit(2)`）；只有 `127.0.0.1` 本地调试允许无鉴权。
2. **端口不发布到公网**：`compose.yml` 默认 `127.0.0.1:8800:8800`。
   跨主机部署建议**删掉 ports**，把容器加入 backend 所在的 compose 网络，
   由 backend 用服务名访问（生产验收用的正是这种形态）；必须暴露时前置
   带 mTLS / IP 白名单 / 限流的反向代理。
3. **凭据只在服务端**：`ELECREDIT_APP_ID` / `ELECREDIT_APP_KEY` 只在
   本进程环境变量，主仓不持有；`.env` 已被 `.gitignore` 忽略。
4. **失败可发现**：鉴权失败记来源 IP 与路径的 warning，不记 Token；
   健康检查不鉴权但不返回凭据配置状态，避免被外部探测。
5. **审计脱敏**：日志只记能力名、企业名哈希、响应大小与耗时，不落明文。

## 怎么处理：按信任边界分三层

### L0 已内置，所有部署都生效

上面 5 条：非回环强制鉴权、失败审计、健康检查不暴露凭据状态、凭据只在服务端、
日志脱敏。另有 `service/check_deploy.py` 自检。

### L1 上线前必做：网络隔离 + 凭据轮换

**根本解法是让外部根本没有地址可连**：能力服务不发布任何端口，只加入 backend
所在的 compose 网络，由 backend 用服务名访问。生产编排已固化：

```bash
# 1) 主仓先起 backend（会创建 workspace_default 网络）
cd /workspace && docker compose -f docker-compose.private.yml up -d

# 2) elecredit 仓库起能力服务：compose.internal.yml 刻意没有 ports 段
cd /workspace/elecredit
DUEAGENT_NETWORK=workspace_default \
  docker compose -f service/compose.internal.yml --env-file .env up -d
```

`compose.internal.yml` 用 `${VAR:?}` 强制凭据必填（缺失直接报错，不会静默无鉴权
启动），并默认开启 IP 白名单与每能力 120 次/分限流。主仓只需要
`ENTCREDIT_SERVICE_URL=http://elecredit-service:8800` + 同一个 `ENTCREDIT_SERVICE_TOKEN`。

**凭据轮换**（App ID/Key 出现在对话、日志或共享文档里时必做）：

1. 到 [https://api.elecredit.com/admin] 生成新 App Key
2. 更新 `elecredit/.env` 的 `ELECREDIT_APP_ID` / `ELECREDIT_APP_KEY`
3. `docker compose -f service/compose.internal.yml --env-file .env up -d --force-recreate`
4. 跑下面的自检 + 一次 `/v1/normalize` 确认仍返回全称
5. 在服务商后台作废旧 Key

Token 同理：`openssl rand -hex 32` 生成，两个 `.env` 填同一个值，轮换时同时改两边并重启。

### 调用方 Token（推荐，替代单一静态 Bearer）

单一静态 Bearer 的问题：泄露后只能整体更换、无法按调用方单独吊销、审计分不清
是谁调用、也没法限制对方能调哪些能力。`service/auth.py` + `service/issue_token.py`
提供注册表模式：

- 注册表 `service/tokens.json` **只存 SHA-256 哈希**（权限 600、已 gitignore），
  文件泄露也不能直接拿来调用
- 每个调用方独立 Token，带 `scopes`（能力白名单）、可选 `expires_at`、`enabled`（吊销）
- 审计日志带 `caller`
- 兼容：注册表不存在时回落 `SERVICE_AUTH_TOKEN`（legacy）；两者都没有且监听
  非回环地址时**拒绝启动**

```bash
# 平滑迁移：把现有 Token 登记进注册表，主仓 .env 一行都不用改
EXISTING=$(grep '^SERVICE_AUTH_TOKEN=' .env | cut -d= -f2-)
python service/issue_token.py --caller backend-prod --scopes '*' --token "$EXISTING"

# 再签一个只读方：只能标准化 / 查基本信息，且带过期时间
TOKEN=$(python service/issue_token.py --caller analyst-ro \
          --scopes normalize,basic --expires 2026-12-31 --quiet)
# 明文只输出这一次，立即写入调用方配置

python service/issue_token.py --list          # 只显示哈希前缀，不显示明文
python service/issue_token.py --revoke analyst-ro
```

`compose.internal.yml` 已把注册表以只读方式挂载到
`/app/service/tokens.json` 并设置 `SERVICE_TOKENS_FILE`；**registry 模式下
`SERVICE_AUTH_TOKEN` 不再生效**。签发/吊销改文件后，下一次请求立即生效
（按 mtime 缓存，无需重启）。

本机实测（`127.0.0.1:18811` 开端口，主仓项目真实调用）：

| 调用 | 结果 |
|---|---|
| 无 Token / 错误 Token | 401 |
| `backend-prod`（`scope=*`） | 主仓客户端 `normalize` / `query_company_full` 均 200 |
| `analyst-ro`（`normalize,basic`） | `normalize`/`basic` 200，`full` **403** |
| 完整 `/run` | HTTP 200、68 秒、PDF 生成，日志 `caller=backend-prod` |

### L2 跨信任边界才需要

只有确实要把 8800 暴露给其它服务/网段时才加，不要默认全开：

| 手段 | 开关 | 说明 |
|---|---|---|
| 来源 IP 白名单 | `SERVICE_ALLOWED_CIDRS` | 标准库 `ipaddress`；配了但网段全非法时**拒绝所有**（fail closed） |
| 按能力限流 | `SERVICE_RATE_LIMIT_PER_MIN` | 60 秒滑动窗口，超限返回 429；兜底防 Token 泄露后被刷额度 |
| 额度告警 | 自动 | 上游 `SYS005` 出现时打 ERROR 并累计 `billing_failure_count()` |
| mTLS / 每调用方 Token | 前置反向代理 | 需要证书与调用方身份体系，服务端零依赖进程刻意不内置 |

当前仍是**单一静态 Bearer**，没有过期时间与调用方身份；要跨信任边界暴露，
必须在反向代理侧补 mTLS 或 IP 白名单 + 每调用方 Token + 限流。

### 上线自检（一条命令）

```bash
python service/check_deploy.py --url http://127.0.0.1:8800
```

检查：Token 强度 ≥32、`.env` 已被忽略且未入仓、健康检查不暴露凭据状态、
无 Token 调用返回 401、带 Token 调用可用。任一 FAIL 则退出码 1。

### 额度

`SYS005` 出现时服务会打 ERROR 日志并累计计数，但**接口仍返回
`success=true` + 空数据**（`001` 查无结果同样计费）。必须把这条日志接进
监控告警，否则账户额度耗尽后报告会静默缺失征信章节而无人发现。

## 测试

```bash
python -m unittest discover -s service/tests -v
# 或：python -m pytest service/tests/ -q
```
