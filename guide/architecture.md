# 契约驱动架构

三个项目（xyj-api / altdatahub / elecredit）共用同一套工程架构。这页是共用约定，各项目具体实现见各自主仓的 `docs/architecture.md`。

## 分层

```
contract/sdk.json          ← 机器可读契约唯一真源（端点 / 模型 / 错误分类）
contract/vectors.json      ← 跨语言行为向量
contract/capabilities.json ← 能力注册表（service / MCP / Skill）
        │
        ▼
tools/gen_code.py          ← 校验契约 → 渲染多语言产物 → manifest
        │
        ▼
sdks/<lang>/                多语言 SDK（生成的数据定义 + 手写的协议逻辑）
service/ mcp/ skills/       能力服务 / AI 接入 / Agent Skill
```

## 两条一致性保障

| 维度 | 机制 | 门禁 |
|---|---|---|
| **数据**（端点 / 模型 / 错误分类） | 生成器从单一契约产出所有语言 | CI `gen_code.py --check` 重跑比对，手改生成物必红 |
| **行为**（签名 / 验签 / 信封） | 跨语言向量精确断言 | 每语言消费者带 PARITY 标记，`verify.py vectors` 校验 |

## 设计取舍

- **生成而不是手写**：跨语言重复的数据定义必然漂移；改一处契约 → 重跑生成器 → 所有语言同步
- **所有字段 nullable**：上游 `required` 约束的是响应，不是 SDK 反序列化；缺字段降级为 `None`/`null`，原文留 `raw`
- **协议逻辑手写**：签名 / 信封 / 验签 / 编排由各语言实现，靠向量保证一致，不生成
- **凭据隔离**：调用方只持 Token，网关凭据只在 `service/` 服务端

## 改契约的流程

1. 编辑主仓 `contract/sdk.json`
2. `python tools/gen_code.py`（重生成所有产物）
3. 全语言回归 + `python tools/gen_code.py --check`
4. 契约与生成物同批提交

各项目契约的具体字段见主仓 `contract/sdk.json`；生成物清单见主仓 `docs/architecture.md`。
