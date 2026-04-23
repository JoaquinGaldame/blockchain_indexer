import { describe, expect, it } from "vitest";
import {
  createPaginationMeta,
  getPagination,
  paginationQuerySchema
} from "../src/shared/utils/pagination.js";

describe("pagination helpers", () => {
  it("computes take and skip deterministically", () => {
    expect(getPagination({ page: 3, limit: 25 })).toEqual({
      take: 25,
      skip: 50
    });
  });

  it("builds stable pagination metadata at boundaries", () => {
    expect(createPaginationMeta({ page: 1, limit: 25 }, 0)).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    });

    expect(createPaginationMeta({ page: 2, limit: 25 }, 70)).toEqual({
      page: 2,
      limit: 25,
      total: 70,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true
    });
  });

  it("applies defaults and caps limit via schema", () => {
    expect(paginationQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 25
    });

    expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow();
  });
});
