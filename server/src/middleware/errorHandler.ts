import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Server error:", err.message);

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({
    error: "Internal server error",
  });
};
