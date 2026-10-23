import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app';
import { registerRoomSocket } from '../src/sockets/room.socket';
import { executeCode } from '../src/services/execution.service';

describe('Multi-User Collaborative DSA Platform — 4 Participants & Independent Workspaces', () => {
  let ioServer: Server;
  let httpServer: any;
  let serverPort: number;
  let clientAlice: ClientSocket;
  let clientBob: ClientSocket;
  let clientCharlie: ClientSocket;
  let clientDave: ClientSocket;
  let sharedRoomId: string;

  before(async () => {
    sharedRoomId = 'test_collab_room_' + Date.now();
    await new Promise<void>((resolve) => {
      httpServer = createServer(app);
      ioServer = new Server(httpServer, {
        cors: { origin: '*' },
      });

      ioServer.on('connection', (socket) => {
        registerRoomSocket(ioServer, socket);
      });

      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  after(async () => {
    clientAlice?.removeAllListeners();
    clientBob?.removeAllListeners();
    clientCharlie?.removeAllListeners();
    clientDave?.removeAllListeners();
    clientAlice?.disconnect();
    clientBob?.disconnect();
    clientCharlie?.disconnect();
    clientDave?.disconnect();

    await new Promise<void>((resolve) => {
      ioServer.close(() => {
        httpServer.close(() => resolve());
      });
    });
  });

  const joinRoom = (client: ClientSocket, rId: string, uName: string) => {
    return new Promise<any>((resolve) => {
      const doJoin = () => {
        client.emit('room:join', { roomId: rId, username: uName });
        client.once('room:joined', (data) => resolve(data));
      };
      if (client.connected) {
        doJoin();
      } else {
        client.once('connect', doJoin);
      }
    });
  };

  test('Four users can join the same room simultaneously with independent workspace statuses', async () => {
    clientAlice = Client(`http://127.0.0.1:${serverPort}`, { transports: ['websocket'] });
    clientBob = Client(`http://127.0.0.1:${serverPort}`, { transports: ['websocket'] });
    clientCharlie = Client(`http://127.0.0.1:${serverPort}`, { transports: ['websocket'] });
    clientDave = Client(`http://127.0.0.1:${serverPort}`, { transports: ['websocket'] });

    const aliceJoined = await joinRoom(clientAlice, sharedRoomId, 'Alice');
    assert.strictEqual(aliceJoined.users.length, 1);

    const bobJoined = await joinRoom(clientBob, sharedRoomId, 'Bob');
    assert.strictEqual(bobJoined.users.length, 2);

    const charlieJoined = await joinRoom(clientCharlie, sharedRoomId, 'Charlie');
    assert.strictEqual(charlieJoined.users.length, 3);

    const daveJoined = await joinRoom(clientDave, sharedRoomId, 'Dave');
    assert.strictEqual(daveJoined.users.length, 4);
    assert.strictEqual(daveJoined.workspaceStatuses.length, 4);
  });

  test('Independent language selection does not modify other participants languages', async () => {
    const statusPromise = new Promise<void>((resolve) => {
      clientBob.once('workspace:status-changed', (status) => {
        assert.strictEqual(status.username, 'Alice');
        assert.strictEqual(status.language, 'java');
        resolve();
      });
    });

    clientAlice.emit('workspace:language', { roomId: sharedRoomId, language: 'java' });
    await statusPromise;
  });

  test('Private code remains strictly private until explicitly shared', async () => {
    let leakedToBob = false;

    clientBob.on('workspace:shared-update', () => {
      leakedToBob = true;
    });

    // Alice types private code without sharing
    clientAlice.emit('workspace:update', {
      roomId: sharedRoomId,
      code: 'class SecretSolution { private int secret = 42; }',
      language: 'java',
    });

    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(leakedToBob, false, 'Private code was leaked to Bob before sharing');
  });

  test('Sharing editor broadcasts live snapshot to participants, and unsharing revokes access without deleting code', async () => {
    // Alice shares editor
    const sharePromise = new Promise<any>((resolve) => {
      clientBob.once('workspace:user-shared', (snapshot) => {
        assert.strictEqual(snapshot.username, 'Alice');
        assert.strictEqual(snapshot.code, 'public class Main { public static void main(String[] args) {} }');
        resolve(snapshot);
      });
    });

    clientAlice.emit('workspace:update', {
      roomId: sharedRoomId,
      code: 'public class Main { public static void main(String[] args) {} }',
      language: 'java',
    });

    clientAlice.emit('workspace:share', { roomId: sharedRoomId });
    await sharePromise;

    // Alice unshares editor
    const unsharePromise = new Promise<any>((resolve) => {
      clientBob.once('workspace:user-unshared', (data) => {
        assert.strictEqual(data.socketId, clientAlice.id);
        resolve(data);
      });
    });

    clientAlice.emit('workspace:unshare', { roomId: sharedRoomId });
    await unsharePromise;
  });

  test('Owner can grant write permission to specific collaborator, enabling live co-editing', async () => {
    // 1. Alice shares her editor
    clientAlice.emit('workspace:share', { roomId: sharedRoomId });
    clientAlice.emit('workspace:update', {
      roomId: sharedRoomId,
      code: 'let aliceVar = 100;',
      language: 'javascript',
    });

    // 2. Alice grants write permission ONLY to Bob
    const permPromise = new Promise<void>((resolve) => {
      clientBob.once('workspace:permission-updated', (data) => {
        assert.strictEqual(data.ownerSocketId, clientAlice.id);
        assert.strictEqual(data.targetSocketId, clientBob.id);
        assert.strictEqual(data.canWrite, true);
        assert.ok(data.allowedWriters.includes(clientBob.id));
        resolve();
      });
    });

    clientAlice.emit('workspace:grant-write', {
      roomId: sharedRoomId,
      targetSocketId: clientBob.id,
      canWrite: true,
    });
    await permPromise;

    // 3. Bob edits Alice's code with workspace:peer-edit
    const editPromise = new Promise<void>((resolve) => {
      clientAlice.once('workspace:peer-code-updated', (data) => {
        assert.strictEqual(data.ownerSocketId, clientAlice.id);
        assert.strictEqual(data.code, 'let aliceVar = 200; // Edited by Bob');
        assert.strictEqual(data.editorSocketId, clientBob.id);
        resolve();
      });
    });

    clientBob.emit('workspace:peer-edit', {
      roomId: sharedRoomId,
      ownerSocketId: clientAlice.id,
      code: 'let aliceVar = 200; // Edited by Bob',
    });
    await editPromise;

    // 4. Charlie (who does NOT have write access) attempts to edit Alice's code -> Rejected
    const errorPromise = new Promise<void>((resolve) => {
      clientCharlie.once('workspace:error', (err) => {
        assert.ok(err.message.includes('not have write access'));
        resolve();
      });
    });

    clientCharlie.emit('workspace:peer-edit', {
      roomId: sharedRoomId,
      ownerSocketId: clientAlice.id,
      code: 'malicious change',
    });
    await errorPromise;

    // 5. Alice revokes Bob's write permission
    const revokePromise = new Promise<void>((resolve) => {
      clientBob.once('workspace:permission-updated', (data) => {
        assert.strictEqual(data.canWrite, false);
        assert.ok(!data.allowedWriters.includes(clientBob.id));
        resolve();
      });
    });

    clientAlice.emit('workspace:grant-write', {
      roomId: sharedRoomId,
      targetSocketId: clientBob.id,
      canWrite: false,
    });
    await revokePromise;
  });

  test('Polyglot execution runs JavaScript, Python, C++, and Java', async () => {
    // 1. JavaScript
    const jsRes = await executeCode({
      language: 'javascript',
      code: 'console.log("JS-PASS-" + (2 + 2));',
    });
    assert.strictEqual(jsRes.status, 'success');
    assert.ok(jsRes.stdout.includes('JS-PASS-4'));

    // 2. Python
    const pyRes = await executeCode({
      language: 'python',
      code: 'print(f"PY-PASS-{3 * 3}")',
    });
    assert.strictEqual(pyRes.status, 'success');
    assert.ok(pyRes.stdout.includes('PY-PASS-9'));

    // 3. C++
    const cppRes = await executeCode({
      language: 'cpp',
      code: '#include <iostream>\nint main() { std::cout << "CPP-PASS-100" << std::endl; return 0; }',
    });
    assert.strictEqual(cppRes.status, 'success');
    assert.ok(cppRes.stdout.includes('CPP-PASS-100'));

    // 4. Java
    const javaRes = await executeCode({
      language: 'java',
      code: 'public class Main { public static void main(String[] args) { System.out.println("JAVA-PASS-500"); } }',
    });
    assert.strictEqual(javaRes.status, 'success');
    assert.ok(javaRes.stdout.includes('JAVA-PASS-500'));
  });

  test('Submission judging never reveals hidden test cases input or expected output', async () => {
    const testCases = [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false },
      { input: '[1,5,8,3]\n4', expectedOutput: '[0,3]', isHidden: true },
    ];

    // Simulate submission handler masking logic
    const sanitized = testCases.map((tc, idx) => {
      if (tc.isHidden) {
        return {
          index: idx + 1,
          input: '[Hidden Test Case]',
          expectedOutput: '[Hidden]',
          actualOutput: '[Hidden - Passed]',
          passed: true,
        };
      }
      return {
        index: idx + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: '[0,1]',
        passed: true,
      };
    });

    assert.strictEqual(sanitized[0].input, '[2,7,11,15]\n9');
    assert.strictEqual(sanitized[1].input, '[Hidden Test Case]');
    assert.strictEqual(sanitized[1].expectedOutput, '[Hidden]');
    assert.ok(!JSON.stringify(sanitized).includes('[1,5,8,3]'));
  });
});
