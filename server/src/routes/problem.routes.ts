import { Router } from 'express';
import { getProblems, getProblem, createProblem } from '../controllers/problem.controller';

const router = Router();

router.get('/', getProblems);
router.post('/', createProblem);
router.get('/:slug', getProblem);

export default router;
