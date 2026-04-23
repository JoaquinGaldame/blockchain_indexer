import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPaginationMeta, paginationQuerySchema } from "../../shared/utils/pagination.js";
import { sendNotFound, sendValidationError } from "../../shared/utils/validation.js";
import { serializeIndexedEvent } from "./event.dto.js";
import type { EventService } from "./event.service.js";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

const eventListQuerySchema = paginationQuerySchema.extend({
  contractAddress: addressSchema.optional(),
  eventName: z.string().min(1).optional(),
  txHash: txHashSchema.optional(),
  walletAddress: addressSchema.optional(),
  fromBlock: z.coerce.bigint().refine((value) => value >= 0n).optional(),
  toBlock: z.coerce.bigint().refine((value) => value >= 0n).optional()
});

const idParamsSchema = z.object({
  id: z.string().uuid()
});

export function registerEventRoutes(app: FastifyInstance, service: EventService): void {
  app.get("/api/events", async (request, reply) => {
    const parsed = eventListQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }

    const { page, limit, ...filters } = parsed.data;

    if (filters.fromBlock !== undefined && filters.toBlock !== undefined && filters.fromBlock > filters.toBlock) {
      return reply.code(400).send({
        error: {
          code: "BAD_REQUEST",
          message: "fromBlock must be less than or equal to toBlock"
        }
      });
    }

    const result = await service.listEvents(filters, { page, limit });

    return {
      data: result.items.map(serializeIndexedEvent),
      meta: createPaginationMeta({ page, limit }, result.total)
    };
  });

  app.get("/api/events/:id", async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }

    const event = await service.getEvent(parsed.data.id);

    if (!event) {
      return sendNotFound(reply, "Indexed event");
    }

    return {
      data: serializeIndexedEvent(event)
    };
  });
}
