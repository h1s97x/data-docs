# 发版约定

三个项目统一采用**双包 tag 路由**，制品库组织共用。

## tag 前缀

| tag 形式 | 包 | 发布目标 |
|---|---|---|
| `cli-v<version>` | TypeScript SDK / CLI（`@h1s97x/<project>`） | CNB npm `h1s97x/npm` + npmjs.org |
| `sdk-v<version>` | Python SDK（`<project>`） | CNB PyPI `h1s97x/pypi` + pypi.org |

- 前缀不匹配自己的 tag → 该流水线跳过（`exit 0`，不算失败）
- tag 去掉前缀必须等于对应包的 `version`，否则 `exit 1`
- 版本已存在于目标源 → 跳过（幂等），可安全重推同一个 tag
- 公网源元数据传播有延迟 → 发布后安装冒烟做退避重试（18 × 20s）
- tag 必须打在含发布配置的提交上（CNB 的 `tag_push` 读 tag 所指提交的 `.cnb.yml`）

## 制品库

| 类型 | 地址 | 说明 |
|---|---|---|
| npm（CNB） | `https://npm.cnb.cool/h1s97x/npm/-/packages/` | 配 scope 级 `.npmrc`（`@h1s97x:registry`），不改全局 registry |
| PyPI（CNB） | `https://pypi.cnb.cool/h1s97x/pypi/-/packages/simple` | 组织共用一个库，包名全局唯一 |
| npmjs.org | `https://registry.npmjs.org` | `NPMJS_TOKEN` 来自 `h1s97x/secret-env` |
| pypi.org | `https://upload.pypi.org/legacy/` | `PYPI_TOKEN` 来自 `h1s97x/secret-env` |

CNB 两通道用平台内置 `${CNB_TOKEN}`，公网两通道用密钥仓库的 token。

## 版本治理

版本号不可变：坏版本**不删、发新版**。删了重发会破坏下游 lockfile 的 integrity，违反平台 `overwrite_policy: forbid`，也让历史无法复现。

各项目的具体版本号与发版命令见主仓 `docs/publishing.md`。
