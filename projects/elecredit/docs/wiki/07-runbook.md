# 07 · 运行与开发指南

## 7.1 环境要求

| 子项目 | 要求 |
|--------|------|
| Node.js CLI | Node **≥ 22.12.0**（CI 验证 22 / 24），npm |
| Python SDK | Python **≥ 3.10** |
| 通用 | `ELECREDIT_APP_ID` + `ELECREDIT_APP_KEY`（从 [https://api.elecredit.com/admin] 获取） |

## 7.2 Node.js CLI

### 安装与构建

```bash
# 消费方（其他项目 / 全局 CLI）：从 npm registry 安装，不依赖本仓库结构
npm install @h1s97x/elecredit
npm install -g @h1s97x/elecredit   # 只要命令行

# 本仓库开发
cd /workspace/sdks/typescript
npm ci                      # 或 npm install
npm run verify              # typecheck + build + capabilities 冒烟（CI 同款命令）
npm link                    # 可选：全局注册 `elecredit-ts` 命令
```

| 脚本 | 命令 |
|------|------|
| `build` | `tsc -p tsconfig.json`（src → dist，产出 d.ts + sourceMap） |
| `typecheck` | `tsc -p tsconfig.json --noEmit` |
| `verify` | `typecheck && build && node dist/cli/main.js capabilities --format json` |
| `test` / `test:built` | `vitest run`（5 个测试文件 / 41 个用例：签名、信封与错误分类、端点注册表与 Zod、`queryFor` 映射、`exports` 契约） |
| `lint` | `eslint .` |
| `format` / `format:check` | `prettier --check .` |
| `format:write` | `prettier --write .` |
| `prepublishOnly` | `node scripts/check-license.mjs && npm run verify` |

### 发布与 GitHub 同步

- 发布通道只有 CNB 流水线（`tag_push`），GitHub 侧只跑 CI、不承担发布。
- CNB 是唯一权威源，单向 force push 同步到 GitHub；反向只有手动逃生口。
- tag 必须带包前缀（`cli-v<version>` / `sdk-v<version>`），版本须与对应包清单一致，重推幂等。
- CNB 流水线脚本必须写成**单行分号形式**，多行 shell 会被平台折叠后报语法错误。

tag 命名、版本校验、私有制品库与消费方 `.npmrc`、同步配置与排查，统一见
[`docs/publishing.md`](../publishing.md)。

### 运行

```bash
export ELECREDIT_APP_ID=[app-id]
export ELECREDIT_APP_KEY=[app-key]

# 凭据（二选一）
elecredit-ts auth login --app-id <App ID> --app-key <App Key>   # 写入系统钥匙环
node dist/cli/main.js auth status                            # 检查来源（不回显值）

# 直接跑编译产物
node dist/cli/main.js capabilities --format json
node dist/cli/main.js enterprise fuzzy --ent-name 贵州茅台
node dist/cli/main.js enterprise deep --credit-code 91520300MA6DJXXXX
node dist/cli/main.js enterprise scale --ent-info 贵州茅台
node dist/cli/main.js enterprise tax-credit --entity-name 贵州茅台 --type satpartyXin
node dist/cli/main.js enterprise admin-punishment --ent-info 贵州茅台 --start-date 2023-01-01
node dist/cli/main.js risk judicial-fuzzy --ent-name 贵州茅台 --types xsy,xcr
node dist/cli/main.js litigation xgbzxr --pers-name 许家印 --id-no 110101195804261234
node dist/cli/main.js enterprise graph --ent-info 贵州茅台 --level 2 --down   # 60s 超时

# 或 npm link 后
elecredit-ts enterprise fuzzy --ent-name 贵州茅台
```

**免凭据命令**：`--help`、`--version`、`capabilities`（惰性认证）。

### 输出

成功：`{ "ok": true, "bizCode": "000", "data": {…}, "orderNo": "…" }`
失败：`{ "ok": false, "error": { "code", "category", "message", "hint" } }`（`CliError`，退出码 = `err.exitCode`：2 校验 / 3 认证 / 4 上游）；非 `CliError` 的异常输出 `{ "ok": false, "error": { "message": "…" } }` 并 exit 1（internal）。两条调用路径（`cli/main.ts` 与 `commands/register.ts`）的兜底码已统一为 1。

## 7.3 Python SDK / CLI

### 安装

```bash
cd /workspace/sdks/python
pip install -e ".[dev]"      # 完整：typer + rich + python-dotenv + requests + pytest + ruff
# 或零安装
python -c "import sys; sys.path.insert(0,'.'); from elecredit import ElecreditClient"
```

Console script：`elecredit-py = elecredit.cli:main`。

### SDK 用法

```python
from elecredit import ElecreditClient
c = ElecreditClient.from_env()               # 或 ElecreditClient(app_id=..., app_key=...)

c.fuzzy(ent_name="贵州茅台")
c.deep(ent_name="贵州茅台")
c.scale(ent_info="贵州茅台")
c.tax(entity_name="贵州茅台", type="satpartyXin")
c.admin_punishment(ent_info="贵州茅台")
c.judicial(ent_name="贵州茅台", types="xsy,xcr")
c.xgbzxr(pers_name="许家印", id_no="110101195804261234")
c.graph(ent_info="贵州茅台", level="2", down=True)   # 60s
```

模块级便捷函数（`from elecredit import fuzzy, graph`）每次调用都会新建 client，批量场景请复用实例。

### CLI 用法

```bash
export ELECREDIT_APP_ID=... ELECREDIT_APP_KEY=...

elecredit-py capabilities
elecredit-py fuzzy --ent-name 贵州茅台
elecredit-py graph --ent-info 贵州茅台 --level 2 --output graph.json
elecredit-py xgbzxr --pers-name 许家印 --id-no 110101195804261234

# 等价写法
python -m elecredit fuzzy --ent-name 贵州茅台
```

`--output/-o` 会把 `{"ok": true, "data": …}` 写入文件并打印「已写入 [path]」——**大结果（尤其 F09）必须用这个**。

### 测试

```bash
cd /workspace/sdks/python
pytest tests/ -v                     # 单元测试（无需凭据）
python -m elecredit.signature        # 签名黄金样本自测试（exit 0 = 通过）
ruff check elecredit/ tests/         # lint

# 生产集成测试（需真实凭据，会真实计费/调用）
ELECREDIT_APP_ID=... ELECREDIT_APP_KEY=... pytest -m integration -v -s
```

## 7.4 直接 REST 调用（任何语言）

```bash
curl -X POST 'https://api.elecredit.com/mohu/wh' \
  -H 'Content-Type: application/json' \
  -H 'app-id: YOUR_APP_ID' \
  -H 'timestamp: YOUR_TS_MS' \
  -H 'request-sn: YOUR_RANDOM_SN' \
  -H 'signature: YOUR_MD5_HEX' \
  -H 'sign-type: MD5' \
  -d '{"entName":"贵州茅台"}'
```

参考实现（Python）：

```python
import hashlib, json, time, uuid
sn = uuid.uuid4().hex
ts = str(int(time.time() * 1000))
body = json.dumps({"entName": "贵州茅台"}, ensure_ascii=False, separators=(",", ":"))
sig = hashlib.md5((sn + ts + body + APP_KEY).encode("utf-8")).hexdigest()
```

客户端超时：常规端点 ≥ 15s，**F09 graph 必须 ≥ 60s**。

## 7.5 排障手册

| 现象 | 可能原因 | 处置 |
|------|---------|------|
| `SYS001` 认证失败 | appKey 错、时间戳偏差、签名算法错 | 核对 appKey；同步时钟；确认 MD5 + 小写 hex |
| `SYS002` 请求过期 | 本机时钟漂移 | 与公共 NTP 同步 |
| `SYS003` 应用不存在 | `app-id` 配置错 | 核对 App ID |
| `SYS004` 签名算法不支持 | `sign-type` 非 MD5/SHA256 | 用 MD5 |
| `SYS005` 余额不足 | 账户余额不足 | **不是 bug**（签名已通过）；充值后重试；不要重试 |
| `SYS006` IP 受限 | 出口 IP 不在白名单 | 联系服务商加白名单 |
| `SYS008` 频率过快 | 请求速率超限 | 降速 + 退避重试 |
| 中文查询返回 `SYS001`/`SYS003` | body 中中文被转义成 `\uXXXX` | `ensure_ascii=False`（Python）/ 紧凑 JSON（Node） |
| Node CLI 报未检测到凭据（exit 3） | 两个环境变量缺一 | 同时设置 ID 与 KEY |
| Python CLI 提示需要 typer | 未安装 Typer | `pip install -e ".[dev]"` 或改用 SDK |
| F09 超时 | 默认超时不足 / 层级过深 | Node 已固定 60s；Python 调大 `graph_timeout`；降低 `--level` |
| `resultData 不符合预期 schema` | 输出 schema 仍为 passthrough，理论上不会发生 | 检查上游结构变化 |

## 7.6 新增一个端点的标准动作

**Node CLI**（只需改一处）：

1. 在 `src/contracts/remote-capabilities.ts` 追加一个 `RemoteCapabilityDescriptor`（含 `id`、`command`、Zod `inputSchema`、`options`、`paging`、可选 `timeoutMs`）。
2. `register.ts` 自动生成命令；`capabilities` 自动列出；无需新增文件。

**Python SDK**：

1. `endpoints.py` 的 `ENDPOINTS` 增项。
2. `client.py` 增加便捷方法（或直接用 `client.query("[key]", **body)`）。
3. `cli.py` 增加 Typer 命令。
4. `tests/test_endpoints.py` 的期望键集合同步更新（当前硬编码 8 个键、断言 `len == 8`）。

**文档**：`docs/api/elecredit/` 增一篇；`plugins/skills/elecredit-skill/SKILL.md` 路由表增一行。
