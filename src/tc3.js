import { createHash, createHmac } from 'node:crypto';

// Tencent Cloud API 3.0 signature (TC3-HMAC-SHA256), implemented from the
// public signing spec. Pure function: no network, fully unit-testable.
const sha256hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const hmac = (key, s) => createHmac('sha256', key).update(s, 'utf8').digest();

/**
 * Sign a Tencent Cloud API request.
 * @returns {{ url: string, headers: Record<string,string>, body: string }}
 */
export function signTc3Request({
  secretId, secretKey, service, host, action, version, region,
  payload = {}, timestamp,
}) {
  if (!secretId || !secretKey) throw new Error('secretId and secretKey are required');
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const date = new Date(ts * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);

  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256hex(body)].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = ['TC3-HMAC-SHA256', String(ts), credentialScope, sha256hex(canonicalRequest)].join('\n');

  const kDate = hmac(`TC3${secretKey}`, date);
  const kService = hmac(kDate, service);
  const kSigning = hmac(kService, 'tc3_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const headers = {
    Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': 'application/json; charset=utf-8',
    Host: host,
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Timestamp': String(ts),
  };
  if (region) headers['X-TC-Region'] = region;
  return { url: `https://${host}`, headers, body };
}

/** Thin client factory: build signed fetch() options for any Tencent Cloud API action. */
export function createTencentClient({ secretId, secretKey, service, host, version, region }) {
  return {
    buildRequest(action, payload) {
      const { url, headers, body } = signTc3Request({
        secretId, secretKey, service, host, action, version, region, payload,
      });
      return { url, options: { method: 'POST', headers, body } };
    },
  };
}
