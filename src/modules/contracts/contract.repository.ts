import type { Prisma, PrismaClient } from "@prisma/client";
import { getPagination, type PaginationInput } from "../../shared/utils/pagination.js";

export interface ContractListFilters {
  network?: string;
  isActive?: boolean;
}

export class ContractRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(filters: ContractListFilters, pagination: PaginationInput) {
    const where: Prisma.ContractWhereInput = {
      ...(filters.network ? { network: filters.network } : {}),
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive })
    };
    const { take, skip } = getPagination(pagination);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        include: {
          contractEvents: true,
          syncState: true
        },
        orderBy: [{ network: "asc" }, { name: "asc" }],
        take,
        skip
      }),
      this.prisma.contract.count({ where })
    ]);

    return { items, total };
  }

  async findById(id: string) {
    return this.prisma.contract.findUnique({
      where: { id },
      include: {
        contractEvents: true,
        syncState: true
      }
    });
  }
}
