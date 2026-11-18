---
name: xyj-service
version: 1.0.0
description: 查询企业发票上下游流水与报告。当用户需要查企业上下游/发票流水、申请或查询 xyj 报告、核对纳税主体交易对手时使用；仅通过 xyj 能力服务调用，不接触网关私钥。
---

# xyj 企业上下游 / 报告查询

## 文件加载策略

| 文件 | 何时加载 |
|---|---|
| `SKILL.md`（本文件） | 始终 |
| `scripts/query.py` | 执行查询时 |
| `references/capabilities.md` | 需要确认某个能力的字段或错误口径时 |

## 诚实口径（必须遵守）

- 能力清单（`capabilities` / `ping`）**离线可用**；三个查询能力需要服务端配置 `XYJ_*` 凭据；
- 查询失败必须如实报告为「数据源不可用 / 配置缺失 / 上游失败」，**绝不**说成「这家企业没有上下游」，
  更不得编造企业名、税号或流水；
- 本 Skill **永远不向用户索要** `XYJ_PRIVATE_KEY` / `XYJ_PUBLIC_KEY` / 调用方 Token；
  这些只在服务端配置；
- `success=false` 且 `category=configuration` 表示服务端未配网关凭据——提示运维补配置，不是无数据；
- `data` 为空 / `upstreamTotal=0` 是**正常空结果**，不是故障；字段定义（`references/`）不是真实业务记录；
- 大结果用 `--output` 落盘，只在对话里报告路径与大小，不整段粘贴。

## 阶段 0：配置检查（先做）

```bash
echo "URL=${XYJ_SERVICE_URL:-[unset]} TOKEN=${XYJ_SERVICE_TOKEN:+set}"
```

若任一未设置，停止并告知用户需要先部署 `service/` 并签发调用方 Token；不要尝试直连网关。

## 阶段 1：查询流程

脚本路径：`scripts/query.py`（零依赖，Python 3.10+）。

1. 不确定能力名时先列能力：

   ```bash
   python skills/xyj-service/scripts/query.py --capability capabilities
   ```

2. 企业上下游查询（发票流水口径）：

   ```bash
   python skills/xyj-service/scripts/query.py --capability upstream \
     --param company_name=某企业 --param nsrsbh=9133xxxx --param data_key=220_xxx \
     --param query_type=1
   ```

   `query_type=1` 裂变模式（默认）/ `2` 标签模式；`data_key` 由业务方提供。

3. 报告申请 → 取 taskNo → 查询（轮询由调用方编排，本 Skill 只做单次调用）：

   ```bash
   python skills/xyj-service/scripts/query.py --capability report_apply \
     --param nsrmc=某企业 --param nsrsbh=9133xxxx --param report_key=803_xxx
   python skills/xyj-service/scripts/query.py --capability report_query --param task_no=T-123
   ```

4. 需要完整结果时加 `--format json --output /path/to/result.json`。

## 阶段 2：呈现规则

- 先报告 `上游 N 条 / 下游 M 条`，再按需列前 5 条；不要按金额排序取前 N（那是消费方展示策略）；
- `taskNo` 要原样给出，方便用户后续查询；
- 响应里 `_compacted: true` 表示结果被压缩，提示用 `--output` 取完整数据；
- 报告申请成功后，**轮询与落库不在本 Skill 范围内**，明确告知用户。

## 错误对照表

| 现象 | 含义 | 处理 |
|---|---|---|
| `category=configuration` | 服务端没配 `XYJ_*` | 提示运维补配置，不重试 |
| `category=validation` | 参数不合法 | 核对企业名/税号/data_key 后重提 |
| `category=upstream` + `retryable=true` | 网关瞬时故障 | 指数退避后重试 |
| `category=upstream` + `retryable=false` | 上游业务失败 | 按 `code`/`msg` 如实报告 |
| `category=contract` | 验签/信封异常 | 提示核对 `XYJ_PUBLIC_KEY`，不重试 |
| HTTP 401 / 403 | Token 无效 / scope 不足 | 重新签发 Token |
| HTTP 429 | 限流 | 稍后重试 |
| 连接失败 | 服务不可达 | 检查 `XYJ_SERVICE_URL` 与服务进程 |

**重试与否一律跟随 `retryable` 字段**，不要凭 HTTP 状态码猜。

## 能力边界

- 只做「查上下游 / 申请报告 / 查报告 / 列能力 / 健康检查」；
- 不落库、不轮询、不排序、不做授权回调页；
- 直连网关的协议细节见 `docs/protocol.md`，消费方集成见 `docs/INTEGRATION.md`。
