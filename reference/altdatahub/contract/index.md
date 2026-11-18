# 数据契约

## 真源与派生关系

```
《替代数据通 产品数据分册（V1.0）》PDF  （内部资料，*.pdf 不入库）
        │  tools/extract_catalog.py     （坐标解析 + 质量校验，可重放）
        ▼
catalog/products.json                   ← 数据契约真源
catalog/names_en.json                   ← 中文名 → 英文类名显式映射
        │  tools/gen_code.py
        ▼
sdks/python/altdatahub/models.py        51 个产品 + 12 个子结构 dataclass
openapi/openapi.yaml                    唯一 POST 入口 + 51 个 schema
catalog/PRODUCTS.md                     人读速查表
```

任何一环都不许手改下游产物：`sdks/python/tests/test_generated.py` 会重跑生成器并比对。

## 分册事实

| 项 | 值 |
|---|---|
| 名称 | 金融信用信息基础数据库替代数据通 产品数据分册 |
| 版本 | V1.0（2025-12，中国人民银行征信中心） |
| 规模 | 10 个大类 / 51 个 `productCode` / 557 个顶层字段 / 12 个子结构（397 字段）/ 2 个查询参数 |

## 容易误判的目录事实

| 现象 | 结论 |
|---|---|
| 编码前缀不连续（无 S03、S06） | 分册如此，产品编码不属于章节号体系 |
| `S1104` 仅 4 字段、`S1106` 仅 3 字段 | 分册原文如此，不是解析漏字段 |
| `S0206` 下有叫「产品结构」的子结构 | 分册里的容器节点，保留原名以回溯 |
| 只有 `S0206` / `S1201` 有「产品参数」 | 分册只给这两类产品定义了查询参数 |
| 字段 `required` 不阻止解析 | 「非空」是上游约束；SDK 遇缺失降级为 `None` 并保留 `raw` |

## 传输契约

POST + 8 个 `eds_*` 公共参数 + 业务参数平铺，**无签名**，鉴权靠 `eds_account`。响应信封 `data[].data` 两层展平解包，错误码 `code` / 描述 `msg` 已由真实响应确认。EDS 网关已于 2026-11-16/17 完成 51 个产品全量在线验证，完整说明见 [能力矩阵](capabilities)。

产品目录速查表见 `/projects/altdatahub/catalog/PRODUCTS`，机器契约见 `/projects/altdatahub/openapi/service.yaml`。
