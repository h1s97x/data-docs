# 发布流程：xyj-api（双包 monorepo）

## 发布通道

统一由 **CNB 流水线** 触发（`.cnb.yml` → `$` → `tag_push`），与 `h1s97x/whccb/elecredit`、`h1s97x/whccb/altdatahub` 同构。本仓库是 monorepo：TS SDK 与 Python SDK 各自独立版本，tag 必须带包前缀，否则一个 tag 同时触发两条流水线、其中一条必因版本不匹配失败。

| tag 形式 | 触发任务 | 版本比对对象 | 产物 |
|---|---|---|---|
| `cli-v<version>` | `publish-npm-on-tag` + `publish-npmjs-on-tag` | `sdks/typescript/package.json` | CNB npm + npmjs.org 的 `@h1s97x/xyj-api` |
| `sdk-v<version>` | `publish-pypi-on-tag` + `publish-pypi-org-on-tag` | `sdks/python/pyproject.toml` | CNB PyPI（`h1s97x/pypi`）+ pypi.org 的 `xyj-api` |

路由行为：

- 前缀**不匹配自己**的 tag → 直接跳过（`exit 0`，不发布、不算失败）；
- 前缀**匹配自己** → tag 去掉前缀后必须等于对应清单的 `version`，否则 `exit 1`；
- 版本已存在于目标源 → 跳过（幂等），可安全重推同一个 tag；
- ⚠️ **tag 必须打在含发布配置的提交上**：CNB 的 `tag_push` 读的是 tag 所指提交里的 `.cnb.yml`。

所有四条任务都做「tag 版本校验 → 已发布则跳过 → 构建 → 上传 → 从目标源安装冒烟」。公网源元数据传播有延迟，冒烟阶段做退避重试。CNB 两通道用平台内置 `${CNB_TOKEN}`，公网两通道用密钥仓库 `h1s97x/secret-env` 的 `NPMJS_TOKEN` / `PYPI_TOKEN`。

## CI 门禁

`.cnb.yml` 在 `main.push` 与 `pull_request` 跑：契约门禁、7 语言 SDK、Python SDK、接入层（service/mcp/skill）、gitleaks；`main.push` 后还强制同步到 GitHub（`h1s97x/xyj-api`，CNB 为权威源）。各 job 按改动目录 `ifModify` 触发。

## 发布新版本

```bash
# TS SDK（cli-v）
cd sdks/typescript
npm version patch            # 或 minor / major
cd ../..
git add -A && git commit -m "chore(release): cli-v<version>"
git push origin main
git tag cli-v<version> && git push origin cli-v<version>

# Python SDK（sdk-v）：先同步改两处版本号
#   - sdks/python/pyproject.toml → version
#   - sdks/python/xyj_api/_version.py → __version__
cd sdks/python && python -m pytest tests/ -q && python -m build && cd ../..
git add -A && git commit -m "chore(release): sdk-v<version>"
git push origin main
git tag sdk-v<version> && git push origin sdk-v<version>
```

## 手动发布（不推 tag）

CNB 仓库页面 → 构建 → 按钮「发布 npm 包到 CNB 制品库」/「发布 PyPI 包到 CNB 制品库」：按当前清单版本发布，版本已存在则跳过（`ALLOW_NO_TAG=true`）。用于验证/重跑链路，不消耗新版本号。另有「手动同步 GitHub→CNB」逃生口（权威源是 CNB，仅应急）。

## 消费方安装

```bash
# CNB npm（需 scope 级 .npmrc）
npm config set @h1s97x:registry https://npm.cnb.cool/h1s97x/npm/-/packages/
npm install @h1s97x/xyj-api

# CNB PyPI
pip config set global.index-url https://cnb:<令牌>@pypi.cnb.cool/h1s97x/pypi/-/packages/simple
pip install xyj-api
```

## 版本治理

版本号不可变：坏版本**不删、发新版**（删了重发会破坏下游 lockfile integrity、缓存，且违反平台 `overwrite_policy: forbid`）。制品库从 `h1s97x/whccb/pypi` 迁到 `h1s97x/pypi` 后，流水线与文档已切到新地址；已发布到旧库的版本继续有效，新版本自然进新库。换库后消费方需把 index-url 改到新地址。
