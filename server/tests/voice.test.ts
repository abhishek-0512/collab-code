import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app';
import { registerRoomSocket } from '../src/sockets/room.socket';

describe('WebRTC Live Voice Signaling & Routing', () => {
  let ioServer: Server;
  let httpServer: any;
  let serverPort: number;
  let clientA: ClientSocket | undefined;
  let clientB: ClientSocket | undefined;
  let clientC: ClientSocket | undefined;

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
    clientC?.removeAllListeners();
    clientA?.disconnect();
    clientB?.disconnect();
    clientC?.disconnect();
    await new Promise<void>((resolve) => {
      ioServer.close(() => {
        httpServer.close(() => resolve());
      });
    });
  });

  test('voice join without joining room emits voice:error', async () => {
    clientA = Client(`http://127.0.0.1:${serverPort}`, { transports: ['websocket'] });

    await new Promise<void>((resolve, reject) => {
      clientA.once('connect', () => {
        clientA.emit('voice:join', { roomId: 'unjoined_room' });
      });

      clientA.once('voice:error', (data) => {
        assert.ok(data.message.includes('Must join room'));
        resolve();
      });

      clientA.once('connect_error', reject);
    });
  });

  test('two participants can join voice room and receive participant notifications', async () => {
    const testRoomId = 'test_voice_room_' + Date.now();

    // Client A joins coding room then joins voice
    await new Promise<void>((resolve) => {
      clientA.emit('room:join', { roomId: testRoomId, username: 'Alice' });
      clientA.once('room:joined', () => {
        clientA.emit('voice:join', { roomId: testRoomId, isMuted: false });
      });
      clientA.once('voice:existing-participants', (data) => {
        assert.strictEqual(data.participants.length, 0); // Alice is first
        resolve();
      });
    });

    // Client B connects, joins coding room, then joins voice
    clientB = Client(`http://127.0.0.1:${serverPort}`, { transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      const bJoinedNotification = new Promise<void>((res) => {
        clientA.once('voice:participant-joined', (data) => {
          assert.strictEqual(data.participant.username, 'Bob');
          res();
        });
      });

      clientB.once('connect', () => {
        clientB.emit('room:join', { roomId: testRoomId, username: 'Bob' });
      });

      clientB.once('room:joined', () => {
        clientB.emit('voice:join', { roomId: testRoomId, isMuted: true });
      });

      clientB.once('voice:existing-participants', async (data) => {
        assert.strictEqual(data.participants.length, 1);
        assert.strictEqual(data.participants[0].username, 'Alice');
        await bJoinedNotification;
        resolve();
      });
    });
  });

  test('WebRTC SDP offer and answer are routed directly to target participant', async () => {
    const testRoomId = 'test_voice_sdp_' + Date.now();

    clientA.emit('room:join', { roomId: testRoomId, username: 'Alice' });
    clientB.emit('room:join', { roomId: testRoomId, username: 'Bob' });

    await new Promise((r) => setTimeout(r, 80));

    clientA.emit('voice:join', { roomId: testRoomId });
    clientB.emit('voice:join', { roomId: testRoomId });

    await new Promise((r) => setTimeout(r, 80));

    // Alice sends SDP offer to Bob
    const offerPromise = new Promise<any>((resolve) => {
      clientB.once('voice:offer', (data) => {
        assert.strictEqual(data.senderUsername, 'Alice');
        assert.strictEqual(data.offer.sdp, 'mock-sdp-offer');
        resolve(data);
      });
    });

    clientA.emit('voice:offer', {
      roomId: testRoomId,
      targetSocketId: clientB.id,
      offer: { type: 'offer', sdp: 'mock-sdp-offer' },
    });

    await offerPromise;

    // Bob sends SDP answer to Alice
    const answerPromise = new Promise<any>((resolve) => {
      clientA.once('voice:answer', (data) => {
        assert.strictEqual(data.answer.sdp, 'mock-sdp-answer');
        resolve(data);
      });
    });

    clientB.emit('voice:answer', {
      roomId: testRoomId,
      targetSocketId: clientA.id,
      answer: { type: 'answer', sdp: 'mock-sdp-answer' },
    });

    await answerPromise;
  });

  test('mute state and speaking indicators broadcast to room', async () => {
    const testRoomId = 'test_voice_indicators_' + Date.now();

    clientA.emit('room:join', { roomId: testRoomId, username: 'Alice' });
    clientB.emit('room:join', { roomId: testRoomId, username: 'Bob' });
    await new Promise((r) => setTimeout(r, 60));

    clientA.emit('voice:join', { roomId: testRoomId, isMuted: false });
    clientB.emit('voice:join', { roomId: testRoomId, isMuted: false });
    await new Promise((r) => setTimeout(r, 60));

    // Test mute broadcast
    const mutePromise = new Promise<any>((resolve) => {
      clientB.once('voice:mute-state', (data) => {
        assert.strictEqual(data.isMuted, true);
        assert.strictEqual(data.socketId, clientA.id);
        resolve(data);
      });
    });

    clientA.emit('voice:mute-state', { roomId: testRoomId, isMuted: true });
    await mutePromise;

    // Test speaking broadcast
    const speakingPromise = new Promise<any>((resolve) => {
      clientB.once('voice:speaking', (data) => {
        assert.strictEqual(data.isSpeaking, true);
        assert.strictEqual(data.socketId, clientA.id);
        resolve(data);
      });
    });

    clientA.emit('voice:speaking', { roomId: testRoomId, isSpeaking: true });
    await speakingPromise;
  });
});
