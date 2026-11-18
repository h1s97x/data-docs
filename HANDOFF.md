# 交接记录（2026-11-18）

> 本文件记录在统一文档站建设完成时的真实状态。**当前工作环境即将销毁**，
> 本文件已 push 到 `h1s97x/whccb/data-docs`，是环境销毁后仍可读取的状态快照。
> 站点：<https://h1s97x.github.io/data-docs/>

## 一、已完成的架构（四仓）

三个 SDK 仓库（xyj-api / altdatahub / elecredit）已完全统一架构：

- 目录：`contract/` + `tools/gen_code.py` + `sdks/<lang>/` + `service/` + `mcp/` + `skills/` + `docs/`
- 契约驱动：`contract/sdk.json`（或 altdatahub 的 `catalog/products.json`）→ 生成器 → 多语言产物，CI `--check` 门禁
- 跨语言：`contract/vectors.json` + 各语言 PARITY 标记（xyj-api 8 种语言）
- 发版：双包 tag 约定 `cli-v<version>`（TS）/ `sdk-v<version>`（Python），制品库 `h1s97x/npm` 与 `h1s97x/pypi`
- 文档：README 统一八段骨架；`docs/architecture.md` 记录契约驱动架构

## 二、最终状态（核查时间 2026-11-18）

| 仓库 | HEAD | 工作区 | CI |
|---|---|---|---|
| `h1s97x/whccb/xyj-api` | `8be3fd9` | 干净、与 origin 同步 | `cnb-4ps-1k7mvj288` success |
| `h1s97x/whccb/altdatahub` | `2a53995` | 干净、与 origin 同步 | `cnb-095-1k7mvo7ik` success |
| `h1s97x/whccb/elecredit` | `fa9eb69` | 干净、与 origin 同步 | `cnb-k28-1k7mvjkoc` success |
| `h1s97x/whccb/data-docs` | `9ced203` | 干净 | 构建/同步流水线 success |

站点 7 个关键页面全部 HTTP 200：首页、`guide/architecture`、`guide/release-conventions`、
`guide/sdk-matrix`、`projects/{xyj-api,altdatahub,elecredit}/README`。

三份快照 source 与各自主仓 HEAD 一致：
`xyj-api@8be3fd9`、`altdatahub@2a53995`、`elecredit@fa9eb69`。

## 三、已真实发布的包（registry 实测）

| 包 | CNB | npmjs.org / pypi.org |
|---|---|---|
| `@h1s97x/xyj-api` | 0.1.0 | npmjs 0.1.0 |
| `xyj-api` (PyPI) | 0.0.4 | pypi.org 0.0.4 |
| `@h1s97x/altdatahub` | 0.1.0 | npmjs 0.1.0 |
| `altdatahub` (PyPI) | 0.1.0 | pypi.org 0.1.0 |
| `@h1s97x/elecredit` | 0.1.2 | npmjs 0.1.2 |
| `elecredit` (PyPI) | 0.1.1 | pypi.org 0.1.1 |

远端 tag：xyj-api `cli-v0.1.0` + `sdk-v0.0.1..0.0.4`；altdatahub `cli-v0.1.0` + `sdk-v0.1.0`；
elecredit `cli-v0.1.1/0.1.2` + `sdk-v0.1.1`。新发版约定已实跑验证。

## 四、文档站工作机制（接手必读）

```
三个主仓 docs/（唯一事实源）
  └─ CI job ci-docs-snapshot（ifModify: docs/**, contract/**, openapi/**, tools/export_docs.py 等）
       └─ tools/export_docs.py 或 tools/verify.py export
            → contract/snapshot/（脱敏 + manifest.json：source commit / sha256 / redactions）
       └─ clone data-docs → 写 projects/<slug>/ → commit "docs(snapshot): <repo>@<short>"
            → push 冲突重试 3 次；内容未变则 skip
data-docs（CNB 内容源）
  └─ CI: pnpm check（校验三份 manifest + 脱敏）→ gen-nav → vitepress build
       └─ git-sync force → GitHub h1s97x/data-docs（公开）
            └─ .github/workflows/docs.yml → Pages
```

**改文档永远改主仓 `docs/`，不要直接编辑 data-docs 的 `projects/`。**

关键设计点（踩过的坑，勿回退）：
- exporter 的 placeholder 转义（`VITE` 兼容）只在**快照导出层**，不放进 `redact()` 本身 ——
  altdatahub 的 `test_verify.py` 断言 `redact()` 输出 `<EDS_HOST>`
- 脱敏正则加了负向预查，不误报文档里的 `...` / `YOUR_*` 占位赋值
- `ignoreDeadLinks: true`：快照是白名单，链接常指向未导出的源码，属预期
- 首次建 GitHub Pages 需 admin 权限：`api_trigger_bootstrap_pages` 用 secret-env 的 PAT 幂等启用
- 快照推送是独立 CI job，不要合并回 `ci-python`（其 ifModify 不覆盖 docs/tools，会被跳过）

## 五、遗留 / 待跟进（环境销毁后需要人处理的只有这一项）

**旧 GitHub Pages（<https://h1s97x.github.io/elecredit-docs/>、
<https://h1s97x.github.io/altdatahub-docs/>）尚未显示跳转提示。**

- 现状：两站仍 HTTP 200，显示旧文档，没有跳到 data-docs
- 已做：`data-docs` 的 `api_trigger_archive_old_sites` job（`cnb-k97-1k7mvg89u`）通过 GitHub
  Contents API 向两仓根写了 `index.html` 跳转页，job success
- 未生效原因：两站由各自仓库的 `.github/workflows/docs.yml` 用 VitePress 从源码重建，
  根目录写入的 `index.html` 会被构建产物覆盖
- 后续处理（任选其一）：
  1. 在两个旧 GitHub 仓的 `.github/workflows/docs.yml` 里把部署步骤改成直接发布一个静态跳转页
  2. 在 GitHub 仓库设置里关闭 Pages（旧链接会 404，但新站已成权威）
  3. 不管它 —— 旧站是历史快照，主仓 README 与 data-docs 已明确指向新站

CNB 侧旧仓状态：`elecredit-docs` **平台已归档**（push 返回 `Repository has been archived` / 403，只读）；
`altdatahub-docs` 已 404（不存在或私有）。两者都不需要再动。

## 六、其它已知边界（不是 bug，别当待办修）

- xyj-api 响应验签只覆盖 `data`，且真实样本中 `data` 恒为空数组；非空 `data` 的规范化口径待网关给样本后复核（`xyj verify-probe`）
- 一个服务实例对应一套网关凭据（`XYJ_*` / `EDS_*`）；多网关需部署多实例
- Rust / C / C++ 为签名引入 crypto 与系统库依赖（已诚实标注在各自 README）
- gitleaks 按路径白名单放行测试私钥夹具（`sdks/python/tests/_fixtures.py`、`contract/vectors.json`）

## 七、环境与凭据

- 所有操作通过 CNB OpenAPI CLI（`cnb build ...`）与 git 完成；凭据用平台内置 `${CNB_TOKEN}` 与
  密钥仓库 `h1s97x/secret-env` 的 `GITHUB_USERNAME` / `GITHUB_TOKEN` / `NPMJS_TOKEN` / `PYPI_TOKEN`
- 本地曾安装的工具链（环境销毁后需重装）：Node 22 / JDK 17 + Maven（阿里云镜像 `sdks/java/settings.xml`）/
  Go / .NET 8 / Rust 1.91 / GCC 14 + `libjson-c-dev` / Python 3.12
- 参考仓库 `altdatahub/` / `elecredit/` 曾被 clone 到 xyj-api 工作区用于设计参考，已在 `.gitignore` 中忽略，
  未进入任何提交
