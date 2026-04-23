import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPaginationMeta, paginationQuerySchema } from "../../shared/utils/pagination.js";
import { sendValidationError } from "../../shared/utils/validation.js";
import { serializeIndexedEvent } from "../events/event.dto.js";
import type { EventService } from "../events/event.service.js";

const walletEventsParamsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const walletEventsQuerySchema = paginationQuerySchema.extend({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  eventName: z.string().min(1).optional(),
  fromBlock: z.coerce.bigint().refine((value) => value >= 0n).optional(),
  toBlock: z.coerce.bigint().refine((value) => value >= 0n).optional()
});

export function registerWalletRoutes(app: FastifyInstance, eventService: EventService): void {
  app.get("/api/wallets/:address/events", async (request, reply) => {
    const params = walletEventsParamsSchema.safeParse(request.params);

    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const query = walletEventsQuerySchema.safeParse(request.query);

    if (!query.success) {
      return sendValidationError(reply, query.error);
    }

    const { page, limit, ...filters } = query.data;

    if (filters.fromBlock !== undefined && filters.toBlock !== undefined && filters.fromBlock > filters.toBlock) {
      return reply.code(400).send({
        error: {
          code: "BAD_REQUEST",
          message: "fromBlock must be less than or equal to toBlock"
        }
      });
    }

    const result = await eventService.listEvents(
      {
        ...filters,
        walletAddress: params.data.address
      },
      { page, limit }
    );

    return {
      data: result.items.map(serializeIndexedEvent),
      meta: createPaginationMeta({ page, limit }, result.total)
    };
  });
}
