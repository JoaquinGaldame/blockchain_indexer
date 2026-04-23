import { z } from "zod";
import type { PaginationMeta } from "../types/api.js";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

export interface PaginationInput {
  page: number;
  limit: number;
}

export function getPagination(input: PaginationInput) {
  return {
    take: input.limit,
    skip: (input.page - 1) * input.limit
  };
}

export function createPaginationMeta(input: PaginationInput, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / input.limit);

  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages,
    hasNextPage: input.page < totalPages,
    hasPreviousPage: input.page > 1
  };
}
