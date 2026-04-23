import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPaginationMeta, paginationQuerySchema } from "../../shared/utils/pagination.js";
import { sendNotFound, sendValidationError } from "../../shared/utils/validation.js";
import { serializeContract } from "./contract.dto.js";
import type { ContractService } from "./contract.service.js";

const contractListQuerySchema = paginationQuerySchema.extend({
  network: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional()
});

const idParamsSchema = z.object({
  id: z.string().uuid()
});

export function registerContractRoutes(app: FastifyInstance, service: ContractService): void {
  app.get("/api/contracts", async (request, reply) => {
    const parsed = contractListQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }

    const { page, limit, network, isActive } = parsed.data;
    const result = await service.listContracts({ network, isActive }, { page, limit });

    return {
      data: result.items.map(serializeContract),
      meta: createPaginationMeta({ page, limit }, result.total)
    };
  });

  app.get("/api/contracts/:id", async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }

    const contract = await service.getContract(parsed.data.id);

    if (!contract) {
      return sendNotFound(reply, "Contract");
    }

    return {
      data: serializeContract(contract)
    };
  });
}
