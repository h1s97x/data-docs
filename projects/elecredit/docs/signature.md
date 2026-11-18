# 签名算法与自测

算法本身与请求头见 [REST API 契约总览](api/elecredit/README.md) 的「签名黄金样本」与「通用约定」。
本文只记录**序列化细节与排错**——决定成败的是这些细节，不是那一行 MD5。

## 三个必须对齐的细节

**一、body 必须是紧凑 JSON。** `separators=(",", ":")`，即 `{"entName":"贵州茅台"}`，
不是 `{"entName": "贵州茅台"}`。多一个空格就签名失败：签名是对**原始字节**算的，
序列化结果不一样，哈希就不一样。

**二、中文不转义。** 必须 `ensure_ascii=False`。默认的 `ensure_ascii=True` 会把 `贵州茅台`
变成 `\u8d35\u5dde...`，签出来必然对不上。

**三、时间戳是毫秒。** `str(int(time.time() * 1000))`，13 位数字字符串。
用秒级时间戳会触发 `SYS002 请求过期`。

## 为什么 SYS005 能证明签名是对的

网关是**先验签、后扣费**。`SYS005 余额不足` 意味着请求已经通过了签名校验，
只是账户余额不足。所以拿到 `SYS005` 就说明签名算法、凭据、序列化、路由**全部正确**，
去改签名、换 App Key、怀疑序列化都是无效排错。充值后同一段代码直接返回真实数据。

## TypeScript / Node.js 参考实现

Python 参考实现见 [REST API 契约总览](api/elecredit/README.md)（另可直接复用 SDK）。
其它语言自行实现时可对照下面这份：

```ts
import { createHash, randomUUID } from 'node:crypto';

export function buildSignedRequest(payload: unknown, appId: string, appKey: string) {
  const sn = randomUUID().replace(/-/g, '');
  const ts = String(Date.now());
  // JSON.stringify 默认就是紧凑 JSON，且不会转义中文
  const body = JSON.stringify(payload);
  const signature = createHash('md5').update(sn + ts + body + appKey, 'utf8').digest('hex');
  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'app-id': appId,
      timestamp: ts,
      'request-sn': sn,
      signature,
      'sign-type': 'MD5',
    },
  };
}
```

`curl` 直连示例见 [REST API 契约总览](api/elecredit/README.md) 的最小请求示例。

## 自测

```bash
cd sdks/python
python -m elecredit.signature    # 退出码 0 = 通过
```

```python
from elecredit.signature import verify_golden_sample
print(verify_golden_sample())   # True
```

## 常见签名失败对照

| 现象 | 原因 | 修法 |
|---|---|---|
| `SYS001` 签名校验失败 | body 序列化不一致（多了空格 / 中文被转义 / 键顺序变了） | 用 `separators=(",", ":")` + `ensure_ascii=False`，并确保签名与发送的是**同一个** body 字符串 |
| `SYS002` 请求过期 | 时间戳不是毫秒，或本机时钟漂移 | 用 `int(time.time() * 1000)`；同步本机 NTP |
| `SYS003` 应用 ID 不存在 | `app-id` 与后台不一致 | 核对 App ID 拼写 |
| `SYS004` 签名算法不支持 | `sign-type` 不是 MD5 | Header 固定 `sign-type: MD5` |
| `SYS006` IP 受限 | 出口 IP 不在白名单 | 联系服务商加白 |

### 一个隐蔽的坑：签名与发送用了不同的 body

很多语言里 `json.dumps(obj)` 被调用两次，若中间改动过对象或用了不同参数，
就会「签名对、发送的不对」。正确做法是：**先序列化一次，拿到 `body` 字符串，
既用它算签名，也原样发送它**。

更多按现象排查见 [常见问题与排障](troubleshooting.md)，错误码分类见
[REST API 契约总览](api/elecredit/README.md#错误码)。
