import type { PaginationInput } from "../../shared/utils/pagination.js";
import type { ContractListFilters, ContractRepository } from "./contract.repository.js";

export class ContractService {
  constructor(private readonly contracts: ContractRepository) {}

  async listContracts(filters: ContractListFilters, pagination: PaginationInput) {
    return this.contracts.findMany(filters, pagination);
  }

  async getContract(id: string) {
    return this.contracts.findById(id);
  }
}
