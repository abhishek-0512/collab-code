import { Router } from 'express';
import { createRoom, joinRoom, getRoom, getUserRooms, deleteRoom } from '../controllers/room.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createRoomSchema, joinRoomSchema } from '../validators/room.validator';

const router = Router();

router.use(authenticate);

router.post('/', validate(createRoomSchema), createRoom);
router.post('/join', validate(joinRoomSchema), joinRoom);
router.get('/', getUserRooms);
router.get('/:roomId', getRoom);
router.delete('/:roomId', deleteRoom);

export default router;
