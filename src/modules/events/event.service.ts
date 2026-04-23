import type { PaginationInput } from "../../shared/utils/pagination.js";
import type { IndexedEventFilters, IndexedEventRepository } from "./indexedEvent.repository.js";

export class EventService {
  constructor(private readonly events: IndexedEventRepository) {}

  async listEvents(filters: IndexedEventFilters, pagination: PaginationInput) {
    return this.events.findMany(filters, pagination);
  }

  async getEvent(id: string) {
    return this.events.findById(id);
  }
}
