import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { HealthResponse, ReadyResponse } from "../../shared/types/http.js";

interface HealthRoutesOptions {
  prisma: PrismaClient;
}

export function registerHealthRoutes(
  app: FastifyInstance,
  options: HealthRoutesOptions
): void {
  app.get("/health", (): HealthResponse => ({
    status: "ok"
  }));

  app.get("/ready", async (_request, reply): Promise<ReadyResponse> => {
    try {
      await options.prisma.$queryRaw`SELECT 1`;

      return {
        status: "ready"
      };
    } catch (error) {
      app.log.error({ error }, "Readiness check failed");
      reply.code(503);

      return {
        status: "not_ready"
      };
    }
  });
}
