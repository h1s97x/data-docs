# 架构：契约驱动 + 代码生成

## 分层

```
contract/sdk.json          ← 机器可读契约唯一真源（端点 / 模型 / 错误分类）
contract/vectors.json      ← 跨语言行为向量（签名 / 验签 / 信封）
contract/capabilities.json ← 能力注册表（service / MCP / Skill）
        │
        ▼
tools/gen_code.py          ← 校验契约 → 渲染 11 份产物 → 生成 manifest
        │
        ▼
sdks/<lang>/                8 种语言 SDK（生成模型/端点/错误表 + 手写协议逻辑）
service/ mcp/ skills/       能力服务 / AI 接入 / Agent Skill
```

## 为什么这样设计

参考 `altdatahub` / `elecredit` 的成熟模式：**能生成的绝不手写**。

- 端点路径、模型字段、错误分类在 8 种语言里各写一份必然漂移；
- 改一处契约 → 重跑生成器 → 所有语言同步；
- CI 的 `gen_code.py --check` 把「生成物与契约不一致」变成硬门禁，手改生成物必红。

## 契约内容（`contract/sdk.json`）

| 段 | 内容 | 生成物 |
|---|---|---|
| `models` | 2 个模型：UpstreamRow（14 字段）、ReportTask（1 字段） | 各语言 dataclass/interface/struct/record |
| `endpoints` | 3 个端点：path / cnName / model / collection | `endpoints_generated.py`、TS/Go 端点表 |
| `errors` | 7 个异常类：category / retryable / hint / exitCode | `errors_generated.py` 的 `ERROR_CONTRACT`、各语言错误表 |

所有字段 nullable：required 约束的是上游响应，不是 SDK 反序列化；缺失字段降级为 `None`/`null`，原始 payload 保留在 `raw`。

## 生成物清单（11 份）

- Python：`models_generated.py` / `endpoints_generated.py` / `errors_generated.py`
- TypeScript：`src/types_generated.ts`
- Java：`src/main/java/com/xyj/TypesGenerated.java`
- Go：`types_gen.go`
- C#：`Xyj/TypesGenerated.cs`
- Rust：`src/types_generated.rs`
- C：`include/xyj_types.h` + `src/xyj_types.c`
- `contract/generated.json`：manifest（含 generator 自身 sha256、公开 API 摘要、每份产物 sha256）

C++ 不生成产物：header-only 薄封装复用生成的 C 库（同 altdatahub）。

## 改契约的流程

1. 编辑 `contract/sdk.json`
2. `python tools/gen_code.py`（重生成 11 份）
3. 跑全语言回归 + `python tools/gen_code.py --check`
4. 提交时契约与生成物必须在同一批

## 手写层边界

生成器只产出**数据定义**（模型/端点/错误表）。协议逻辑仍是手写的：
`signature.py`（SHA1withRSA + 规范化）、`envelope.py`（信封）、`client.py`（编排）、
`transport.py`（传输接缝）、`verify.py`（验签）。这些由 `contract/vectors.json` 的
四组向量保证跨语言一致。

这样「数据」由生成器保证一致、「行为」由向量测试保证一致，两者分工明确。
