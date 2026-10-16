import { test, describe } from 'node:test';
import assert from 'node:assert';
import app from '../src/app';

// Helper for making requests to Express app without listening on a port
function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req: any = {
      method,
      url: path,
      originalUrl: path,
      headers: { 'content-type': 'application/json', ...headers },
      body: body || {},
    };

    let statusCode = 200;
    const resHeaders: Record<string, string> = {};

    const res: any = {
      statusCode: 200,
      headersSent: false,
      status(code: number) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, val: string) {
        resHeaders[name.toLowerCase()] = val;
      },
      getHeader(name: string) {
        return resHeaders[name.toLowerCase()];
      },
      json(data: any) {
        this.headersSent = true;
        resolve({ status: statusCode, body: data });
      },
      send(data: any) {
        this.headersSent = true;
        resolve({ status: statusCode, body: data });
      },
      end() {
        this.headersSent = true;
        resolve({ status: statusCode, body: null });
      },
    };

    app(req, res, (err: any) => {
      if (err) reject(err);
      else resolve({ status: statusCode, body: null });
    });
  });
}

describe('Health and Root Endpoints', () => {
  test('GET / should return 200 and running status', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'running');
    assert.strictEqual(res.body.name, 'Collab Code API');
  });

  test('GET /health should return 200 and ok', async () => {
    const res = await makeRequest('GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  test('GET /unknown-path should return 404', async () => {
    const res = await makeRequest('GET', '/unknown-route-12345');
    assert.strictEqual(res.status, 404);
    assert.ok(res.body.error);
  });
});
