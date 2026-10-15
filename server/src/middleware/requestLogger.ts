import { Request, Response, NextFunction } from "express";

export const requestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  console.log(`${req.method} ${req.url}`);
  next();
};
