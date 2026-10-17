import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as authService from '../src/services/auth.service';
import { verifyToken } from '../src/utils/jwt';

describe('Authentication & JWT Flow', () => {
  const testUser = {
    username: 'testdeveloper',
    email: 'developer@example.com',
    password: 'securepassword123',
  };

  test('registerUser should create user and return valid JWT token', async () => {
    const res = await authService.registerUser(testUser);
    assert.ok(res.token);
    assert.strictEqual(res.user.username, testUser.username);
    assert.strictEqual(res.user.email, testUser.email);

    // Verify token payload
    const decoded = verifyToken(res.token);
    assert.strictEqual(decoded.username, testUser.username);
    assert.strictEqual(decoded.email, testUser.email);
  });

  test('registerUser with duplicate email should throw error', async () => {
    await assert.rejects(
      async () => {
        await authService.registerUser({
          username: 'anothername',
          email: testUser.email,
          password: 'anotherpassword',
        });
      },
      { message: /already registered/i }
    );
  });

  test('loginUser with valid credentials should succeed and return JWT', async () => {
    const res = await authService.loginUser({
      email: testUser.email,
      password: testUser.password,
    });
    assert.ok(res.token);
    assert.strictEqual(res.user.email, testUser.email);
  });

  test('loginUser with wrong password should fail', async () => {
    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: testUser.email,
          password: 'wrongpassword',
        });
      },
      { message: /invalid/i }
    );
  });

  test('loginUser with non-existent email should fail', async () => {
    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: 'nonexistent@example.com',
          password: 'somepassword',
        });
      },
      { message: /invalid/i }
    );
  });
});
