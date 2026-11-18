# 发布与 GitHub 同步运维：@h1s97x/elecredit

消费方可以走 CNB 制品库或公网源（npmjs.org / pypi.org），不依赖本仓库的目录结构。
本文覆盖两件事：**发布**（npm / PyPI，正文）与 **CNB → GitHub 同步**（文末）。

**发布统一由 CNB 流水线触发**（`.cnb.yml` → `$` 分支的 `tag_push`）：每个 tag 同时发布到
CNB 制品库与公网源。CNB 两通道用平台内置 `${CNB_TOKEN}`；公网两通道用密钥仓库
`h1s97x/secret-env` 的 `NPMJS_TOKEN` / `PYPI_TOKEN`。GitHub 侧只留 CI，发布类 workflow 已删除。
公网首次发布后元数据传播可能要几分钟，发布 job 的安装冒烟对此做了退避重试。

## 版本 tag 命名约定（本仓库含多个包，tag 必须带包前缀）

本仓库是 monorepo：Node CLI（`sdks/typescript/package.json`）与 Python SDK（`sdks/python/pyproject.toml`）
**各自独立版本**，而两条发布流水线都靠 tag 触发。若共用 `v*.*.*`，任一包发版都会**同时**触发
另一条流水线，对方版本号天然对不上 —— 表现为「一次发版，一条成功、一条失败」。

因此 tag 一律带包前缀。前缀决定由哪条流水线发布、拿哪个版本号做校验：

| tag 形式 | 触发 | 版本比对对象 | 产物 |
|----------|------|--------------|------|
| `cli-v<version>` | `publish-npm-on-tag` + `publish-npmjs-on-tag` | `sdks/typescript/package.json` | CNB npm + npmjs.org 的 `@h1s97x/elecredit` |
| `sdk-v<version>` | `publish-pypi-on-tag` + `publish-pypi-org-on-tag` | `sdks/python/pyproject.toml` | CNB PyPI + pypi.org 的 `elecredit` |

路由行为：

- 前缀**不匹配自己**的 tag → 该任务直接跳过（`exit 0`，不发布、不算失败）。
- 前缀**匹配自己**的 tag → 严格校验版本，例如 `cli-v0.1.1` 对不上 `package.json` 的 `0.1.0` 就失败。
- 旧的无前缀 tag（历史遗留 `v0.1.0` / `v0.2.0`）**不再触发任何发布**，发新版请用带前缀形式。
- 版本基线：两个包统一从 **`0.0.1`** 重新计数，之后按需递增 —— 纯修复 / 新增走 `0.0.x`，
  **对外契约有破坏性变更时走 minor**（`0.0.4` → `0.1.0`，2026-10-12 的跨语言错误契约统一即属此类），
  不为了发版而升版本号。
- ⚠️ **与历史区分**：早年 CLI 发过 `0.1.0`、SDK 发过 `0.2.0`，但那属于**已删除的旧库**
  （`h1s97x/elecredit`，远端 tag 一并作废）。现在的 `0.1.0` 是当前库里的版本，两者不是同一个包。
- ⚠️ **旧 npm 包名已退役（2026-11-03）**：制品库里的 `@h1s97x/elecredit-cli` 是改名前
  （`elecredit-cli/` → `sdks/typescript/`）的旧包名，承载了 `0.0.1`~`0.1.0` 全部历史版本。
  该包已于 2026-11-03 删除，**npm 侧当前没有本项目可拉取版本**。新包名
  `@h1s97x/elecredit` 尚未发布过，下次按 `cli-v<package.json version>` 发版
  （当前 `0.1.0` → `cli-v0.1.0`）时补齐。**2026-11-16 已补齐**：CNB npm 与 npmjs.org
  均为 `@h1s97x/elecredit 0.1.2`（0.1.2 是升级 zod 修复高危漏洞的补丁），
  CNB PyPI 与 pypi.org 均为 `elecredit 0.1.1`（Python SDK 无改动，未发补丁）。
- ⚠️ **历史 tag 已清理（2026-11-03）**：`cli-v0.0.1`~`cli-v0.1.0`、`sdk-v0.0.1`~`sdk-v0.1.0`
  共 11 个已从本地与远端删除，tag 名已释放、可重新使用。恢复用 `git tag <name> <sha>`：
  `cli-v0.0.1 6dc1d90` / `cli-v0.0.2 f8d42b6` / `cli-v0.0.3 1bf6815` / `cli-v0.0.4 f00fc77` /
  `cli-v0.1.0 19908e6` / `sdk-v0.0.1 5d6d87f` / `sdk-v0.0.2 d50ed42` / `sdk-v0.0.3 70cd45b` /
  `sdk-v0.0.4 f00fc77` / `sdk-v0.0.5 ef06dfc` / `sdk-v0.1.0 1d9ba2d`。
- ⚠️ **tag 必须打在含发布配置的提交上**：CNB 的 `tag_push` 事件按「当前 Tag」取代码版本，
  也就是**读 tag 所指那个提交里的 `.cnb.yml`**。若 tag 指向的提交还没有 `tag_push` 段，
  推 tag 不会触发任何流水线。2026-09-30 实测：重推指向旧提交的 tag → 无任何构建；
  推一个指向最新 `main` 的 tag → 立即产生 `tag_push` 构建（两个任务按前缀各自跳过）。
  所以发版时请把 tag 打在当前 `main` 的提交上。

## 一次性准备（人工）

**需要 0 个 secret。** CNB 流水线用平台内置的 `${CNB_TOKEN}`（由平台注入），无需在仓库里配置 token；
GitHub 侧也不再需要制品库 token（发布类 workflow 已删）。

- 制品库已存在：`h1s97x/npm`（type npm）、`h1s97x/pypi`（type PyPI）。
- 若日后要**公开发布到 npmjs.org / PyPI 官方源**，那是另一条可选链路（见文末「公开发布（可选，未启用）」），
  届时才需要 `NPM_TOKEN` / `PYPI_TOKEN`，且应配在 CNB 侧密钥里，而不是 GitHub。

## 发布新版本

```bash
# 1. 升版本（会同步 package.json 与 npm-shrinkwrap.json）
cd sdks/typescript
npm version patch          # 或 minor / major

# 2. 本地先过一遍发布校验（与 CI 同命令）
npm run prepublishOnly
npm test --ignore-scripts

# 3. 提交并推送
git add -A && git commit -m "chore(release): v0.1.1"
git push origin <分支>

# 4. tag 必须是 cli-v<package.json version>（cli-v0.1.1 ↔ 0.1.1），推 tag 即触发发布
git tag cli-v0.1.1 && git push origin cli-v0.1.1
```

流水线行为（`.cnb.yml` → `tag_push` → `publish-npm-on-tag`）：

| 步骤 | 说明 |
|------|------|
| 触发 | 推 tag 即触发；脚本只认 `cli-v*`，其它前缀（含 `sdk-v*`）跳过 |
| 校验 tag | tag 去掉 `cli-v` 后必须等于 `package.json` 的 `version`，否则 `exit 1` |
| 构建前校验 | `npm run prepublishOnly`（LICENSE 校验 + typecheck + build + `capabilities` 冒烟） |
| 幂等检查 | `npm view` 命中已发布版本则跳过，可安全重推同一个 tag |
| 发布 | `npm publish` 到 `NPM_REGISTRY`（当前 `h1s97x/npm`；scope 级映射由流水线写 `.npmrc`） |
| 凭据 | 平台内置 `${CNB_TOKEN}`；token 无效会直接失败，不会静默「成功」 |

## 发布治理：版本号不可变，坏版本**不删、发新版**

2026-09-30 的教训：已发布的 `0.0.1` / `0.0.2` 有个致命 bug（响应信封 schema 把上游返回的数字
`isCompressed: 0/1` 当成 boolean → 所有命令都失败）。当时的直觉是「删了重发同一个版本号」，
**但那是错的**，正确做法是发 `0.0.3` 并把旧版本标记为不可用。判据：

| 维度 | 删了重发同名版本 | 发新版本（推荐） |
|------|------------------|------------------|
| 下游 lockfile | 记的是 `resolved`+`integrity`（内容哈希），同名换内容 → 已装与新装拿到不同字节，`npm ci` 因 integrity 不匹配**直接失败** | 无影响 |
| 缓存 | 本地 `~/.npm/_cacache`、CI 缓存、代理会继续发旧包 → 「同一个版本号两种行为」 | 无影响 |
| 平台保护 | `overwrite_policy: forbid` 本来就禁止覆盖，删+发是**绕过**它 | 合规 |
| 成本 | 多一步删除操作，还引入上面全部风险 | 推一个 tag（链路已通） |
| 可追溯 | 坏版本消失，事后无法复现/排查 | 历史保留，可查可对比 |

**什么时候才该真删**：只有包内**泄漏了凭据或内部数据**才值得付上面的代价——而且必须同时轮换泄漏的凭据。
单纯的「代码有 bug」不属于这一类。

### 废弃标记：平台两条路都走不通（2026-09-30 实测）

结论先写：**CNB 制品库目前无法给单个版本打废弃（deprecated）标记**，废弃提示只能落在文档层。

| 尝试 | 结果 |
|------|------|
| `npm deprecate @h1s97x/elecredit@"<=0.0.2" "<msg>"` | `400 Cannot release multiple versions simultaneously` |
| `npm deprecate @h1s97x/elecredit@0.0.2 "<msg>"`（逐版本） | 同上 `400`（平台对 packument PUT 的限制：一次只能发布/改动一个版本） |
| `cnb registries update-package-description --description "<msg>"` | `500 Internal Server Error`（换纯文本重试亦然） |

`cnb registries` 的 10 个工具里也确实没有 deprecate（只有删除制品/标签、查列表、改描述）。

**不建议**手工构造 packument 的 PUT 去写 `deprecated` 字段：库是 `overwrite_policy: forbid`
且平台只实现了部分 npm 协议，写坏元数据（例如把其它版本信息覆盖掉）的代价远大于收益。

因此替代做法：在**子项目 README**（`sdks/typescript/README.md` 的现状段）与本文档写明
「可用版本从哪个起」，并通知消费方。若将来平台支持了 deprecate，再把这段改成实际命令。

## 手动发布（不推 tag）

CNB 仓库页面 → 构建 → 按钮**「发布 npm 包到 CNB 制品库」**（`web_trigger.publish_cnb_registry`）：
按当前 `package.json` 版本发布，版本已存在则跳过。SDK 有对称的**「发布 PyPI 包到 CNB 制品库」**按钮。
用于重跑/验证发布链路，不消耗新版本号。

## `exports` 条件：必须保留 `default`

`sdks/typescript/package.json` 的 `exports["."]` 有三个条件，缺一不可：

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  }
}
```

- `types`：TS 类型解析
- `import`：ESM 消费方（`import`）
- `default`：**CJS 兜底**。`require` 没有匹配条件时会回落到 `default`；若只写 `import`，
  `require('@h1s97x/elecredit')` 直接抛
  `ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined`

`default` 与 `import` 指向**同一文件**即可：`engines` 已约束 `node >= 22.12.0`，
该版本原生支持 `require(esm)`，无需再产出 `.cjs`。

> 历史缺陷（v0.1.0 初版）：只有 `types` + `import`，导致 jest / tsx / 普通 `require`
> 等 CJS 消费方全部加载失败。已修复，并加了 `sdks/typescript/tests/package-exports.test.ts`
> 锁定契约——移除 `default` 时该测试会失败，防止回归。

## 为什么不走 git 依赖

`pnpm add git+https://…/elecredit.git` 走不通：包在 `sdks/typescript/`
子目录里，npm / pnpm 的 git 依赖只认仓库根的 `package.json`。
把包挪到根目录或加 submodule 都是结构性改动，成本高于发布到 registry。

## 内部私有 registry（CNB 制品库）

CNB 制品库（本仓库对应制品库：`https://npm.cnb.cool/h1s97x/npm/-/packages/`）
是当前实际发布目标；npmjs.org 为可选切换，开关见 `.cnb.yml` 的 `publish-npm-on-tag` 的 `NPM_REGISTRY`。

### 现状（2026-09-30 实测，数据取自 CNB OpenAPI）

| 项 | 状态 |
|----|------|
| 制品库 `h1s97x/npm` | 存在，type npm，平台返回 `visibility_level: Public`、`overwrite_policy: forbid`（未鉴权 GET packument 也返回 200，与 Public 一致） |
| 发布流水线 | `.cnb.yml` → `$` → `tag_push` → `publish-npm-on-tag`（仅 `cli-v*` tag 触发，其它前缀的 tag 在脚本内跳过）+ 手动按钮 |
| 已发布版本（旧包名 `@h1s97x/elecredit-cli`，已于 2026-11-03 删除） | `0.0.1`（2026-09-30，新库首个版本；当时 tag 触发还没修好，属**本地手工补发**）、`0.0.2`（同日，走修复后的 `tag_push` 流水线）、`0.0.3`（同日，修复响应信封 bug + 新增 2 个端点命令）、`0.0.4`（同日，修 D11：标识字段 `entityName` 与 12 个 `type` 取值）、`0.1.0`（2026-10-12，跨语言错误契约统一：`SYS005` → `billing`、`SYS008` → `rate_limit`、退出码只用 `1`~`4`、信封新增 `retryable`；同批含端点清单收敛 P2-6、死代码清理 P1-3） |
| ⚠️ 可用性 | **`0.0.1` / `0.0.2` 不可用**：信封 schema 把上游实际返回的数字 `isCompressed: 0/1` 当成 boolean，所有命令对着真实 API 都报「响应信封格式错误」（已拉取两个 tarball 实证）。**可用版本从 `0.0.3` 起**；其中 `risk judicial-fuzzy`（D11）另有字段错误，**需 `>= 0.0.4`**；错误输出契约（`error.category` 取值 / 退出码 / `retryable` 字段）**需 `>= 0.1.0`** 才与 Python SDK 对齐 |
| 当前可拉取版本 | `@h1s97x/elecredit@0.1.2`（CNB npm 与 npmjs.org，2026-11-16 补齐：升级 zod 修复高危漏洞）；Python `elecredit@0.1.1`（CNB PyPI 与 pypi.org）。旧包名 `@h1s97x/elecredit-cli` 已删除 |
| 幂等 | 版本已存在时输出 `already published, skip`，流水线可安全重推同一个 tag |
| GitHub Actions 侧 | **不承担发布，也不再跑 CI**：两个 publish workflow 已删除，2026-11-03 起三条 CI workflow 也随迁移删除（CI 全在 `.cnb.yml`）。原先它读的 `secrets.CNB_TOKEN` 在 GitHub 上从未配置过（实际只有 `NPM_TOKEN`/`CNB_GIT_TOKEN`，而 npmjs token 对 CNB 制品库无效），故那条链路从来没有真正可用过 |

### ⚠️ CNB 流水线脚本必须写成单行分号形式

这是本仓库踩过的坑，写多行 shell 会直接失败：

```yaml
# ❌ 失败：平台把换行折叠成一行，报 sh: N: Syntax error: "then" unexpected
script: |
  if [ -n "$x" ]; then
    echo ok
  fi

# ✅ 通过：单行 + 分号
script: |
  if [ -n "$x" ]; then echo ok; fi;
```

`if` / `for` / `while` 都受影响，多个语句之间用 `;` 连接。
`.cnb.yml` 里已按此约定实现，改动时请沿用。

### 消费方安装（配 `.npmrc` 后）

```bash
npm config set @h1s97x:registry https://npm.cnb.cool/h1s97x/npm/-/packages/
npm config set //npm.cnb.cool/h1s97x/npm/-/packages/:_authToken <你的 CNB 访问令牌>
npm install @h1s97x/elecredit
```

### 原方案（改 GitHub Actions 走私有库）

若要改为「GitHub Actions 也发私有库」，按下面步骤切换。

### 前置事实（先读，决定能不能切）

**CNB 私有制品库不代理公共包。** 本包有 4 个公共运行时依赖：

| 依赖 | 类型 |
|------|------|
| `@napi-rs/keyring` | 公共（npmjs.org） |
| `commander` | 公共 |
| ~~`skills`~~ | 已于 2026-09-30 移除（源码零引用的运行时依赖） |
| `zod` | 公共 |

实测：把这 4 个包名去私有库查，返回 `401`（不是 404），确认私有库不代理公共包。
**因此不能把全局 `registry` 整体指向私有库**——那样消费方解析这 4 个依赖会 401/404。
正确做法是 **scope 级映射**（`@h1s97x:registry=`），只让 `@h1s97x/*` 走私有库，
其余依赖继续走 npmjs.org。工作流里已按此实现（见切换点 1）。

### 消费方 `.npmrc`（发布之后，其他项目要用时配）

```ini
@h1s97x:registry=https://npm.cnb.cool/h1s97x/npm/-/packages/
always-auth=true
//npm.cnb.cool/h1s97x/npm/-/packages/:_authToken=${CNB_TOKEN}
```

包名不变，仍是 `@h1s97x/elecredit`——**registry 和 scope 是两件事**：
scope 决定包叫什么，registry 决定从哪个地址取。

### 发布侧切换点（从 CNB 库改到 npmjs.org）

发布目标写在 `.cnb.yml` → `tag_push` → `publish-npm-on-tag` 的 `env.NPM_REGISTRY` 里，改一处即可：

| # | 切换点 | CNB 私有库（当前） | npmjs.org（公开，未启用） |
|---|--------|-------------------|---------------------------|
| 1 | registry | `https://npm.cnb.cool/h1s97x/npm/-/packages/` | `https://registry.npmjs.org` |
| 2 | scope 级映射 | 需要（流水线内写 `@h1s97x:registry=` 到 `.npmrc`） | 不需要 |
| 3 | 凭据 | 平台内置 `${CNB_TOKEN}` | 需在 CNB 密钥仓库配 `NPM_TOKEN`（CNB 内置 token 不能用于 npmjs） |
| 4 | `--provenance` | 不支持（需 sigstore/OIDC，CNB 制品库无此端点） | 建议加 |
| 5 | `--access public` | 不适用（私有库无 public 概念） | 需要 |
| 6 | `check-license.mjs` | 保留不影响（MIT LICENSE 在仓库里，校验必然通过） | 公开前必须过 |

> registry 一换，消费方 `.npmrc` 也得跟着改/删，否则会去旧地址找；已发布版本不受影响。

### `publishConfig.access`（第 7 处，可选）

`sdks/typescript/package.json` 的 `publishConfig.access: "public"` 在私有库场景下无意义，
但 npm 对私有 registry 会忽略该字段，**留着也不会导致失败**。
若想彻底干净，可删掉 `publishConfig` 整块；不改也行。

### 私有发布的人工前置

1. **建制品库**（已建好）：`h1s97x/npm`（建在 `h1s97x` 组织根下，名字中性、type npm）。
2. **成员权限**：制品库设置 → 成员管理，把消费方仓库成员加成**访客及以上**（拉取需认证）。
3. **不需要任何 secret**：CNB 流水线用平台内置 `${CNB_TOKEN}`（需该 token 具备本制品库
   `registry-package` 读写权限）。GitHub 侧不必再存一份制品库 token。

### 回退到公开库

把 `NPM_REGISTRY` 改回 `https://registry.npmjs.org`、`NPM_SCOPE_REGISTRY` 置空即可。
注意 **registry 切换后包名不变但来源不同**，消费方 `.npmrc` 也要跟着改/删，
否则会去旧地址找。已发布到公开库的版本不受影响。

### 切换前自检

```bash
# 1. 确认制品库可达（实测该库为 Public：未鉴权 GET 也返回 200，库内无版本时是空 packument）
curl -s -o /dev/null -w '%{http_code}\n' \
  https://npm.cnb.cool/h1s97x/npm/-/packages/@h1s97x%2fsdks/typescript   # 期望 200

# 2. 确认公共依赖没被拖进私有库（无 scope 映射时应 401）
npm view commander --registry=https://registry.npmjs.org   # 期望正常返回

# 3. 本地按私有模式打一次包（不发布）
cd sdks/typescript && npm run prepublishOnly && npm pack --ignore-scripts
```

## Python SDK（PyPI 制品库）

Python 包统一走 CNB **PyPI 类型**制品库发布。整个组织共用**一个** PyPI 制品库（本仓库对应
`h1s97x/pypi`，名字中性、不绑定任何单个项目），所有 Python 包都往里放；CNB 按制品类型隔离，
PyPI 库与已有的 npm 库（如 `h1s97x/npm`）互不冲突。

> **为什么 repo 名字要中性**：它是「容器」不是「包名」。一个组织一个 PyPI 库、里面塞很多包，
> 若取名某个项目（如 `elecredit`）会让人误以为「这库只属于某项目」，也不利于后续加别的包。

发布由 `.cnb.yml` → `tag_push` → `publish-pypi-on-tag` 驱动（与 npm 那条同一套
「tag 前缀路由 / 版本校验 / 幂等跳过」设计；目录已从 `python/` 改名为 `sdks/python/`）。

### 命名冲突怎么避免（PyPI 没有 scope，npm 有）

- **npm**：靠 `@h1s97x/xxx` 的 **scope** 天然隔离。一个 npm 库里放任意多个 `@h1s97x/*` 都不撞名，
  所以 npm 侧直接复用组织共用的中性 `h1s97x/npm` 库即可，包名靠 scope 保证唯一。
- **PyPI**：没有 scope，一个 PyPI 库里所有包的 `name` 必须**全局唯一**。靠**组织 slug 当命名空间前缀**解决：
  - 约定：发布到本库的 Python 包，distribution name 统一前缀 `h1s97x-`，例如
    `h1s97x-elecredit`（本 SDK，可选）、`h1s97x-foo`、`h1s97x-bar`。
  - 这是 PyPI 生态的常规做法（参考 `google-cloud-*`、`aliyun-*`）：用前缀手工制造命名空间，
    既避免组织内多包撞名，又明确归属，且前缀绑的是**组织**不是项目。
  - distribution name（`pip install` 用）和 import 名（`import xxx`）可不同；本 SDK import 名仍是 `elecredit`。
  - 当前本 SDK 的发布名暂用 `elecredit`（见 `sdks/python/pyproject.toml` 的 `name`），只要组织内不再有第二个 `elecredit` 包就不会撞；
    想更稳就改成 `h1s97x-elecredit`，工作流会自动读取新名字，无需改 CI。

### 人工前置（一次性）

1. **建 PyPI 制品库**（已建好）：`h1s97x/pypi`（建在 `whccb` 子组织下，名字中性、type PyPI）。
2. **不需要任何 secret**：发布任务用平台内置 `${CNB_TOKEN}`（需具备本制品库 `registry-package` 读写权限）。
3. 成员权限：消费方仓库成员加成**访客及以上**（私有库拉取需认证）。

> 一个 PyPI 制品库可托管组织内所有 Python 包（命名见上方「命名冲突怎么避免」），不限于本项目。

### 发布新版本

```bash
cd sdks/python
# 改 sdks/python/pyproject.toml 的 version，再打 sdk-v<version> tag
git tag sdk-v0.0.5 && git push origin sdk-v0.0.5   # 推 tag 即触发 CNB 的 publish-pypi-on-tag
```

流水线行为（`.cnb.yml` → `tag_push` → `publish-pypi-on-tag`）：

| 步骤 | 说明 |
|------|------|
| 触发 | 推 tag 即触发；脚本只认 `sdk-v*`，其它前缀（含 `cli-v*`）跳过 |
| 校验 tag | tag 去掉 `sdk-v` 必须等于 `pyproject.toml` 的 `version`，否则 `exit 1` |
| 幂等 | 用 simple 索引探测 `elecredit-<version>`，命中则跳过，可安全重推同一个 tag |
| 构建 | `python -m build` 出 sdist + wheel |
| 上传 | `twine upload`，username `cnb`，password 取内置 `${CNB_TOKEN}`，目标 `https://pypi.cnb.cool/h1s97x/pypi/-/packages/simple` |
| 凭据 | 平台内置 `${CNB_TOKEN}`；无效会直接失败，不会静默「成功」 |

> 已发布（对应 tag 已于 2026-11-03 清理）：`0.0.1`（2026-09-30，**本地手工补发**——当时 tag 触发还没修好）、`0.0.2`（同日，由本任务发布，**首次真实走通**）、`0.0.3`（同日，含消费方提的 P0：产品码解包 + 端点元数据补全）、`0.0.4`（同日，修 D11 字段）、`0.0.5`（同日，新增 `judicial_summary` + `judicial_all`）、`0.1.0`（2026-10-12，跨语言错误契约统一）。`0.0.3`–`0.1.0` 均以干净 venv 从本库真实 `pip install elecredit==<版本>` 验证过，`0.0.5` 另在装好后真实调用了两个新 API（`judicial_summary` → `totalCount=13`；`judicial_all` → `calls=3`、12 键齐全）；`0.1.0` 核到 `__version__` → `0.1.0`、`ERROR_CONTRACT` 19 条、`SYS005 → ('billing', 3, False)`、`SYS044 → ('upstream', 4, False)`。
> ⚠️ 实测提示：发布后 simple 索引可能有**数十秒延迟**，紧接着 `pip install elecredit==<新版本>`
> 可能报 `No matching distribution found`，稍等重试即可（制品库标签此时已经是新版本）。

### 消费方安装

```bash
pip config set global.index-url https://cnb:<你的CNB访问令牌>@pypi.cnb.cool/h1s97x/pypi/-/packages/simple
pip install elecredit
```

> 注意：私库只收我们自己的包，构建/安装时的公共依赖（requests / typer / rich / python-dotenv）
> 仍从公网 PyPI 拉取，不存在 npm 那种 scope 代理冲突，无需额外配置。

## GitHub 同步（CNB → GitHub）

本仓库同时托管在 CNB 与 GitHub。**CNB 是唯一权威源**，GitHub 是下游镜像，由 CNB 单向强制推送覆盖。
目标仓库为 `https://github.com/h1s97x/elecredit`（见 `.cnb.yml` 的 `target_url`）；
CNB 侧 slug 以 `.cnb.yml` 与 `.github/workflows/sync-cnb.yml` 的配置为准，
历史文档中出现过的 `elecredit-ts` / `elecredit-api` 均为旧名。

### 同步方向

```text
CNB  push 到 main ──► tencentcom/git-sync (push + force) ──► GitHub main（被强制覆盖）
CNB  页面按钮        ─► tencentcom/git-sync (pull, 手动)  ──► CNB  main（逃生口，非日常）
```

- **CNB → GitHub（唯一主方向）**：`.cnb.yml` 中 `main.push` 的 `sync-to-github`，
  用 [tencentcom/git-sync](https://cnb.cool/cnb/plugins/tencentcom/git-sync)，
  `sync_mode: push` + `force: true` + `push_tags: true`。
- **手动逃生口**：CNB 仓库页面 → 构建 →「手动同步 GitHub→CNB」（`.cnb/web_trigger.yml`），
  `sync_mode: pull`，仅在确实需要把 GitHub 侧内容拉回时手动点一次。
- **GitHub → CNB 自动回灌已移除**：`.github/workflows/sync-cnb.yml` 只保留为备用文件
  （`workflow_dispatch` 手动），不做自动触发。

用 `force` 而非 `rebase`：后者会保留 GitHub 侧特有文件，与「CNB 为准」矛盾，
长期积累成两侧漂移。CNB 推送是**全量**的（含 `.github/**` 与 `.cnb*`），
`git ls-files .github/` 可复核 workflow 文件都由 CNB 持有，force 覆盖不会丢 GitHub 侧文件。
只有一条自动路径，单向天然无同步环。

### 一次性准备（人工，只能在网页上做）

1. GitHub 私有仓库 `h1s97x/elecredit` 已存在。私有仓库未授权访问返回 **404**（而非 403），
   因此 `curl` 探测到 404 **不能**作为「仓库不存在」的依据。
2. [h1s97x/secret-env](https://cnb.cool/h1s97x/secret-env) 的 `env.yml` 中确认
   `GITHUB_USERNAME`（`h1s97x`）与 `GITHUB_TOKEN`（PAT 需勾 **`repo`** 全量范围；
   私有仓库 `public_repo` 不够）。
3. GitHub 侧 Secret `CNB_GIT_TOKEN`：CNB 访问令牌（本仓库读写权限），
   仅在手动走「GitHub → CNB」逃生口时才用到，日常不同步不需要。

主方向只需第 1、2 项。

### 两侧分工（不重复构建）

| 职责 | CNB（`.cnb.yml`） | GitHub Actions |
|------|-------------------|----------------|
| 代码同步（CNB → GitHub 强制推送） | ✅ 唯一方向 | ❌ |
| 敏感信息扫描（gitleaks） | ✅ | ❌ |
| `sdks/typescript` CI | ✅ `ci-typescript-cli`：push / PR 增量；周更跑 Node 22 / 24 + arm64 | ❌（2026-11-03 起无 CI） |
| `python` CI | ✅ `ci-python-sdk`：push / PR 增量；周更跑 3.10 + 3.12 | ❌（同上） |
| OpenAPI 契约校验（Spectral） | ✅ `ci-openapi-contract` | ❌（同上） |
| npm / PyPI 发布 | ✅ `tag_push`（`cli-v*` / `sdk-v*`） | ❌（发布类工作流已删除，避免制品库 token 再复制一份） |
| Issue / PR 自动指派 | ✅ | ❌ |

CNB 公共构建节点只有 Linux 容器，无法提供 macOS / Windows 运行器；
在 CNB 复刻矩阵只能退化成单平台，属于重复劳动而非等价覆盖，因此不做。

### CNB 侧触发事件

| 事件 | 流水线 | 作用 |
|------|--------|------|
| `main.push` | `敏感信息扫描 (gitleaks)` | 拦新提交的密钥（`--no-git` 扫工作区，`--redact` 脱敏日志） |
| `main.push` | `sync-to-github` | 强制推送到 GitHub（含 tag） |
| `main.pull_request` | `敏感信息扫描 (gitleaks)` | PR 门禁 |
| `"**".pull_request` | `auto-assign-pr-owner` | PR 自动指派 |
| `$ issue.open` / `issue.reopen` | `auto-assign-issue-owner` | Issue 自动指派 |
| `$ web_trigger` | `sync from github (pull, manual)` | 手动拉取 GitHub 最新提交 |

### 排查

- **推送同步失败**：先看 CNB 构建日志中 `sync to github` 步骤的输出，
  常见原因是 `GITHUB_TOKEN` 过期或权限不足（`Authentication failed`）。
- **GitHub 侧的提交被覆盖了**：预期行为。要保住改动，请在 CNB 侧提交
  （或先从 GitHub 拉到 CNB 的临时分支，走 PR 合入 CNB `main`）。
- **强制推送被 GitHub 拒绝**：确认 `GITHUB_TOKEN` 有 `repo` 全量范围，
  且目标分支未被 GitHub 侧分支保护规则锁死。
- **想恢复 GitHub 侧内容**：CNB 页面按「手动同步 GitHub→CNB」走一次 pull，
  但这会以 GitHub 覆盖 CNB，与权威源原则相反，只在确认 GitHub 内容正确时使用。
