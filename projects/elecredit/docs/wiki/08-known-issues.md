# 08 · 一致性问题与待办

> 状态说明：本文档最初记录静态分析发现的问题。**P0/P1 项已于 2026-09-16 全部修复**，
> 下文按「已修复」与「仍待办」分组，未修复项保留证据位置便于后续收敛。

## 8.1 已修复（2026-09-16）

| # | 问题 | 修复方式 |
|---|------|---------|
| 1 | 文档指向 `python/toolkit/elecredit/`（实际 `python/elecredit/`） | 根 `README.md`、`AGENTS.md`、`docs/README.md` 全部改为 `sdks/python/` |
| 2 | `python3 elecredit.py …` 文件不存在 | 8 篇端点文档改为 `elecredit-ts …`；`AGENTS.md` 补充 `python -m elecredit.signature`、`pytest` 等真实命令 |
| 3 | `from elecredit_client import …` 模块不存在 | 根 README 改为 `from elecredit import ElecreditClient` |
| 4 | Python CLI 入口描述错误 | 改为 console script `elecredit`（`pip install -e ".[dev]"`）或 `python -m elecredit` |
| 5 | 「Python SDK 零 pip 依赖」表述不严谨 | README 明确：SDK 核心走标准库（`requests` 缺失时自动回退 urllib），CLI 需要 `typer` |
| 6–8 | `auth login` 命令不存在，但 3 处提示都在引导执行 | 新增 `src/commands/system/auth.ts`（`auth status` / `login` / `logout`）+ `AppKeyPairAuthProvider`（环境变量 → 系统钥匙环），并在 `program.ts` 接线，凭据解析支持钥匙环 |
| 9–12 | D11 字段名（`entityName`/`type`）与枚举与 Python/文档不一致；`--type` 声明为字符串但 schema 是数组，传值必失败 | D11 统一为 `entName` + `types`（逗号分隔字符串），枚举改为文档中的 12 个码（`xsy/xcr/xzf/lap/ktgg/pdws/pczc/sfxz/gqcd/dcdy/zsrz/jcjgt`）；CLI 选项为 `--ent-name` / `--types` |
| 13 | A07 标记 `paging:'page'` 却无分页选项 | 增加 `--page-no` / `--range`（integer → 字符串）及对应 schema 字段 |
| 14 | F09 Node 有 `--ratio`、无方向控制，Python 相反 | F09 统一为 `down` / `up` 布尔（CLI `--down` / `--up`），移除 `ratio` |
| 16 | `SYS003` 语义文档与代码冲突（文档说签名错，代码说应用不存在） | 以代码为准：根 README、`docs/api`、`skills/*/api.md`、SKILL.md 的错误码表统一（SYS001=签名错，SYS002=过期，SYS003=应用不存在，SYS004=算法不支持，SYS006=IP 受限） |
| 18 | `schemas/capabilities.json` 是另一个金融项目的遗留清单 | 已删除（无任何代码引用） |
| 22 | `client.ts` 未使用 `isBillingCode` / `ELECREDIT_BIZ_CODE_SERVER_ERROR` / `CliErrorOptions` | 改为真正使用：`isBillingCode(env.code)` 判定成功与计费；`999` 单独分类为「服务异常」 |
| 25 | **生产凭据硬编码**：`signature.py` 的 `GOLDEN_SAMPLE` 含真实 App ID/Key | 改为从 `ELECREDIT_APP_ID` / `ELECREDIT_APP_KEY` 读取，缺失时留空并打印提示 |
| 26 | 同一凭据明文出现在多处文档 | `docs/api/elecredit/README.md`、`skills/elecredit/references/api.md` 等全部改为 `<yourAppId>` / `<yourAppKey>` 占位符 |
| 27 | SKILL.md 中 `eleenterprise fuzzy` 拼写错误 | 改为 `elecredit-ts enterprise fuzzy` |
| 29–30 | Node CLI 零单元测试 | 新增 5 个测试文件共 41 个用例（签名 / 信封与错误分类 / 端点注册表与 Zod / queryFor 映射 / `exports` 契约） |
| 31 | Python 子项目没有 CI | 新增 `.github/workflows/sdk-ci.yml`（Python 3.10 / 3.12：pytest + 签名自测试 + ruff） |
| — | CLI CI 不跑测试 | `sdks-typescript-ci.yml` 增加 `npm test` 步骤 |
| — | `main.ts` 未使用的 `Command` 导入、`capabilities.ts` 的 `any`、命令内异常一律退出码 2 | 清理 lint 错误（eslint 全绿）；`register.ts` 现在识别 `CliError` 并按语义退出码（2/3/4）退出，错误信封带 `code` / `category` / `hint` |
| — | 与「App ID + App Key」模型冲突且无人引用的 `ApiKeyAuthProvider` | 删除 `credentials/api-key-provider.ts` |
| — | 包无法被其他项目复用：未发布到 npm，且 `git+https://…/elecredit.git` 因包在 `sdks/typescript/` 子目录而不可用 | 新增 `.github/workflows/sdks/typescript-publish.yml`（tag 触发 / 版本幂等 / `--provenance` / 缺 token 直接失败）+ `docs/publishing.md`；README 补消费方 `npm install` 与库用法。**该 workflow 已于 2026-09-30 删除，发布改由 CNB 流水线承担，见 0h** |

**安全提醒（仍需人工处理）**：曾经出现在仓库中的那对生产凭据已被公开传播，**必须在 [https://api.elecredit.com/admin] 轮换（作废并重新生成）**。清理 Git 历史（`git log -S`）也属于必要动作。

**轮换操作清单**（原优化方案 P0-1，仍需人工执行）：

1. **立即轮换**：在 [https://api.elecredit.com/admin] 作废旧 App Key 并生成新 Key —— 这是唯一真正的安全修复。
2. **更新密钥仓库**：`h1s97x/secret-env` 的 `ELECREDIT_APP_ID` / `ELECREDIT_APP_KEY` 换新值（同时解锁每周在线冒烟）。
3. **验证工作区无明文残留**：`git grep -nE 'ELECREDIT_APP_(ID|KEY)\s*=\s*[A-Za-z0-9]{8,}' -- . | grep -v '\.example'`，期望无输出；CNB 的 `main.push` / `pull_request` 已挂 gitleaks（`--no-git --redact`）作为自动化兜底。
4. **清历史（计划窗口内做，勿急）**：收益有限、成本不小 —— 凭据**已被公开传播**，重写历史**不能收回**已泄漏的值，价值只在仓库卫生与合规审计，代价是所有现有 clone/fork 全部失效。重写前必备份 `git bundle create /tmp/elecredit-pre-rewrite.bundle --all`，用 `git filter-repo --replace-text expressions.txt --force` 后 `git push --force-with-lease origin main`；必须在步骤 1 之后做，否则重写的是仍有效的 Key。验收 `git log -S '<旧 App Key>' --all --oneline` 无输出；回滚 `git clone /tmp/elecredit-pre-rewrite.bundle`。

> **2026-10-12 评估与优化方案**：11 项改进基于**实测**（真跑测试 + 实测覆盖率 + grep 调用方）；
> 本节的 **B / D / E / G / H** 五项被纳入其中，并新增了「真实 API 回归防线缺失」这一此前未登记的发现。
> 结论与排期已全部并入本文档（见 8.1b 的进度回填与本节「方案内仍未做」），不再单独保留方案文档。

## 8.1b 已修复（2026-10-12）

> 回填上面那份优化方案的执行进度 —— 方案 §8 要求「进度回填本文档」，
> 但方案落地后一直没回填，导致读者会以为 11 项都还没做。

| 项 | 内容 | 提交 |
|---|---|---|
| P1-2 | 每周在线冒烟（GH + CNB）：10 端点「签名必达」，`SYS005` 算通过 | `cf62f69` |
| P1-3 | 清死代码 + 修掉 `contracts → infrastructure` 反向依赖 | `8e68e59` |
| P1-4 | SDK 与 CLI 覆盖率门槛 | `eb90122` |
| P1-5 | 恢复 main 轻量 CI，让覆盖率门槛在直推 main 时真正生效 | `f9a0e07` |
| P2-6 | 端点清单收敛：把第 4 处信源（`references/api.md`）纳入守护 + 补 3 个维度 | `cfbb3dd` |
| P2-8 | 补 `sdks/python/elecredit/cli.py` 测试，覆盖率 0% → 97% | `394ed0b` |
| N1 | **信源收敛补完**：`SKILL.md` / `references/cli.md` / 根 `README.md` / `AGENTS.md` 纳入一致性测试。修掉实测漂移：SKILL.md「8 个端点」、D11 行 `--ent-name` + `--types`（含 12 个非法取值）、「按 annoType 分组输出」；`references/cli.md` 同一 D11 错例；根 README「8 个端点」。**负向自检**：把 SKILL.md 改回旧文案 → 3 条断言红 | `84f3e18` |
| N2 | **错误契约下沉**：`executeRemoteQuery` 的 Zod 校验失败改抛 `CliError(validation, exit 2)`，两条调用路径的兜底退出码统一为 1；新增 `SYS044 资源不存在`（upstream / 不可重试 / hint 指向路径大小写），并加「码表 ⊆ SKILL.md + AGENTS.md 错误分类表」护栏 | `84f3e18` |
| N5 | **组合根收敛**：新增 `infrastructure/elecredit/assemble.ts`，`index.ts` 与 `cli/program.ts` 不再各写一份凭据装配与 `AUTH_REQUIRED` 文案 | `84f3e18` |
| N4 | **Python CLI 改描述符驱动**：`sdks/python/elecredit/cli.py` 的 10 个手抄命令收敛为 `CLI_SPEC` 数据表 + `_build_command()` 生成签名（`exec`，因为 Typer 只从函数签名取选项）+ `_invoke()` 统一执行体。对外契约零变化（命令名、选项、args/kwargs 形状、退出码、信封全部保持，44 个 `test_cli.py` 用例原样通过）。新增跨语言护栏：一致性测试解析 `CLI_SPEC`，断言「子命令名 ↔ Node 叶子名（含 `tax`/`judicial` 两个登记别名）」与「Python 选项 ⊆ Node 描述符选项」 | `84f3e18` |
| N3 | **跨语言错误契约统一**（本次唯一的对外契约变更）：确立唯一真源 `ERROR_CONTRACT`（Node `envelope.ts` ↔ Python `envelope.py`，同名同表、19 条），并新增 `tests/error-contract-consistency.test.ts` 双向校验。修掉实测的 4 处系统性分歧：① `SYS005` Node `authentication` → **`billing`**（AGENTS.md 的分类是「业务」，签名已通过）；② `SYS008` Node `upstream` → **`rate_limit`**；③ 未识别码 Python `unknown`/退出码 6 → **`upstream`/4**；④ `SYS009` → **`validation`/2**、`SYS007` → upstream/4 可重试。两语言退出码收敛到 `1`~`4`（`5`/`6` 退回保留位），`category` 收敛到 6 个取值，信封统一为 `{code,category,message,hint?,retryable}`（**新增 `retryable`**，两语言都输出）。Node 侧 `classifyError`/`isRetryable` 与 Python 侧 `classify_error`/`_handle_error` 均改为查表，文案另置 `CODE_PRESENTATION` / 类默认 hint。**风险提示**：依赖 `error.category === 'authentication'`（SYS005）或退出码 5/6 的消费方需同步改。两个**已发布**版本（`@h1s97x/elecredit@0.0.4`、`elecredit@0.0.5`）带的都还是**旧**口径（`SYS005` 归 `authentication`、未识别码 `unknown` + 退出码 `6`、信封无 `retryable`），故两包不再走 `0.0.x`，一并升到 **`0.1.0`** 发版；仓库内消费方（docs / skills / wiki）已全部更新。**已随 `cli-v0.1.0` / `sdk-v0.1.0` 发布（2026-10-12）**，制品库验收：按消费方方式从私库真实安装，npm 产物 `dist/` 内 `retryable` 命中 43 处、PyPI 产物 `ERROR_CONTRACT` 19 条且 `SYS005 → ('billing', 3, False)` | `84f3e18` |

**方案内仍未做**：P0-1（凭据轮换 + 清 Git 历史，需人工在后台操作）、
P2-10（`docs/wiki/06` 僵尸层）、P2-11（输出 schema 字段级校验）。
P2-9（Python 重试复用 `requestSn`）**已于 2026-11-03 闭环**，见 8.1g。
P2-7（文档站闸门读主仓工件）**已作废**：`docs/site/` 已于 2026-11-02 删除，不再有独立文档站，见 8.1c。

## 8.1c 已修复（2026-11-02 文档结构收敛）

> 背景：`docs/` 长期存在四套并行信源（`docs/api/README.md` 与 `docs/api/elecredit/`、
> `docs/site/`（VitePress）与 `docs/`、`docs/proposals/` 与 `docs/wiki/08`、`docs/github-sync.md`
> 与 `docs/publishing.md`）。同一事实写两遍，必然漂移，且删除/搬迁时留下断链。

| 项 | 处置 | 验证 |
|---|---|---|
| `docs/site/`（VitePress 站点，13 个文件） | **删除**。站点内容与 `docs/` 事实源重复维护，构建链路长期无人跑；对外文档以 `docs/` + `openapi/openapi.yaml` 为准 | `grep -rn "VitePress\|docs/site"` 仅剩 `docs/README.md` 的一句「不再维护」说明 |
| `docs/api/README.md`（REST 总览） | **并入 `docs/api/elecredit/README.md`**，收敛为「通用约定 + 签名黄金样本 + 产品码 + 错误码 + 端点列表」单一入口 | 全仓无 `docs/api/README.md` 引用残留 |
| `docs/proposals/`（3 篇提案） | **删除**。结论与未完成项早已回填至 8.1 / 8.1b，未做项保留在 8.2 | 全仓无 `proposals/` 引用残留 |
| `docs/github-sync.md` | **并入 `docs/publishing.md`** 的「GitHub 同步（CNB → GitHub）」节，该文改题为「发布与 GitHub 同步运维」 | `docs/wiki/07-runbook.md` 的引用已改指 `publishing.md` |
| 签名细节 / 排障 | **新增** `docs/signature.md`（序列化三细节 + TS 参考实现 + 失败码对照）、`docs/troubleshooting.md`（按现象排障），避免在 10 篇端点文档里重复 | 两篇均从 `docs/README.md`、`docs/api/elecredit/README.md` 链入 |
| 引用一致性 | 全仓 Markdown 相对链接实测扫描 | **0 断链**（含 `openapi/README.md`、`AGENTS.md`、根 `README.md`） |
| 回归 | `sdks/typescript` 与 `sdks/python` 的单测（含端点/错误契约/信源一致性护栏） | Node **94 例通过**（13 文件）；Python **173 例通过**（11 例按凭据跳过）；`python -m elecredit.signature` 退出码 0 |

## 8.1d 已闭环（2026-11-03 插件仓库拆分）

> skill 与专家插件是两个**独立分发的 git 仓**，根仓既不内嵌也不登记 submodule ——
> 依据是根 `README.md`「本仓库不内嵌」与 `AGENTS.md`「专家仓通过 submodule 引用」。

| 项 | 处置 | 验证 |
|---|---|---|
| skill 独立仓 | 本地 `plugins/skills/elecredit` 推送至 `h1s97x/plugins/skills/elecredit-skill`（`main` = `c7dbe7d`），本地目录改名 `elecredit-skill` 与远端一致 | `git ls-remote` → `c7dbe7d refs/heads/main` |
| expert 独立仓 | 补齐 `.codebuddy-plugin/plugin.json`、`agents/elecredit.md`、`avatars/expert.png`、`README.md`；`.gitmodules` 的 url 由**打不通的** `…/skills/elecredit.git` 改为 `…/skills/elecredit-skill.git`；submodule 指针 `879f16c` → `c7dbe7d`（与 skill 仓 `main` 对齐） | 推 `main` 成功（`3623dc1`）；`git submodule update --init` 实测可检出 skill 内容 |
| 根仓 | **不内嵌、不登记 submodule**：`/plugins/` 写入 `.gitignore`，`AGENTS.md` 与 wiki 仓库地图标注「本地克隆，不入库」，并补一句「未克隆时改读 `docs/api/elecredit/README.md` + `docs/signature.md`」 | `git check-ignore -v` 命中 `.gitignore` 的 `/plugins/`；`git status` 不再出现 `plugins/`。**踩到一个护栏**：`AGENTS.md` 里写反引号包裹的 `/plugins/` 会被「反引号绝对路径必须是已注册端点」判红，故正文改写成不带前导斜杠的 `plugins/` |

## 8.1e 已处置（2026-11-03 删除 examples/ 接入示例工程）

| 项 | 内容 |
|---|---|
| 处置 | 删除 `examples/nextjs/`（12 个文件：Next 16 / React 19 脚手架 + 217 行 TS/TSX），把其中真正有价值的部分压成 `docs/troubleshooting.md`「能在浏览器里直接调吗」的 **~40 行片段**（服务端中转、6 类错误 → HTTP 状态、`SYS005` 不重试） |
| 依据 | 该示例**已不可编译**：`STATUS_BY_CATEGORY` 的 `Record<ErrorCategory, number>` 仍含已删除的 `'local-data'`、缺 `billing`/`rate_limit`（`ErrorCategory` 自 0.1.0 起为 6 值），错误契约统一（2026-10-12）后从未同步；无 CI、无 `node_modules`，README 里的 `npm run typecheck` 从未被执行 —— 属「不进 CI 的代码」，即负债 |
| 边界 | 接口测试 / Mock 由 **Apifox + `openapi/openapi.yaml`** 承担，与示例无关；示例演示的是「浏览器侧凭据不能落地」，两者不重叠 |
| 何时恢复 | 出现真实接入方且愿意维护时，按 skill / expert 的模式**开独立示例仓**，本仓只留链接；不要重新放回主仓 |
| 制度 | `AGENTS.md`「项目边界」新增准入门槛：不进 CI 的代码不入库，示例只有「进 CI」或「独立仓」两种形态 |
| 验证 | 全仓 `grep "examples/"` 无残留；4 处引用改指 `docs/troubleshooting.md#能在浏览器里直接调吗` |

## 8.1f 已补齐（2026-11-03 跨语言 hint 与信封事实订正）

> 起因：横向核对 7 门语言后确认 —— **契约表（19 条 × category/exitCode/retryable）7 门逐条一致**，
> 但 `hint`、JSON 信封、重试、脱敏只有部分语言实现，且有两处文档/注释在陈述不成立的事实。

| 项 | 处置 | 验证 |
|---|---|---|
| `hint` 覆盖 | 新增 `CodeHint` / `CategoryHint` / `HintFor()` 到 **Go / C / Rust / C#**（文案与 Python `CODE_HINT`、各异常类 hint 逐字相同），并在四门 CLI 的 stderr 打印 `提示: …`；Java 于本轮早先已补 | `go test`（含新增 `TestHintFollowsContract`）、`make test`（C，含 `test_hint`）、`cargo test` 7 例、`dotnet run --project tests/Elecredit.Tests` 全绿 |
| 事实订正 ① | `sdks/typescript/README.md`：删掉「这一形状是跨语言契约，Python 字段顺序逐字相同」，改为写明**真契约是 4 个字段，信封形状不是**，并指出 Node 成功信封多 `bizCode`/`orderNo` | — |
| 事实订正 ② | `sdks/java/.../cli/Main.java` 注释：原写「失败信封与 Node / Go / C / Rust / C# 一致」，实际只有「写 stderr」一致，形状不同 | — |
| Python 信封缺口 | `cli.py` 缺凭据时由 `错误: …` 纯文本改为统一 JSON 信封（`AUTH_REQUIRED` / `authentication` / exit 3，带 `AuthError.hint`） | `pytest tests/` 173 例通过（`test_missing_credentials_exits_3` 仍绿） |

## 8.1g 已修复（2026-11-03 Python 重试语义，闭环 P2-9）

| 项 | 处置 | 验证 |
|---|---|---|
| 重试判据 | `client.py:_post` 由「码黑名单」改为查异常自带的 `retryable`：`SYS044 资源不存在`、`SYS005 余额不足`、全部认证类码不再重试；`999` / `SYS008` / 网络异常继续退避（2^n×100ms） | 新增 `tests/test_retry.py` 6 例 |
| 每次重新签名 | `sign_request()` 从循环外移进循环。原实现三次重试共用同一个 `request-sn` 与时间戳 → `SYS007 流水号重复` 的重试**必然再失败**，纯属白跑 3 次 | 同上，`test_retryable_code_is_retried_with_fresh_signature` 断言三个 sn 互不相同 |
| 负向自检 | 把 `client.py` 回退到旧实现再跑新用例 | **2 例红**（SYS044 被重试、三次 sn 相同），恢复修复后 6 例全绿 |

## 8.1h 已补齐（2026-11-03 四门重试 + 七门脱敏，闭环 8.2 的 S / T）

| 项 | 处置 | 验证 |
|---|---|---|
| 重试（S） | Go / C / Rust / C# 补标准重试：判据是异常自带的 `retryable`、最多 3 次（`MaxAttempts` / `max_attempts` / `with_max_attempts` 可配）、`2^n×100ms` 退避、**每次重新签名**；缺凭据分支同样输出 hint | Go `TestRetryFollowsContract` + `TestNonRetryableCodeIsNotRetried`；C 用 fork 假上游的 `test_retry`（断言 3 次请求、三个 sn 互异、SYS044 只发 1 次）；Rust `retry_follows_contract_and_refreshes_sn` + `non_retryable_code_is_not_retried`；C# 两组断言（同上语义） |
| 脱敏（T） | 七门统一：`apiKey=` / `appKey:` / `token=` / `authorization:` / `cookie=` / `secret=` / `password=` 这类赋值替换为 `[REDACTED]`，CLI 在打印错误与 hint 前套一层。**顺带把 `app key` 加进规则** —— 凭据的字段名本身就叫 App Key，原 Node 规则漏掉它，等于最该打码的那个没打 | Node 4 例（新增 `tests/redact.test.ts`）、Python 8 例、Go 3 例、C `test_redact`、Rust 3 例、C# 6 条断言、Java `redactHidesSecretAssignments` |


## 8.1i 已迁移（2026-11-03 CI 从 GitHub Actions 搬到 CNB）

| 项 | 处置 | 验证 |
|---|---|---|
| 迁移动因 | GitHub 侧三条 workflow **长期全红且本地无从复现**：`sdk-ci.yml` 的 `working-directory: sdk` 指向不存在的目录（真实路径 `sdks/python`）、CLI 的 `lint` / `format` 门禁红、OpenAPI 的 spectral-action 无人看。加上 5 平台矩阵的分钟成本，判定「不值得修在 GitHub 上」 | 本地逐条复跑：`ruff check` 1 报错、`eslint .` 4 报错、`prettier --check .` 2 文件不合规 |
| 代码侧修复 | ① `elecredit/redact.py` 的 `from typing import Iterable` → `collections.abc`（UP035）；② 删掉 `tests/endpoint-contract-consistency.test.ts` 里 4 个死函数（`declaredEndpointCount` / `skillRouting` / `nodeCliExamples` / `capabilityOf`，其中 `skillRouting` 依赖从未定义的 `SKILL_MD`）；③ `prettier --write` 修根 `README.md` 与该测试文件 | `ruff check` All checks passed；`npm run lint` 干净；`npm run format` 全绿；`pytest` 187 passed / 覆盖率 81.21%；`vitest` 98 passed；`spectral` 0 errors |
| 配置侧迁移 | `.cnb.yml` 新增三个 anchor（`ci-python` / `ci-typescript` / `ci-openapi`），在 `main.push`、`**` 的 `pull_request`、`"crontab: 0 9 * * 1"` 三处复用；删除 `.github/workflows/{sdk-ci,sdks-typescript-ci,openapi-lint}.yml` | `python -c "yaml.safe_load(...)"` 解析通过、anchor 展开后 pipeline 名与 stage 名符合预期 |
| 保真度取舍 | CNB 无 `matrix`，全量组合显式展开为 6 条 pipeline；官方节点只有 Linux，Windows / macOS target 取消；`concurrency.cancel-in-progress` 未配（CNB 的 `lock` 语义不同，宁可多跑一次也不误取消） | `.cnb.yml` 周更 6 条：py3.10 / py3.12 / node22 amd64 / node24 amd64 / node22 arm64 / openapi |

## 8.1j 已修复（2026-11-03 首次 CNB 构建红：arch check 架构口径写错）

| 项 | 处置 | 验证 |
|---|---|---|
| 现象 | 迁移后首次 `main.push` 构建 `cnb-56t-1k6fgp44e` 红：pipeline `-002`（ci-typescript-cli）的 `arch check` 208ms 失败，`arch mismatch x64 != amd64`；后 5 个 stage 全部 skipped。python / openapi / gitleaks / git-sync 四条全绿 | 构建日志 + 耗时概览 |
| 根因 | `.cnb.yml` 的 `ci-typescript` anchor 里 `EXPECT_ARCH: amd64`，而断言脚本直接比较 `process.arch`。`docker.image` 是**多架构官方镜像**，平台按 manifest 拉 `linux/amd64` 变体后，容器内 Node 报 **`x64`** 不是 `amd64` —— 两个命名体系不可直接比。原 GitHub 版那一步写的是 `x64`，迁移时按 CNB 的 `cnb:arch:amd64` 标签「顺手统一」成了 `amd64`，语义正确、字面错 | 同上，错误串已在日志里 |
| 修复 | ① 断言脚本加归一化：`amd64 → x64`、`aarch64 → arm64`，仍「设置才断言、未设只打印」；② amd64 侧不再设 `EXPECT_ARCH`（默认空），amd64 的保证由 `runner.tags: cnb:arch:amd64` 的节点选择承担；③ arm64 job 维持 `EXPECT_ARCH=arm64`（归一化后 `arm64 == arm64` 通） | 本地按 4 种组合跑同一脚本：空 → `arch=x64` 通过；`amd64` → 通过；`arm64`/`aarch64` → exit 1；模拟 arm64 容器 → `arch=arm64` 通过 |

## 8.1k 已修复（2026-11-16 两个长期红：AGENTS.md `/mcp` 误判 + 每周在线冒烟无产物）

| 项 | 处置 | 验证 |
|---|---|---|
| 现象 A | 周任务 `crontab: 0 9 * * 1` 构建 `cnb-5ph-1k7gtte1c` 红：`ci-typescript-cli` 的三条（node22 amd64 / node24 amd64 / node22 arm64）**全部**在 `unit tests + coverage` 挂同一句 `AGENTS.md 提到的 /mcp 不是已注册端点`，后续 `npm pack dry-run` 被 skipped；python / openapi 全绿。同因早在 `cnb-s9t-1k6vdt254`（11-09 push）、`cnb-h2q-1k728vokn`、`cnb-jqh-1k72f32fv`（11-10 push）就红过 —— 即 `61812c2` 加 MCP HTTP transport 起，main 直推一直没绿 | 三条 pipeline 的 stage-4 日志；`git log -S'/mcp' -- AGENTS.md` 唯一来源提交 `61812c2` |
| 根因 A | `tests/endpoint-contract-consistency.test.ts` 的护栏「AGENTS.md 里每个反引号绝对路径必须是已注册端点」假定 AGENTS.md 只描述上游 REST 10 端点。但 `61812c2` 往 AGENTS.md 的 MCP 行写了 `\`/mcp\``（自建 Streamable HTTP 路由），它天然不在 `remoteCapabilities` 里 → 断言必红。护栏本意没错（防端点路径漂移），错在**没有给自建路由留出口** | 同 |
| 修复 A | 测试内新增 `SELF_HOSTED_ROUTES` 登记表（`/mcp` → `mcp/http_server.py`）：断言改为「已注册端点 **或** 已登记自建路由」，并补一条**双向自检**——登记项必须同时出现在 AGENTS.md 与该实现文件里（路由改名/删文档都会红，防陈旧登记与放宽成静默跳过）。**不动 AGENTS.md 文案**：`/mcp` 是真实存在的对外路由，该改的是护栏口径 | `vitest run tests/endpoint-contract-consistency.test.ts` 19 → **20 例全绿**；全量 `npm run test:coverage` **99 例全绿**，阈值（52/37/45/54）未触碰 |
| 现象 B | `crontab: 0 10 * * 1` 的 `live-smoke` **连红五次**（`cnb-03d-…` 10-19、`cnb-l89-…` 10-26、`cnb-fhe-…` 11-02、`cnb-4og-…` 11-09、`cnb-9bi-…` 11-16），每次都停在 `[live-smoke] 找不到 ../dist/index.js` | 五次构建的 stage-0 日志，错误串完全一致 |
| 根因 B | `.cnb.yml` 那行写的是 `npm ci --ignore-scripts …; node scripts/live-smoke.mjs`。`live-smoke.mjs` import 的是**编译产物** `../dist/index.js`，而 `--ignore-scripts` 跳过了 `prepare`（= `tsc`），`dist/` 根本不存在。`package.json` 早有 `smoke:live`（= `npm run build && node scripts/live-smoke.mjs`）专为此场景准备，配置却手写了半截 | `env -u ELECREDIT_APP_ID -u ELECREDIT_APP_KEY npm run smoke:live` 本地实跑：先 `tsc` 成功，再到凭据检查（exit 3 语义在脚本内），证明「有产物才会走到真正的冒烟判据」 |
| 修复 B | `.cnb.yml` 的周冒烟脚本改为 `npm ci --ignore-scripts …; npm run smoke:live;`，并在注释里写清「必须走 smoke:live、别手写 node」与五次红的历史证据，避免下次又被「顺手精简」。修复后周任务是**首次**真正打到线上网关 —— 若届时仍是 exit 3（缺凭据）或某端点红，那才是真问题（对应 8.1 的凭据轮换 P0-1） | `.cnb.yml` 的 `yaml.safe_load` 与 anchor 展开自检通过；同一行在 `web_trigger` / `tag_push` 里无同类问题（那些脚本自带 `npm run prepublishOnly` / `python -m build`） |

## 8.1l 已接入（2026-11-17 内网协议转换网关）

| 项 | 处置 | 验证 |
|---|---|---|
| 内网网关形态 | 门户截图确认：统一 `POST /edsservice/api/gateway`，`eds_*` 平铺、无签名、四条码表 1000/2000/3000/9999；服务号前缀不统一（`iP0010058` 与 `igongshangP...` 并存），不能靠模板拼 | `todo.md` 原待办已改为已确认；`service/upstream.py` 用显式 `GATEWAY_SERVICE_CODES`，缺映射即失败 |
| 协议形态选择 | 新增 `ELECREDIT_MODE=direct\|gateway`（默认 direct），只影响能力服务层；各语言 SDK、`openapi/service.yaml` 与 MCP/Skill 对外契约不变 | `service/server.py:get_client()` 按 mode 构造客户端；未知值直接 fail closed |
| gateway 适配器 | 新增请求构造（`eds_transcode`/`eds_operateusername`/`eds_operateorgname`/`eds_scene`/`eds_account`/`eds_validday`/`entinfo`）、错误码映射与响应解包；机构名字段已按截图确认为 `eds_operateorgname`，不保留兼容开关 | `python -m unittest discover -s service/tests -v` 全绿（新增 9 例覆盖模式选择、报文、错误码、解包） |
| 部署 | 新增 `service/compose.gateway.yml`：不发布端口、只加入 backend 网络，网关公共参数用 `${VAR:?}` 强制注入，不依赖 App ID / App Key | compose 文件与 `.env.example`、`service/README.md` 同步 |
| 响应形状已按内网实测补充 | 2026-11-17 内网测试台确认三类主体壳：`data[].[产品码]Data`（scale）、`data[].resultData.[产品码]Data`（actual_controller）与 `data[].data`（股权穿透）；`_business_body()` 已据此收敛并补测试。机构名字段已固定为 `eds_operateorgname` | 原始网关信封截图仍未回传，当前依据能力服务输出与脱敏探针推定，拿到后做最终确认 |

## 8.2 仍待办

| # | 问题 | 证据 | 建议 |
|---|------|------|------|
| 0a | **发布链路已跑通（CNB 侧）**：制品库 `h1s97x/npm`（由原 `elecredit` 库迁来）已创建（Private / npm）；`@h1s97x/elecredit@0.1.0` 最初发布于旧 `elecredit` 库，后续版本走 `npm` 库。CNB 用内置 `${CNB_TOKEN}`，无需额外 secret | `npm view @h1s97x/elecredit --registry=https://npm.cnb.cool/h1s97x/npm/-/packages/` 返回 0.1.0；`.cnb.yml` → `main.push.publish-to-cnb-registry` | 已闭环，后续发版推 `cli-v<version>` tag 即可（tag 需带包前缀，原因见 0f）。**2026-09-30 复核更正**：`h1s97x/npm` 里该包 `cnb registries list-package-tags` → `total: 0`（0 版本 / 0 标签），`npm view` 返回空；`0.1.0` 属于**已不存在的旧库** `h1s97x/elecredit`（`list-packages` 返回 404）。库的 `visibility_level` 是 **Public**（原文写 Private 有误，未鉴权 GET 也返回 200）。故「已跑通」仅指链路配置就绪，**实际尚未成功发布过任何版本**。**2026-11-18 复核**：该结论已过期 —— `@h1s97x/elecredit@0.1.2` 已发布到 CNB npm 与 npmjs.org（`dist-tags.latest=0.1.2`，2026-11-16 补齐），`elecredit@0.1.1` 已发布到 CNB PyPI 与 pypi.org，`cli-v0.1.1`/`cli-v0.1.2`/`sdk-v0.1.1` tag 均在远端 |
| 0b | **GitHub Actions 侧的 npmjs.org 发布仍未通**：`NPM_TOKEN`（Automation 类型，`@h1s97x` 个人 scope）secret 未配置 → 推 tag 时 CNB 已发私有库，GitHub 那条链路的 publish 步骤会报「缺少仓库 secret NPM_TOKEN」 | workflow 首次推 tag 会在 publish 步骤失败 | 二选一：① 配好 `NPM_TOKEN` 让两条链路都可用；② 若确定只走 CNB 私有库，删掉 `.github/workflows/sdks/typescript-publish.yml`（避免同一次 tag 出现一条成功一条失败）。**已按 ② 处置（2026-09-30）**：`sdks/typescript-publish.yml` 与 `sdk-publish.yml` 均已删除，发布统一由 CNB `tag_push` 流水线用内置 `${CNB_TOKEN}` 完成。注：GitHub 侧的 `CNB_TOKEN` secret 从未存在，且 `NPM_TOKEN`（npmjs token）也无法用于 CNB 制品库 —— 这也印证了「不要在 GitHub 侧发布」的判断 |
| 0c | **CNB 流水线脚本不能写多行 shell**：平台折叠换行，`if ... then\n...\nfi` 会被拼成一行并报 `sh: N: Syntax error: "then" unexpected`（已逐项实测定位） | 早期版本的 `publish-to-cnb-registry` 直接失败 | `.cnb.yml` 里所有 script 统一改为**单行 + 分号**；改动时沿用此约定，说明见 `docs/publishing.md` |
| 0d | **`exports` 曾缺 `default` 条件，CJS 消费方无法加载（已修复）**：v0.1.0 初版 `exports["."]` 只有 `types` + `import`，`require('@h1s97x/elecredit')` 抛 `ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined`，jest / tsx / 普通 CJS 脚本全部命中。已补 `default: ./dist/index.js`（Node ≥ 22.12 原生 `require(esm)`，无需 `.cjs`），并加 `tests/package-exports.test.ts` 锁定契约 | 修复前后均在净目录装 tarball 实测：修复前 `require` 失败，修复后 28 个符号可用；负向验证移除 `default` 时测试 4/4 失败 | 已闭环。**若日后有人精简 `exports`，勿删 `default`**——单测会拦住 |
| 0e | **Python SDK 发布链路接 CNB PyPI 制品库**：新增 `.github/workflows/sdk-publish.yml`（tag `sdk-v*.*.*` 触发 / 版本幂等 / 缺 token 直接失败），目标 `pypi.cnb.cool/h1s97x/pypi/-/packages/simple` | 见 `sdk-publish.yml` 与 `docs/publishing.md` | 需先创建 **PyPI 类型**制品库 `pypi`（组织共用、名字中性、与 npm 库（`h1s97x/npm`）相互独立），并给 `CNB_TOKEN` 加 `registry-package` 读写权限；闭环后推 `sdk-v<version>` tag 即发布（与 npm 链路对称）。**2026-09-30 更新**：链路已迁到 CNB 侧（`.cnb.yml` → `$` → `tag_push` → `publish-pypi-on-tag`），不再依赖 GitHub 仓库 secret；同日 `elecredit@0.0.1` 发布成功并实测可从该库 `pip install`。**2026-09-30 补充**：`0.0.2` 已由 `publish-pypi-on-tag` 发布（22.8s 真跑，**首次走通 PyPI 任务**；同期 npm 任务 4.9s 按前缀跳过），消费者侧 `pip install elecredit==0.0.2` 验证版本/10 端点/自测试无告警均正常。另记一个运维细节：发布后 simple 索引有数十秒延迟，立刻装会报 `No matching distribution found` |
| 0f | **monorepo 两个发布流水线共用一个 `v*` tag 通配 → 「一次发版，一条成功一条失败」**：Node CLI（`sdks/typescript/package.json`）与 Python SDK（`sdks/python/pyproject.toml`）各自独立版本，推 `v<version>` 会同时触发两条流水线，对方的版本号天然对不上（如 sdk 已是 0.2.0、CLI 仍是 0.1.0，推 `v0.2.0` 时 CLI 侧必失败）。顺带发现 CNB 侧 `tag="${CNB_TAG:-}"` 取的变量**平台根本不存在**（实测 CNB 构建环境未注入 `CNB_TAG`，Tag 名在 `CNB_BRANCH` 里），旧版本校验实为死代码，从未拦住任何东西 | 复现：`git tag v0.2.0` 后两条 workflow 一红一绿；CNB 构建环境里 `printf '[%s]' "${CNB_TAG-[unset]}"` 输出空 | 已修复：tag 改为带包前缀 `cli-v<version>` / `sdk-v<version>`；两条 GitHub workflow 用 `on.push.tags` 各自过滤并恢复严格校验（`::error` + `exit 1`）；`.cnb.yml` 两个发布脚本按 `cli-v*` 路由——非本包 tag `exit 0` 跳过、本包 tag 版本不符 `exit 1`，tag 名改为**先看 `CNB_IS_TAG=true` 再从 `CNB_BRANCH` 取值**（`vscode`/分支构建下 `CNB_BRANCH=main`，直接取会误判）；`docs/publishing.md` 与 `docs/wiki/07-runbook.md` 同步。旧的无前缀 `v*` tag 不再触发任何发布 |
| 0g | **SDK 端点表与文档/契约不一致（8 vs 10）**：`sdks/python/elecredit/endpoints.py` 多出 `bidding`（B04 招投标）与 `actual_controller`（P0020019 实控人），`pyproject.toml` 描述与 `__init__.py` docstring 也跟着写「10 端点」；而 Node CLI、`docs/api/elecredit`、根 README、AGENTS.md、`sdks/python/README.md` 全按 **8 端点**，`tests/test_endpoints.py` 也断言 8 → SDK 单测必红 | `python -m pytest tests/ -q` → `test_all_8_endpoints_registered`、`test_endpoint_keys` 失败 | 初次处置（**当事口径：以 8 端点为准**，后经真实凭据实测推翻，见文末）：删除注册表 2 项、`ElecreditClient` 的 2 个便捷方法、模块级 `bidding()` / `actual_controller()` 及 `__all__` 条目，`pyproject` 描述与 docstring 改回 8 端点。两个端点仍可用通用 `post()` 直达（`sdks/python/README.md` 已说明），能力未丢失。修复后 SDK 单测全绿。**2026-09-30 用真实凭据补测（关键补充）**：① `B04 /enterprise/biddingYPageWh` 换 `entInfo` 参数返回 `001 查询成功无结果`，换 `entName` 返回 `400 企业信息不能为空` → **路径与参数名都正确、接口可用**，只是该企业无招投标记录（此端点被删属能力回收，是否恢复为第 9 个端点待定）；② `P0020019 /saic/SaicInvWh` 返回 `SYS044 资源不存在`，与**故意写错的路径**（`/this/path/does/not/exist`）返回完全一致 → 该路径**根本不存在**，b7c6485 当年加的这个端点从未能打通，**删除是正确处置**（这解释了它为何既无文档也无测试记录）。判定方法可复用：**未知路径 → `SYS044 资源不存在`**，与业务侧的「查无数据」（如 `001 查询成功无结果`）不是一回事。**处置结果（2026-09-30）**：`P0020019` 维持删除（路径无效）；`B04` **已恢复**为 SDK 第 9 个端点（注册表、`ElecreditClient.bidding()`、模块级 `bidding()`、`__all__`、单测断言 8→9 全部恢复）。但 REST 契约（`docs/api`）与 Node CLI 仍按 8 端点，故 CLI **没有** `bidding` 子命令，而 `elecredit-ts capabilities` 会列出 9 个 —— 这是有意保留的口径差异，已在 `sdks/python/README.md`「端点口径」一节写明。**同日再次反转（结论以本条为准）**：`P0020019` 其实**可用**，我先前判它「路径无效」是**对照实验设计缺陷**——`SYS044 资源不存在` 既用于「未知路由」也用于「资源不存在」，拿它当唯一对照无法区分两者。改用「已知有效路由 + 缺标识」做基准后测得：`/saic/enterprise/deep/wh` 缺标识 → `400 请求参数错误`；**小写** `/saic/SaicinvWh` + `entName` → `400 企业信息不能为空`（与前者同类，证明**路由有效**）；**大写** `/saic/SaicInvWh` → `SYS044`（与未知路由同码，**死路由**）。再补正确参数后：`/saic/SaicinvWh` + `entInfo` → `000 查询成功`，`resultData={P0020019Data,P0020019Status}`（国家电网有限公司）→ **端点完全可用**。真正的两个坑是：① 路径大小写敏感，正确为小写 w 的 `SaicinvWh`（**提交 4a5d9eb 当年「修复大小写」改反了方向**，端点因此长期打不通）；② 参数名必须是 `entInfo`（传 `entName` 报 400）。据此已恢复该端点为 SDK 第 10 个端点，路径取小写并在 `test_endpoints.py` 加大写回归护栏。**方法论教训：判定「路径是否存在」不能只用一条错路径做对照，SYS044 是「找不到」的通用码** |
| 0h | **「推 tag 自动发布」从未生效（缺陷 1）**：发布任务挂在 `main.push` 下、靠脚本判定 `CNB_IS_TAG` 来决定「只在 tag 时发布」；但推 tag 属于仓库级 **`tag_push`** 事件（`.cnb.yml` 里根本没有该键），而合并推送会被当成普通 `push`（`CNB_IS_TAG=false`）→ 脚本一路 skip。结果是 pipeline 显示 success、制品库却始终为空 | 构建记录：`--event tag_push` 查询 `total: 0`（从来没有 tag_push 构建）；推 tag 那次的 `cnb-k6m-1k3nst21p` 3 条 pipeline 全 success，制品库仍 `total: 0` | 已修复：发布迁到 `$` 分支的 `tag_push`（`publish-npm-on-tag` / `publish-pypi-on-tag`），脚本按 `cli-v*` / `sdk-v*` 路由 + 版本校验 + 幂等跳过；手动按钮保留并在 PyPI 侧补齐（`web_trigger.publish_cnb_pypi`）。两个 `0.0.1` 当时是本地命令补发的。**2026-09-30 验收通过**：推一个指向最新 `main` 的测试 tag → 立即产生 `tag_push` 构建（`cnb-ffd-1k3nuneqn`，2/2 pipeline success，按前缀各自跳过）。**顺带挖出一个坑并已写进 `docs/publishing.md`**：`tag_push` 按「当前 Tag」取代码版本，配置读的是 **tag 所指提交**里的 `.cnb.yml`——重推指向旧提交的 tag（配置段还没进去）不会触发任何流水线，发版必须把 tag 打在最新 `main` 上 |
| 0i | **GitHub 侧发布链路名不副实（缺陷 2）**：`sdk-publish.yml` 的 `TWINE_PASSWORD` 与 `sdks/typescript-publish.yml` 私有分支的 `NODE_AUTH_TOKEN` 都读 `secrets.CNB_TOKEN`，而 GitHub 上从未配置过这个 secret（实际有 `NPM_TOKEN` 与 `CNB_GIT_TOKEN`；前者是 npmjs.org 的 token，对 CNB 制品库无效）→ 推 tag 时 GitHub 那条必然失败 | Actions 日志：`需要仓库 secret CNB_TOKEN（CNB 访问令牌…）` → `Process completed with exit code 1` | 已修复：删除两个发布 workflow，发布统一收进 CNB（见 0h），GitHub 只留 CI（5 平台矩阵 + sdk CI）。若日后要公开发布到 npmjs.org / PyPI 官方源，再单独加一条 CNB 任务并把 token 配在 **CNB 侧**密钥仓库，而不是 GitHub |
| A | `--format` 选项除 `json` 外无效：`output/*`（renderer/table/json）与 `cli/context.ts`、`cli/i18n.ts`、`contracts/envelope.ts`、`contracts/registry.ts`、`process/*` 仍未接线 | `register.ts` 只有 JSON 输出分支；这些模块除自身定义外无 import | **已处置（2026-09-30）**：查证这些模块是**另一个股票/基金数据项目的复制残留**（`cli/i18n.ts` 全是 `thscode`/复权因子/基金文案，`output/json.ts` 会把键 snake_case 化——与当前输出契约冲突），故**接线是错的方向**，改为删除：`output/{renderer,table,json}.ts`、`cli/{context,i18n}.ts`、`contracts/registry.ts`、`schemas/command-envelope.schema.json`。同时把「静默忽略」修掉：`--format` 传非 json 现在报 `ELECREDIT_UNSUPPORTED_FORMAT` + `exit 2`，新增 `tests/cli-format.test.ts`（3 用例）锁住。`contracts/envelope.ts` 当时保留为**预留**（见 B）；**2026-10-12 已删除** —— 复核发现它**连测试都不引用**，本行原文「仅测试引用」的表述有误 |
| B | 错误信封未使用 `errorEnvelope`（`retryable` / `requestId` / `diagnostics` / `reportUrl` 字段不会输出） | `main.ts` 只手写 4 个字段 | **已处置（2026-10-12）：删除**。复核证据推翻了「预留」的前提：① `contracts/envelope.ts` **零引用**（连测试都没有，原文「仅测试引用」不实）；② `ResultMeta.adjust` 注释写着「价格复权模式（`qfq`/`hfq`）」——证券行情词汇，属**另一个股票/基金数据项目**的复制残留（同 2026-09-30 删掉的 `schemas/command-envelope.schema.json`）；③ 其信封形状（`meta.cliVersion`/`meta.schemaVersion`/`error.retryable`）与线上**已文档化**的契约 `{ok,error:{code,category,message,hint?}}` 冲突，接线反而是不必要的对外契约变更。**教训：判定「仅测试引用」也要实测 grep —— 当时没人查过**。详见 [03 §3.3](03-node-cli.md) 的「已删除的遗留模块（2026-10-12）」 |
| C | `retry.ts` 的 `RETRYABLE_BUSINESS_CODES`（4001/5001…）与 `parseRetryAfter` 未被 `client.ts` 使用 | `client.ts` import 列表 | **已处置（2026-09-30）**：① `RETRYABLE_BUSINESS_CODES` 删除——业务码重试是从未实现的**策略**，保留空壳只会误导；② `parseRetryAfter` **接线**：client 遇到可重试状态码/业务码时优先按服务端 `Retry-After` 退避（`MAX_RETRY_AFTER_MS` 封顶 30s），无该头才退回指数退避 + 抖动；新增 `tests/retry-after.test.ts`（6 用例，含 `Retry-After: 2` → 睡 2s、缺头 → 2200ms） |
| D | `endpoints.py` 元组第 4 项（是否分页）无代码消费 | `endpoints.py` / `test_endpoints.py` | 用于文档生成或删除 |
| E | `ELECREDIT_PROFILE` 只影响 keyring 的 profile 名，Python 侧无对应概念 | `config.ts` vs `credentials.py` | 统一或明确为 Node 专有 |
| F | `package.json` 的 `skills@1.5.15` 依赖无任何 import | `search_content` | **已删除（2026-09-30）**：确认 `src/`、`tests/`、`scripts/` 零引用后从 `package.json` 移除，并用 `npm install --package-lock-only` 同步 `npm-shrinkwrap.json`；`npm ci` 干净通过（包数 157 → 156），43 个用例不受影响 |
| G | 输出 schema 全部是 `z.object({}).passthrough()`，`resultData` 无字段级校验 | `remote-capabilities.ts` `anyDataSchema` | 拿到真实响应后逐端点细化 |
| H | 集成测试只在有凭据时跑，且 Python 侧 `AuthError` 才判失败 | `test_client_integration.py` | 保留，但建议加一条「签名错误必现 SYS001」的负向用例 |
| I | `python -m elecredit.signature` 会触发 `RuntimeWarning`（`__init__` 已导入该模块） | 运行输出 | **已修（2026-09-30）**：该警告由 runpy 在**子模块代码执行之前**发出，所以放在 `signature.py` 的 `__main__` 里屏蔽**无效**（先试过，实测仍会打印）；正确位置是父包导入阶段——在 `elecredit/__init__.py` 里精确过滤该条消息。现在自测试输出干净且 `exit 0` |
| J | **SDK CI 的 lint 关卡是红的**：`ruff check elecredit/ tests/`（`sdk-ci.yml` 的最后一步）实测有 **115 个错误**：`UP045` 73 个（`Optional[X]` 应写 `X \| None`）、`E701` 21 个（一行多语句）、`I001` 12 个（import 未排序）、`F401` 5 个（未用 import）等，其中 91 个可 `--fix` | 本地 `ruff check elecredit/ tests/ --statistics`；与目录名问题**是两个独立原因**——目录改名后测试能跑了，但 lint 依旧红 | **已修**：`ruff check elecredit/ tests/` 现为 **All checks passed**（`UP045/E701/I001/F401` 全部清零），并把 lint 提到 CI 步骤最前面（便宜的先跑）。修复方式：`ruff check --fix` 自动处理 94 个（UP045 73 / I001 12 / F401 5 …），人工处理 23 个（E701 ×21 展开多语句等）。⚠️ 本行曾在 2026-09-30 被一次「重排编号」的脚本**误删**（切片替换吞掉了中间行），当日从 `5ee61b3` 恢复原文并按现状更新处置列 |
| K | **Node CLI 对着生产 API 全端点不可用（响应信封 schema 过严）**：`elecreditEnvelopeSchema` 把可选字段 `isCompressed` 声明为 `z.boolean()`，而上游实际返回数字 `0/1` → 真实响应校验失败，所有端点统一报 `响应信封格式错误: isCompressed expected boolean, received number`。Python SDK 因不做严格 schema 校验，完全看不出问题，所以只有 Node CLI 全挂 | `node dist/cli/main.js enterprise fuzzy --ent-name 贵州茅台` → `{"ok":false,"error":{"code":"ELECREDIT_UPSTREAM","message":"响应信封格式错误: ...isCompressed..."}}`；连最老的 `fuzzy` 命令都失败（2026-09-30 实测） | **已修（2026-09-30）**：确立「**只有 `code` 必填，其余元数据一律容错**」——可选字段加 `.catch(undefined)`（类型漂移就丢弃，不阻断请求），`isCompressed` 显式接受 `boolean \| number` 并归一为 boolean。新增 `tests/envelope-tolerance.test.ts`（4 用例）守住这条规矩。修复后实测 `fuzzy` / `bidding` / `actual-controller` / `graph` 四条真实调用全部 `ok=true` |
| L | **已发布的 `@h1s97x/elecredit@0.0.1` / `0.0.2` 在生产 API 上不可用**（即 K 的产品后果，已流到制品库） | 直接拉私库 tarball 验产物（非推断）：`sdks/typescript-0.0.1.tgz` 与 `-0.0.2.tgz` 解包后 dist 里都是 `isCompressed: z.boolean(`；口径 bug 由 `2c79c33 init from source` 引入，故两个版本都坏 | **处置**：**不删除坏版本**——npm 版本号不可变，删+重发同名会让下游 lockfile 的 `integrity` 对不上、缓存继续发出旧包，`overwrite_policy: forbid` 本就是这道保护；改为发 **`0.0.3`**（信封修复 + 2 个新命令）并在 `sdks/typescript/README`、`docs/publishing.md`（新增「发布治理」节，含"何时才该真删：仅当泄漏凭据/内部数据"）写明可用版本从 `0.0.3` 起。平台 `cnb registries` 无 deprecate 工具，故先试 `npm deprecate`、退路是 `update-package-description`。**2026-09-30 发布验收**：`cli-v0.0.3` 推 tag → 流水线 success → 库上 3 个版本（0.0.1/0.0.2/0.0.3）；**按消费方方式**（干净目录 + scope `.npmrc`）真实 `npm install @h1s97x/elecredit@0.0.3` 后调用 `fuzzy` / `bidding` / `actual-controller` **全部 `ok=true`**（bizCode 000/001/000）；产物内 `isCompressed: z.boolean(` 出现 0 次。**废弃标记平台不支持**：`npm deprecate`（范围式与逐版本）均 `400 Cannot release multiple versions simultaneously`，`update-package-description` 连试两次 `500`，故提示只落在文档层（详见 `docs/publishing.md`「发布治理」） |
| M | **消费方（智慧风控一期）提交的 SDK 补充建议 P0 项**（2026-09-30，结论已并入本表）：G1 `query()` 只返回到**外层** `resultData`，消费方得自己写 `result_data[f"{code}Data"]`，并为防上游改码加**硬编码兜底**；G2 `ENDPOINTS` 没有产品码、`id` 槽位语义混（多数是短码 `A07`，`actual_controller` 却是 `P0020019`） | 消费方代码里的兜底：`result_data.get(f"{product_code}Data") or result_data.get("P0030089Data") or {}` | **已实施（2026-09-30，随 `sdk-v0.0.3` 发布）**：① 新增 `product_payload()` / `detect_product_code()` —— 与建议书不同的一点：**不传产品码时按结构探测**（匹配 `^P\d+Data$`），比"要求调用方传产品码"更彻底（上游换码也不失效，正是兜底的存在意义），入参同时兼容「完整信封」与「resultData 本身」（后者才是便捷方法返回值）；② `ENDPOINTS` 改为 `Endpoint` NamedTuple 并补 `product_code` —— **保留下标访问**（`ENDPOINTS[k][1]` 照旧可用，消费方在用的写法不破坏），仅 4 元组解包会失效（文档已写明）；**未采纳**建议里的 dataclass（会破坏下标访问）；③ 产品码数据：本仓库实测 4 个（fuzzy/bidding/graph/actual_controller）+ 消费方 registry 5 个，`xgbzxr` 未实测故显式留 `None`，并由测试锁死「待实测集合 == {xgbzxr}」（防悄悄留空上线）；`actual_controller` 的 `code == product_code` 是上游只给产品码、**不臆造编号**。`query()` 默认返回未改动。P1 拆两半：**协议事实部分已于同日完成（见 N）**，扇出编排（`judicial_all`）仍押后；P2（字段取值工具）按建议书自身的边界暂不做。建议书结论已并入本表 |
| N | **D11（`/risk/sifaInfo/wh`）的字段与语义，我们的文档与实现整体是错的 —— 该端点从未调用成功过**：标识字段实为 `entityName`（文档/实现写 `entName`）；类型过滤字段实为**单值 `type`**，合法值是 `shixin/zxgg/cpws/fygg/ktgg/bgt/pccz/sdgg/zbaj/lian/xzgxf/pmgg`（文档里那 12 个 `xsy/xcr/…` **全部非法**）；`types`（复数）与 `startDate`/`endDate` 上游**静默忽略**（不报错但无效）；`range` 上限 **20**（超出返回 `999 系统异常`，**不是静默截断**）；`detailList` 的 `annoType` 实测为**空串**（文档「按 annoType 分组」不成立） | 24 组参数组合全部 `400 请求参数错误`；改成 `{"entityName":"贵州茅台"}` → `000 查询成功` + `P0030089Data`。正交对照：10 个端点里 **9 个**按文档参数正常，**只有 D11 失败** —— 证明不是签名/传输问题 | **已修（2026-09-30，SDK 与 Node CLI 同步）**：① SDK `judicial()` 改发 `entityName`（`ent_name=` 保留为兼容旧名）、新增 `type` 单值校验（`client.D11_TYPES`）与 `range ≤ 20` 拦截、去掉 `types`/日期，新增 `tests/test_judicial_params.py`；② Node CLI 描述符改 `--entity-name`/`--type`（Zod 加 12 值枚举 + `range ≤ 20` refine），去除 `--ent-name`/`--types`/日期，测试同步纠正（旧测试**断言的就是错的契约**）；③ `docs/api/elecredit/judicial.md` 按实测重写（含「建议书差异」与旧文档错误清单），docs/wiki/01/04/05、AGENTS、README、docs/api/README、skills 同步。**顺带修掉更隐蔽的一环**：`test_client_integration.py` 原先把所有非 Auth 异常都当「可能业务正常」放过 —— **400 也被吞**，这正是 D11 长期打不通却无人发现的原因；现已改为 400 直接判失败、仅 5xx/网络放过。另：`xgbzxr` 产品码实测为 `P1020054`，**10 个端点产品码至此全部实测到位** |
| O | **消费方建议书 P1 的 A 部分落地**：`type` 是单值、不支持多选，聚合返回的 `detailList` 里 `annoType` 又是空串 → 想按类型分组取明细只能扇出（12 次调用；若 `judicial_all` 翻到底，恒大地产这种量级会放大到上千次**计费**调用）。故先只做「扇出的第一步」：`judicial_summary(entity_name)` 用 **1 次调用**给出各类型条数/页数 | 实测：`type` 单值（`ktgg,cpws` → 400）、`annoType` 为空串、`detailListMeta` 的计数键是 `{12 前缀}Count` | **已实施**：`client.judicial_summary()` + 模块级导出，返回 `{entityName, totalCount, totalPage, pageNo, range, actualNo, types:{12 类:{count,pages}}, meta}`；`types` 恒定 12 项（上游空串/整键缺失都归一为 0，计数是字符串 → int）；`001` 查无数据返回全 0 不抛异常。**已随 `sdk-v0.0.5` 发布。**新增 `tests/test_judicial_summary.py`（11 用例，离线 mock，不依赖凭据）。**实现中踩到并修掉一个坑**：为压小返回体曾传 `range=1`，但上游 `totalPage` 是**按请求的每页条数**算的 → `totalPage` 变成 `totalCount`（恒大地产实测 `52713`，字段语义被改坏）；改为不传分页参数（默认每页 10 条），真实调用复验 `totalPage=5272` ✓。**B 部分见 P 行** |
| P | **消费方建议书 P1 的 B 部分落地：多类型明细扇出**（`judicial_all`）。`type` 单值且不支持多选 → 要「每个非空类型都有代表记录」必须逐类型取；若一股脑翻到底，恒大地产那种量级（`ktgg` 16723 条）会放大到上千次**计费**调用 | 实测：单类型可翻页（`type=ktgg` + `pageNo=2` 正常）；`fygg` 共 2420 条却在聚合首页只出现 1 条 → 聚合分页**无法**保证每类型都有代表记录 | **已实施**：`client.judicial_all(entity_name, *, types=None, max_pages=1, range=20, concurrency=1)` —— 先 1 次 `judicial_summary` 拿各类型计数，**只对计数非 0 的类型**扇出（恒大 12 类 → 6 类，共 7 次调用）；`max_pages` 按该类型 `{t}PageNum` **自动夹紧**（防 `pageNo` 超界返回 `999`）；跨类型按 `entryId` 去重；单类型失败只进 `errors` 不影响其它类型；返回 `calls`（实际计费次数）与 `truncated`。新增 `tests/test_judicial_all.py`（22 用例，离线 mock）。**实测**：恒大默认 7 次调用 / 3.4s / 119 条 / 12 键齐全，其中 `bgt` 首页 20 条里有 1 条重复（去重确实必要）；`贵州茅台` 全类型 3 次调用；`max_pages=5` 对只有 1 页的 `ktgg` 夹紧为 2 次调用、`truncated=False`。**实现中踩到并修掉一个坑**：参数名 `range` **遮蔽了内置 `range()`**，方法体里 `for page in range(...)` 会直接崩（`'int' object is not callable`）—— 改用模块级 `_PAGE_LABELS` 页码表，并由 `max_pages>1` 的用例锁住。**Node CLI 有意不做**（CLI 是「一端点一命令」，扇出属编排逻辑；消费方用的是 Python）。**已随 `sdk-v0.0.5` 发布。**另：实测发现**聚合调用返回的记录自带 `type` 字段**（只有 `annoType` 是空串），故「只要首屏混合明细」不必扇出 —— 已写进 `sdks/python/README` 与 `docs/api/elecredit/judicial.md` |
| Q | **Agent Skill 的一致性护栏实际没生效**（与 8.1b 的 N1 表述不符）：`endpoint-contract-consistency.test.ts` 里 `skillRouting()`（`:397`）与 `declaredEndpointCount()`（`:390`）是**死函数**，全仓零调用；且它们依赖的 `SKILL_MD` 常量**从未定义**，一旦接线就会 `ReferenceError`。故 SKILL.md / `references/cli.md` 此刻改了**测试不会红**，N1 当年记录的漂移（「8 个端点」、D11 错例、annoType 分组）属于同类风险 | `grep -rn "SKILL_MD" sdks/typescript/tests` 仅 1 处引用、0 处定义；`grep -c "skillRouting\|declaredEndpointCount"` = 2（均为定义）；当前 94 例全绿 | 二选一：① **恢复护栏**（补 `SKILL_MD` 常量并接线，路径取 `plugins/skills/elecredit-skill/SKILL.md`），此时测试对本地 skill 克隆有依赖，须在缺失时明确 skip + 输出告警，避免「静默跳过 = 没有护栏」；② 删死函数并订正 8.1b N1 的表述。**建议 ①**：skill 是 Agent 的第一入口，漂移代价已在 N1 里实测过。**已按 ② 处置（2026-11-03）**：CI 迁 CNB 时 ESLint 的 `no-unused-vars` 把 4 个死函数点红，遂删除 `declaredEndpointCount` / `skillRouting` / `nodeCliExamples` / `capabilityOf`，并订正 8.1b N1 的表述（Skill 文档已随 `plugins/` 外置，本仓无文件可守）；若日后要恢复护栏，须按 ① 补 `SKILL_MD` 常量并在缺失时明确 skip + 告警 |
| R | **CLI 的 JSON 信封只有 Node / Python / Java 三门**：Go / C / Rust / C# 成功时打印上游原始响应、失败时打印 `[code/category] message`（无 `ok` 包装、无 `retryable` 字段）；且 Python 的错误信封写 **stdout**，其余六门写 stderr —— 管道里 `elecredit-py … | jq .data` 会把错误当数据 | `sdks/{go,c,rust,csharp}` 的 CLI `main`：成功 `println` 原始响应、失败 `eprintln` 文本；`sdks/python/elecredit/cli.py:_err_exit` 用 `print` 而非 `file=sys.stderr` | 二选一：① 把信封定为契约，四门 CLI 各做一次输出层改造（序列化 + 分流 + 退出码不变），并同步 Python 到 stderr（**会让 16 个 `test_cli` 用例需要改**，属对外行为变更，需版本号配合）；② 明确「信封只是三门约定」，在四门 README 写清输出形状。**已按 ② 落地（2026-11-03）**：四门 README 新增「输出与错误」一节，写明成功/失败的形状、输出流与退出码，并指引需要信封时改用 Node / Python CLI 或直接从 SDK 的异常字段取（含 `hint`）。① 仍作为独立任务保留 —— Python 错误信封写 stdout 的问题一并放在 ① 里解决 |

## 8.3 非缺陷（此前记录，经复查确认无需修改）

| 项 | 结论 |
|----|------|
| Node `compactJson` 剔除空字符串值、Python 保留 | 两者都保证「发送的 body = 参与签名的 body」，各自自洽；差异只体现在可选空参数上。保持现状，避免把空串发给上游 |
| B06 用 `entityName`、D07/D14 用其他字段名 | 这是上游 API 本身的字段命名（税务端点就是 `entityName`），非缺陷 |
| Node 每次重试重算签名、Python 只算一次 | 两者都能通过；Node 的实现对时钟漂移更健壮 |
| `ExitCode = 5`（local-data）无对应场景 | 保留为契约位，无害 |
