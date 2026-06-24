import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<Request>();
  const user = request.session?.user;
  if (!user) {
    throw new Error("CurrentUserId used on an unauthenticated route");
  }
  return user.id;
});
