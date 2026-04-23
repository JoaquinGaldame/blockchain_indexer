import type { SyncStateRepository } from "./syncState.repository.js";

export class SyncStatusService {
  constructor(private readonly syncStates: SyncStateRepository) {}

  async getSyncStatus() {
    return this.syncStates.findAll();
  }
}
