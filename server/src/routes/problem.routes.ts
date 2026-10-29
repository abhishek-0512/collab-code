import { Router } from 'express';
import { getProblems, getProblem, createProblem, auditProblems } from '../controllers/problem.controller';

const router = Router();

router.get('/', getProblems);
router.get('/audit', auditProblems);
router.post('/', createProblem);
router.get('/:slug', getProblem);

export default router;
