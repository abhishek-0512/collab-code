import { Router } from 'express';
import { runCode, submitCode, testCode, getSubmissions } from '../controllers/execution.controller';

const router = Router();

router.post('/run', runCode);
router.post('/test', testCode);
router.post('/submit', submitCode);
router.get('/submissions', getSubmissions);

export default router;
