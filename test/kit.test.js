import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signTc3Request, createTencentClient, pollTask, DailyQuota, MockAdapter } from '../src/index.js';

const SIGN_ARGS = {
  secretId: 'AKIDEXAMPLE', secretKey: 'test-secret-key',
  service: 'iai', host: 'iai.tencentcloudapi.com',
  action: 'DetectFace', version: '2020-01-01', region: 'ap-guangzhou',
  payload: { ImageUrl: 'https://example.com/a.jpg' }, timestamp: 1767225600,
};

test('TC3: signature is deterministic and well-formed', () => {
  const a = signTc3Request(SIGN_ARGS);
  const b = signTc3Request(SIGN_ARGS);
  assert.equal(a.headers.Authorization, b.headers.Authorization);
  assert.match(a.headers.Authorization, /^TC3-HMAC-SHA256 Credential=AKIDEXAMPLE\/2026-01-01\/iai\/tc3_request, SignedHeaders=content-type;host;x-tc-action, Signature=[0-9a-f]{64}$/);
  assert.equal(a.url, 'https://iai.tencentcloudapi.com');
  assert.equal(JSON.parse(a.body).ImageUrl, 'https://example.com/a.jpg');
});

test('TC3: signature changes when the payload changes', () => {
  const a = signTc3Request(SIGN_ARGS);
  const b = signTc3Request({ ...SIGN_ARGS, payload: { ImageUrl: 'https://example.com/b.jpg' } });
  assert.notEqual(a.headers.Authorization, b.headers.Authorization);
});

test('TC3: client builds fetch-ready options', () => {
  const client = createTencentClient({
    secretId: 'AKIDEXAMPLE', secretKey: 'k', service: 'iai',
    host: 'iai.tencentcloudapi.com', version: '2020-01-01',
  });
  const { url, options } = client.buildRequest('DetectFace', {});
  assert.equal(url, 'https://iai.tencentcloudapi.com');
  assert.equal(options.method, 'POST');
  assert.ok(options.headers.Authorization.startsWith('TC3-HMAC-SHA256'));
});

test('poller: resolves when the task succeeds, with backoff', async () => {
  const statuses = [{ status: 'pending' }, { status: 'running' }, { status: 'succeeded', result: { url: 'x' } }];
  const delays = [];
  const result = await pollTask(async () => statuses.shift(), {
    intervalMs: 100, sleep: async (ms) => { delays.push(ms); },
  });
  assert.deepEqual(result, { url: 'x' });
  assert.deepEqual(delays, [100, 150]);
});

test('poller: throws on failure and on timeout', async () => {
  await assert.rejects(
    pollTask(async () => ({ status: 'failed', error: 'bad image' }), { sleep: async () => {} }),
    /Task failed: bad image/,
  );
  let t = 0;
  await assert.rejects(
    pollTask(async () => ({ status: 'running' }), {
      sleep: async () => {}, now: () => (t += 1000), timeoutMs: 2500, intervalMs: 10,
    }),
    /timed out/,
  );
});

test('quota: enforces the daily limit and resets on a new day', () => {
  let day = new Date(2026, 10, 1);
  const quota = new DailyQuota({ faceswap: 3 }, { now: () => day });
  assert.equal(quota.tryConsume('faceswap').ok, true);
  assert.equal(quota.tryConsume('faceswap', 2).ok, true);
  assert.equal(quota.tryConsume('faceswap').ok, false);
  assert.equal(quota.remaining('faceswap'), 0);
  day = new Date(2026, 10, 2);
  assert.equal(quota.remaining('faceswap'), 3);
  assert.equal(quota.remaining('unlimited-feature'), Infinity);
});

test('mock adapter: sync calls succeed, async task progresses to success', async () => {
  const adapter = new MockAdapter({ stepsToSucceed: 3 });
  const swap = await adapter.faceswap({ imageUrl: 'u', templateId: 't1' });
  assert.equal(swap.status, 'succeeded');
  const { taskId } = await adapter.animateSubmit({ imageUrl: 'u', templateId: 'dance-1' });
  assert.equal((await adapter.taskGet(taskId)).status, 'pending');
  assert.equal((await adapter.taskGet(taskId)).status, 'running');
  const done = await adapter.taskGet(taskId);
  assert.equal(done.status, 'succeeded');
  assert.match(done.resultUrl, /mock:\/\/animate\/dance-1\//);
  await assert.rejects(adapter.taskGet('nope'), /Unknown task/);
});
