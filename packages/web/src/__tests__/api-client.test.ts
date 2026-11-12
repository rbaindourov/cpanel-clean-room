import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../api/client.ts';

test('ApiClient & Auth Headers Suite', async (t) => {
  await t.test('ApiError correctly sets code, status, and message', () => {
    const err = new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Token expired',
      status: 401,
      requestId: 'req-12345',
      details: { reason: 'jwt_expired' },
    });

    assert.strictEqual(err.name, 'ApiError');
    assert.strictEqual(err.code, 'UNAUTHORIZED');
    assert.strictEqual(err.status, 401);
    assert.strictEqual(err.message, 'Token expired');
    assert.strictEqual(err.requestId, 'req-12345');
    assert.deepStrictEqual(err.details, { reason: 'jwt_expired' });
  });

  await t.test('ApiError preserves status: 0 for network offline states (no coercion to 500)', () => {
    const networkErr = new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Failed to connect to server',
      status: 0,
    });

    assert.strictEqual(networkErr.status, 0, 'status: 0 must not be coerced to 500');
    assert.strictEqual(networkErr.code, 'NETWORK_ERROR');
    assert.strictEqual(networkErr.message, 'Failed to connect to server');

    const defaultErr = new ApiError({
      code: 'GENERIC_ERROR',
      message: 'An error occurred',
    } as any);
    assert.strictEqual(defaultErr.status, 500, 'undefined status defaults to 500');
  });

  await t.test('getHeaders attaches Bearer token when token exists in storage', () => {
    // Setup mock localStorage in Node environment
    const storage: Record<string, string> = {
      panel_access_token: 'mock-jwt-token-xyz',
    };
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
    };

    const client = new ApiClient();
    const headers = client.getHeaders();

    assert.strictEqual(headers.get('Content-Type'), 'application/json');
    assert.strictEqual(headers.get('Authorization'), 'Bearer mock-jwt-token-xyz');
    assert.strictEqual(headers.get('X-Impersonate-User'), null);
  });

  await t.test('getHeaders attaches X-Impersonate-User header when impersonation is active', () => {
    const storage: Record<string, string> = {
      panel_access_token: 'mock-admin-token',
      panel_impersonate_user: 'vahag',
    };
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; },
    };

    const client = new ApiClient();
    const headers = client.getHeaders();

    assert.strictEqual(headers.get('Authorization'), 'Bearer mock-admin-token');
    assert.strictEqual(headers.get('X-Impersonate-User'), 'vahag');

    // Test explicit override
    const customHeaders = client.getHeaders({}, 'another_tenant');
    assert.strictEqual(customHeaders.get('X-Impersonate-User'), 'another_tenant');
  });

  await t.test('setToken and setImpersonateUser properly update and clear storage', () => {
    const storage: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; },
    };

    const client = new ApiClient();

    client.setToken('test-token-123');
    assert.strictEqual(client.getToken(), 'test-token-123');

    client.setImpersonateUser('target-user');
    assert.strictEqual(client.getImpersonateUser(), 'target-user');

    client.setImpersonateUser(null);
    assert.strictEqual(client.getImpersonateUser(), null);

    client.setToken(null);
    assert.strictEqual(client.getToken(), null);
  });

  await t.test('ApiClient.fetch preserves status: 0 on network connection failure', async () => {
    const client = new ApiClient();
    const originalFetch = globalThis.fetch;

    try {
      (globalThis as any).fetch = async () => {
        throw new TypeError('Failed to fetch (ECONNREFUSED)');
      };

      await assert.rejects(
        async () => {
          await client.get('/admin/telemetry');
        },
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.code, 'NETWORK_ERROR');
          assert.strictEqual(err.status, 0, 'network error status must be preserved as 0');
          assert.strictEqual(err.message, 'Failed to fetch (ECONNREFUSED)');
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('ApiClient.fetch parses RFC 7807 problem details with application/problem+json', async () => {
    const client = new ApiClient();
    const originalFetch = globalThis.fetch;

    const rfc7807Payload = {
      type: 'https://example.com/probs/quota-exceeded',
      title: 'Quota Exceeded',
      status: 403,
      detail: 'Disk quota of 1000MB exceeded by 42MB',
      instance: '/api/v1/files/upload',
    };

    try {
      (globalThis as any).fetch = async () => {
        return new Response(JSON.stringify(rfc7807Payload), {
          status: 403,
          headers: { 'Content-Type': 'application/problem+json' },
        });
      };

      await assert.rejects(
        async () => {
          await client.get('/api/v1/files/upload');
        },
        (err: any) => {
          assert.ok(err instanceof ApiError, 'Thrown error must be ApiError');
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'https://example.com/probs/quota-exceeded', 'err.code must extract data.type');
          assert.strictEqual(err.message, 'Disk quota of 1000MB exceeded by 42MB', 'err.message must extract data.detail');
          assert.deepStrictEqual(err.details, rfc7807Payload, 'err.details must contain full RFC 7807 payload');
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('ApiClient.fetch falls back to title when detail is absent in RFC 7807 payload', async () => {
    const client = new ApiClient();
    const originalFetch = globalThis.fetch;

    const titleOnlyPayload = {
      type: 'https://example.com/probs/rate-limit',
      title: 'Too Many Requests',
      status: 429,
    };

    try {
      (globalThis as any).fetch = async () => {
        return new Response(JSON.stringify(titleOnlyPayload), {
          status: 429,
          headers: { 'Content-Type': 'application/problem+json' },
        });
      };

      await assert.rejects(
        async () => {
          await client.get('/api/v1/rate-limited');
        },
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.status, 429);
          assert.strictEqual(err.code, 'https://example.com/probs/rate-limit');
          assert.strictEqual(err.message, 'Too Many Requests', 'err.message must fallback to title');
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('ApiClient.fetch extracts data.code and data.message when data.error is absent', async () => {
    const client = new ApiClient();
    const originalFetch = globalThis.fetch;

    const customJsonPayload = {
      code: 'ACCOUNT_SUSPENDED',
      message: 'Account has been suspended by administrator',
      status: 403,
    };

    try {
      (globalThis as any).fetch = async () => {
        return new Response(JSON.stringify(customJsonPayload), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      await assert.rejects(
        async () => {
          await client.get('/admin/accounts/target');
        },
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'ACCOUNT_SUSPENDED', 'err.code must extract data.code');
          assert.strictEqual(err.message, 'Account has been suspended by administrator', 'err.message must extract data.message');
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('ApiClient.fetch throws HTTP_ERROR on non-JSON response body', async () => {
    const client = new ApiClient();
    const originalFetch = globalThis.fetch;

    try {
      (globalThis as any).fetch = async () => {
        return new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        });
      };

      await assert.rejects(
        async () => {
          await client.get('/metrics/visitors');
        },
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.code, 'HTTP_ERROR');
          assert.strictEqual(err.status, 502);
          assert.strictEqual(err.message, 'Server error (502)');
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
