import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as roomService from '../src/services/room.service';

describe('Room Management & Access', () => {
  const ownerId = 'user_owner_123';
  const collaboratorId = 'user_collab_456';
  let createdRoomId = '';
  let inviteCode = '';

  test('createRoom should generate room with unique roomId and inviteCode', async () => {
    const room = await roomService.createRoom(
      {
        name: 'Algorithm Study Group',
        description: 'Solving dynamic programming problems together',
        language: 'typescript',
        isPrivate: true,
      },
      ownerId
    );

    assert.ok(room.roomId);
    assert.ok(room.inviteCode);
    assert.strictEqual(room.name, 'Algorithm Study Group');
    assert.strictEqual(room.language, 'typescript');
    assert.strictEqual(room.isOwner, true);
    assert.ok(room.code.length > 0);

    createdRoomId = room.roomId;
    inviteCode = room.inviteCode;
  });

  test('getRoomByRoomId should return room details', async () => {
    const room = await roomService.getRoomByRoomId(createdRoomId, ownerId);
    assert.strictEqual(room.roomId, createdRoomId);
    assert.strictEqual(room.isOwner, true);
  });

  test('joinRoomByInviteCode should allow collaborator to join', async () => {
    const room = await roomService.joinRoomByInviteCode(inviteCode, collaboratorId);
    assert.strictEqual(room.roomId, createdRoomId);
    assert.strictEqual(room.isOwner, false);
    assert.ok(room.memberCount >= 2);
  });

  test('joinRoomByInviteCode with invalid code should fail', async () => {
    await assert.rejects(
      async () => {
        await roomService.joinRoomByInviteCode('INVALID99', collaboratorId);
      },
      { message: /invalid invite code/i }
    );
  });

  test('updateRoomCode should persist editor contents', async () => {
    const newCode = 'console.log("Updated collaborative code!");';
    await roomService.updateRoomCode(createdRoomId, newCode, 'javascript');

    const updated = await roomService.getRoomByRoomId(createdRoomId, ownerId);
    assert.strictEqual(updated.code, newCode);
    assert.strictEqual(updated.language, 'javascript');
  });

  test('getUserRooms should return rooms where user is member or owner', async () => {
    const rooms = await roomService.getUserRooms(ownerId);
    assert.ok(rooms.length >= 1);
    const found = rooms.find((r) => r.roomId === createdRoomId);
    assert.ok(found);
  });
});
