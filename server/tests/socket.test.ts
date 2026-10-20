import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app';
import { registerRoomSocket } from '../src/sockets/room.socket';

describe('Real-Time Socket Collaboration & Synchronization', () => {
  let ioServer: Server;
  let httpServer: any;
  let serverPort: number;
  let clientA: ClientSocket;
  let clientB: ClientSocket;

  before(async () => {
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
    clientA?.removeAllListeners();
    clientB?.removeAllListeners();
    clientA?.disconnect();
    clientB?.disconnect();
    await new Promise<void>((resolve) => {
      ioServer.close(() => {
        httpServer.close(() => resolve());
      });
    });
  });

  test('two clients can join room and receive joined confirmations', async () => {
    const testRoomId = 'test_room_' + Date.now();

    await new Promise<void>((resolve, reject) => {
      clientA = Client(`http://127.0.0.1:${serverPort}`, {
        transports: ['websocket'],
      });

      clientA.once('connect', () => {
        clientA.emit('room:join', { roomId: testRoomId, username: 'Alice' });
      });

      clientA.once('room:joined', (data) => {
        assert.strictEqual(data.roomId, testRoomId);
        assert.ok(data.users.length >= 1);
        resolve();
      });

      clientA.once('connect_error', reject);
    });

    // Client B joins same room
    await new Promise<void>((resolve, reject) => {
      clientB = Client(`http://127.0.0.1:${serverPort}`, {
        transports: ['websocket'],
      });

      clientB.once('connect', () => {
        clientB.emit('room:join', { roomId: testRoomId, username: 'Bob' });
      });

      clientB.once('room:joined', (data) => {
        assert.strictEqual(data.roomId, testRoomId);
        assert.strictEqual(data.users.length, 2);
        resolve();
      });

      clientB.once('connect_error', reject);
    });
  });

  test('chat message should broadcast to all members in room', async () => {
    const testRoomId = 'test_room_chat_' + Date.now();

    clientA.emit('room:join', { roomId: testRoomId, username: 'Alice' });
    clientB.emit('room:join', { roomId: testRoomId, username: 'Bob' });

    await new Promise((r) => setTimeout(r, 60));

    const receivedMessagePromise = new Promise<{ message: string; username: string }>((resolve) => {
      clientB.once('room:message', (data) => {
        resolve(data);
      });
    });

    clientA.emit('room:message', {
      roomId: testRoomId,
      message: 'Hello Bob from Alice!',
    });

    const received = await receivedMessagePromise;
    assert.strictEqual(received.message, 'Hello Bob from Alice!');
  });

  test('code update from client A should reach client B', async () => {
    const testRoomId = 'test_room_code_' + Date.now();

    clientA.emit('room:join', { roomId: testRoomId, username: 'Alice' });
    clientB.emit('room:join', { roomId: testRoomId, username: 'Bob' });

    await new Promise((r) => setTimeout(r, 60));

    const codeUpdatePromise = new Promise<{ code: string }>((resolve) => {
      clientB.once('code:update', (data) => {
        resolve(data);
      });
    });

    const sampleCode = 'function collab() { return 42; }';
    clientA.emit('code:update', {
      roomId: testRoomId,
      code: sampleCode,
      language: 'javascript',
    });

    const received = await codeUpdatePromise;
    assert.strictEqual(received.code, sampleCode);
  });

  test('invalid room join payload emits room:error', async () => {
    const errorPromise = new Promise<{ message: string }>((resolve) => {
      clientA.once('room:error', (err) => {
        resolve(err);
      });
    });

    clientA.emit('room:join', { roomId: '' });

    const err = await errorPromise;
    assert.ok(err.message.includes('valid room ID'));
  });
});
