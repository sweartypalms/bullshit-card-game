import { NextFunction, Request, Response } from "express";

const authMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  // @ts-ignore
  if (request.session.user_id !== undefined) {
    // @ts-ignore
    response.locals.user_id = request.session.user_id; // add stored userId to 'locals' which is accessible by all views
    // @ts-ignore
    response.locals.username = request.session.username;
    // @ts-ignore
    response.locals.isGuest = Boolean(request.session.isGuest);
    next();
  } else {
    response.redirect("/auth/login");
  }
  // Check if the session is initialized
};

export default authMiddleware;
