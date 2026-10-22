import { Request, Response } from 'express';
import * as problemService from '../services/problem.service';
import { sendSuccess, sendError } from '../utils/apiResponse';

export async function getProblems(req: Request, res: Response): Promise<void> {
  try {
    const { difficulty } = req.query;
    const problems = await problemService.getProblems(difficulty as string | undefined);
    sendSuccess(res, problems);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to retrieve problems', 500);
  }
}

export async function getProblem(req: Request, res: Response): Promise<void> {
  try {
    const problem = await problemService.getProblemBySlug(req.params.slug as string);
    sendSuccess(res, problem);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Problem not found', 404);
  }
}

export async function createProblem(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, difficulty, tags, constraints, examples, starterCode } = req.body;
    if (!title || !description) {
      sendError(res, 'Title and description are required', 422);
      return;
    }
    const problem = await problemService.createProblem({
      title,
      description,
      difficulty,
      tags,
      constraints,
      examples,
      starterCode,
    });
    sendSuccess(res, problem, 'Problem created successfully', 201);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to create problem', 500);
  }
}
