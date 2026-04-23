# Ethereum Sepolia Indexer

Backend service for indexing Ethereum Sepolia smart contract events into PostgreSQL and exposing them through a queryable HTTP API.

## Professional Summary

This project demonstrates a backend-oriented approach to Web3 data ingestion: contract configuration stored in PostgreSQL, event indexing driven by `ethers`, transactional persistence through Prisma, and a Fastify API for querying indexed activity by contract, event, transaction hash, block range, and wallet address.

It is intentionally designed as infrastructure rather than a demo dApp. The focus is on operational concerns that matter in real backend systems: idempotency, resumable sync, historical catch-up, live polling, structured logging, deterministic persistence, and API queryability over indexed blockchain data.

## Why This Project Matters in Web3 / Backend Engineering

Blockchain integrations often fail at the boundary between chain data and application data. Reading logs from an RPC provider is easy; building a service that can replay, resume, deduplicate, persist, and expose that data reliably is the real engineering work.

This codebase targets that problem directly:

- it models blockchain indexing as a backend ingestion pipeline
- it treats PostgreSQL as the application source of truth
- it separates RPC reads from API reads
- it preserves resumability and duplicate protection across restarts
- it exposes indexed data through normal backend query patterns

That makes it relevant to Web3 infra roles, backend platform roles, and teams building data-heavy services around on-chain activity.

## Main Features

- Historical sync from a configured contract `startBlock`
- Live sync polling after historical catch-up
- Contract configuration loaded from PostgreSQL at runtime
- ABI-based event decoding with normalized JSON persistence
- Generic wallet participant extraction from decoded event fields
- Queryable API for contracts, events, wallet activity, and sync status
- Idempotent event persistence with duplicate protection
- Resume-after-restart using persisted sync checkpoints
- Manual SQL schema workflow with Prisma as ORM client, not migration source of truth
- Native and Docker-based local development support

## Architecture Overview

The application is structured as an ingestion service plus a read API:

- `IndexerService` reads active contract configuration from PostgreSQL
- `EthersBlockchainClient` pulls logs from an Ethereum Sepolia RPC provider
- decoded logs are normalized and persisted transactionally
- wallet participants are extracted and linked to indexed events
- Fastify routes expose indexed state from PostgreSQL without querying the chain directly

```mermaid
flowchart LR
  RPC[Ethereum RPC Provider] --> IDX[Indexer Service]
  IDX --> DEC[Event Decoder + Participant Extractor]
  DEC --> DB[(PostgreSQL)]
  DB --> API[Fastify API]
  API --> CLIENT[Client / Postman / Frontend]
```

### Core Runtime Flow

1. Load environment configuration.
2. Load active contracts from PostgreSQL.
3. Read `sync_states` to determine resume position per contract.
4. Fetch logs in block batches up to the current safe block.
5. Decode logs using the configured ABI.
6. Normalize event payloads and extract wallet participants.
7. Persist events, participants, and sync progress in one transaction.
8. Continue in live polling mode once historical sync catches up.

## Tech Stack

- Node.js 20+
- TypeScript
- Fastify
- PostgreSQL 16
- Prisma Client
- ethers v6
- Zod
- pino
- Vitest
- Docker / Docker Compose

## Data Model Summary

The project uses PostgreSQL as the durable application store. Manual SQL scripts in `database/` define the canonical schema.

### Core Tables

- `contracts`
  Stores runtime contract configuration, ABI JSON, deployment start block, network, and active status.

- `contract_events`
  Stores known event names per contract for reference and relationship mapping.

- `indexed_events`
  Stores normalized decoded events with contract linkage, tx hash, block metadata, raw decoded payload, and duplicate protection.

- `wallet_addresses`
  Stores normalized lowercase wallet addresses for cross-event querying.

- `event_participants`
  Join table between `indexed_events` and `wallet_addresses`, with semantic metadata such as `role` and source argument name.

- `sync_states`
  Stores indexing progress per contract, including `last_synced_block`, current status, and last error.

### Persistence and Operational Concerns

- Idempotency:
  final duplicate protection is enforced by the unique key `(contract_id, tx_hash, log_index)`.

- Resume after restart:
  sync progress is stored in `sync_states`; restart resumes from `last_synced_block + 1`.

- Atomic batch progression:
  event writes and sync-state advancement are committed together in one database transaction.

- Queryability:
  event and wallet lookup is served from PostgreSQL, not from live RPC reads.

## API Endpoints Summary

### Health and Readiness

- `GET /health`
- `GET /ready`

### Contracts

- `GET /api/contracts`
- `GET /api/contracts/:id`

### Events

- `GET /api/events`
- `GET /api/events/:id`

Supported event list filters:

- `contractAddress`
- `eventName`
- `txHash`
- `walletAddress`
- `fromBlock`
- `toBlock`
- `page`
- `limit`

### Wallet Activity

- `GET /api/wallets/:address/events`

Supported wallet event filters:

- `contractAddress`
- `eventName`
- `fromBlock`
- `toBlock`
- `page`
- `limit`

### Sync Status

- `GET /api/sync-status`

### Example Requests

```bash
curl http://127.0.0.1:3000/health
```

```bash
curl "http://127.0.0.1:3000/api/contracts?network=sepolia&isActive=true&page=1&limit=10"
```

```bash
curl "http://127.0.0.1:3000/api/events?contractAddress=0xfff9976782d46cc05630d1f6ebab18b2324d6b14&eventName=Transfer&page=1&limit=25"
```

```bash
curl "http://127.0.0.1:3000/api/events?walletAddress=0x0000000000000000000000000000000000000001&page=1&limit=25"
```

```bash
curl "http://127.0.0.1:3000/api/wallets/0x0000000000000000000000000000000000000001/events?page=1&limit=25"
```

```bash
curl http://127.0.0.1:3000/api/sync-status
```

## Local Setup

The project supports both native development and Docker-based development. Docker is optional; the runtime remains compatible with a normal local Node.js workflow.

### Native Development

1. Install dependencies.
2. Create `.env` from `.env.example`.
3. Start PostgreSQL.
4. Apply the manual SQL scripts.
5. Generate Prisma Client.
6. Start the API and, optionally, the indexer.

Commands:

```bash
npm install
npm run prisma:generate
npm run dev
```

### Docker Development

Development containers are provided for:

- `app` on port `3000`
- `postgres` on port `5432`

Start both services with:

```bash
docker compose up --build
```

PostgreSQL data is persisted through a named Docker volume.

## Environment Variables

The application uses Zod-based environment validation and fails fast on invalid runtime configuration.

### Concise `.env` Example

```env
NODE_ENV=development
LOG_LEVEL=info
HOST=0.0.0.0
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blockchain_indexer?schema=public
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
INDEXER_NETWORK=sepolia
INDEXER_ENABLED=false
INDEXER_BATCH_SIZE=1000
INDEXER_CONFIRMATIONS=2
INDEXER_POLL_INTERVAL_MS=12000
CONTRACT_BOOTSTRAP_CONFIG=[{"name":"SampleErc20","address":"0x0000000000000000000000000000000000000000","network":"sepolia","chainId":11155111,"abiPath":"src/contracts/abi/SampleErc20.json","startBlock":0,"isActive":true}]
DOCKER_INDEXER_ENABLED=false
DOCKER_ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
```

### Key Variables

- `DATABASE_URL`
  PostgreSQL connection string used by Prisma and the API runtime.

- `ETHEREUM_RPC_URL`
  Sepolia RPC endpoint used by the indexer when indexing is enabled.

- `INDEXER_ENABLED`
  Enables or disables blockchain indexing in native runtime.

- `INDEXER_BATCH_SIZE`
  Number of blocks processed per fetch batch.

- `INDEXER_CONFIRMATIONS`
  Number of blocks to wait before considering a block safe to index.

- `INDEXER_POLL_INTERVAL_MS`
  Polling interval once the indexer reaches live sync.

- `CONTRACT_BOOTSTRAP_CONFIG`
  Optional JSON input for bootstrapping contract configuration via `npm run seed:contracts`.

- `DOCKER_INDEXER_ENABLED`, `DOCKER_ETHEREUM_RPC_URL`
  Compose-specific overrides for containerized development.

## Running Manual SQL Scripts

Manual SQL scripts are the canonical database setup for this project.

Files:

```text
database/
  001_schema.sql
  002_indexes.sql
  003_seed.sql
```

### Native PostgreSQL Execution

```bash
psql "$DATABASE_URL" -f database/001_schema.sql
psql "$DATABASE_URL" -f database/002_indexes.sql
psql "$DATABASE_URL" -f database/003_seed.sql
```

### Docker PostgreSQL Execution

```bash
docker compose exec postgres psql -U postgres -d blockchain_indexer -f /sql/001_schema.sql
docker compose exec postgres psql -U postgres -d blockchain_indexer -f /sql/002_indexes.sql
docker compose exec postgres psql -U postgres -d blockchain_indexer -f /sql/003_seed.sql
```

Prisma is intentionally not the schema source of truth here; it is used as an ORM client against the existing SQL-defined schema.

## Seeding Sample Contract

The repository includes a sample ERC20 ABI at:

```text
src/contracts/abi/SampleErc20.json
```

Contract configuration can be seeded in two ways:

- canonical approach: `database/003_seed.sql`
- convenience bootstrap: `npm run seed:contracts`

Bootstrap command:

```bash
npm run seed:contracts
```

When using Docker:

```bash
docker compose exec app npm run seed:contracts
```

The bootstrap script reads `CONTRACT_BOOTSTRAP_CONFIG` from `.env`, resolves the ABI from the project root, and upserts the configuration into PostgreSQL.

## Running the Indexer

The indexer is a long-running service mode inside the same backend process.

Operational behavior:

- historical sync starts from `contracts.start_block`
- sync progress is stored in `sync_states`
- live sync continues polling after catch-up
- retries do not duplicate committed events

Native runtime:

```bash
npm run dev
```

With indexing enabled:

```env
INDEXER_ENABLED=true
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
```

Docker runtime:

```env
DOCKER_INDEXER_ENABLED=true
DOCKER_ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
```

Practical note:

Historical sync duration depends heavily on `startBlock`, batch size, and RPC throughput. For realistic local development, contracts should use their real deployment block rather than `0`.

## Running the API

Development API:

```bash
npm run dev
```

Build and run:

```bash
npm run build
npm run start
```

Default local base URL:

```text
http://127.0.0.1:3000
```

The API serves indexed data from PostgreSQL. It does not query the blockchain on request/response paths.

## Testing

The project uses Vitest consistently across unit and integration-style tests.

Run the test suite:

```bash
npm test
```

Additional verification:

```bash
npm run lint
npm run build
```

Coverage emphasis is placed on critical logic rather than superficial assertions:

- configuration validation
- event normalization
- participant extraction
- pagination/filter helpers
- repository idempotency
- duplicate event protection
- sync-state transitions
- mocked provider-driven indexer behavior with realistic ethers logs

## Known Limitations

- Full deep-reorg recovery is not implemented yet.
- Historical sync can hit RPC rate limits when `startBlock` is too early or provider quotas are low.
- The current indexing model is contract-event-log based; it does not persist full blocks or full transaction history.
- Multi-contract throughput is intentionally simple and not yet tuned for high-volume concurrency control.
- Manual SQL remains the canonical setup, so database evolution requires disciplined script management.

## Future Improvements

- exponential backoff and adaptive retry handling for RPC rate limits
- deeper reorg reconciliation and rollback/replay strategy
- observability extensions such as metrics and tracing
- configurable concurrency and throughput controls
- richer contract/event registry management
- OpenAPI generation and stricter response schemas
- cursor-based pagination for very large datasets
- container health/readiness orchestration for fully automated local bootstrap

## Why This Project Is Relevant for Backend / Web3 Roles

This repository reflects the type of engineering work expected in backend and Web3 infrastructure teams:

- translating external event streams into durable relational data
- designing for idempotency and restart safety
- separating ingestion concerns from read-side API concerns
- building queryable interfaces over indexed blockchain activity
- making runtime configuration explicit and operationally manageable
- treating local development, reproducibility, and testing as part of the system design

For backend roles, it demonstrates data modeling, consistency boundaries, API design, and operational thinking.

For Web3 roles, it demonstrates contract log ingestion, ABI-driven decoding, wallet participant extraction, sync checkpointing, and the practical constraints of RPC-based indexing.
