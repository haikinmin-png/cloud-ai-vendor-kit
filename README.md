# cloud-ai-vendor-kit

**The unglamorous plumbing every AI app needs — done once, tested, and shared.**

[中文说明](README.zh-CN.md)

Building an AI feature app (face swap, photo dance, stylization…) on Chinese
cloud AI APIs means re-writing the same four pieces every time:

1. **Request signing** — Tencent Cloud's TC3-HMAC-SHA256, easy to get subtly wrong
2. **Async task polling** — dance/video jobs take minutes; you need backoff,
   timeouts, and failure handling, not a `setInterval` and hope
3. **Quota guards** — every vendor call costs money; one runaway loop or one
   abusive user can burn a day of budget in minutes
4. **A mock adapter** — so the product can be built and demoed *before* API
   contracts, keys, and vendor onboarding exist

This kit is those four pieces, dependency-free, with the adapter interface
kept stable so swapping vendors (or going multi-vendor) doesn't rewrite
your product.

## Usage

```js
import { createTencentClient, pollTask, DailyQuota, MockAdapter } from 'cloud-ai-vendor-kit';

// 1. Signed requests for any Tencent Cloud API (keys from env, never code)
const client = createTencentClient({
  secretId: process.env.TENCENT_SECRET_ID,
  secretKey: process.env.TENCENT_SECRET_KEY,
  service: 'iai', host: 'iai.tencentcloudapi.com', version: '2020-01-01',
  region: 'ap-guangzhou',
});
const { url, options } = client.buildRequest('DetectFace', { ImageUrl });

// 2. Poll an async job to completion
const result = await pollTask(() => adapter.taskGet(taskId), { timeoutMs: 600_000 });

// 3. Guard spend before every paid call
const quota = new DailyQuota({ faceswap: 500, animate: 100 });
if (!quota.tryConsume('animate').ok) throw new Error('daily quota exhausted');

// 4. Develop against the mock; swap the adapter when real keys arrive
const adapter = new MockAdapter();
```

## Design rules

- **Secrets never live in code.** Clients take keys from environment
  variables at construction; the kit never logs or persists them.
- **The adapter interface is the product boundary.** `faceswap` (sync),
  `animateSubmit` + `taskGet` (async), `stylize` (sync) — real vendor
  adapters implement the same shape.
- **Costs are a feature.** Quota and polling timeouts are first-class,
  because per-call billing makes them product decisions, not ops details.

## Roadmap

Real adapters (Tencent Face Fusion, Volcengine), Baidu AI signing (HMAC
variant), cost estimation helpers per template catalog, WeChat cloud
function wrappers. See `docs/roadmap.md`.

## License

MIT
