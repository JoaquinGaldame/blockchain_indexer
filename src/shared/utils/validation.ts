import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

export function sendValidationError(reply: FastifyReply, error: ZodError) {
  return reply.code(400).send({
    error: {
      code: "BAD_REQUEST",
      message: "Invalid request parameters",
      details: error.flatten()
    }
  });
}

export function sendNotFound(reply: FastifyReply, resource: string) {
  return reply.code(404).send({
    error: {
      code: "NOT_FOUND",
      message: `${resource} was not found`
    }
  });
}
