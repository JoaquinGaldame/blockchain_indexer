import type { Prisma, PrismaClient } from "@prisma/client";
import type { ExtractedEventParticipant } from "./indexedEvent.types.js";

type PrismaTransaction = Prisma.TransactionClient | PrismaClient;

export interface IndexedEventParticipantInput {
  indexedEventId: string;
  participants: ExtractedEventParticipant[];
}

export class EventParticipantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveMany(
    entries: IndexedEventParticipantInput[],
    client: PrismaTransaction = this.prisma
  ): Promise<void> {
    const flattened = entries.flatMap((entry) =>
      entry.participants.map((participant) => ({
        indexedEventId: entry.indexedEventId,
        ...participant
      }))
    );

    if (flattened.length === 0) {
      return;
    }

    const uniqueWallets = dedupeWallets(flattened);

    await client.walletAddress.createMany({
      data: uniqueWallets.map((wallet) => ({
        network: wallet.network,
        address: wallet.address,
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      })),
      skipDuplicates: true
    });

    const wallets = await client.walletAddress.findMany({
      where: {
        OR: uniqueWallets.map((wallet) => ({
          network: wallet.network,
          address: wallet.address
        }))
      },
      select: {
        id: true,
        network: true,
        address: true
      }
    });

    const walletIdByKey = new Map(
      wallets.map((wallet) => [[wallet.network, wallet.address].join("|"), wallet.id])
    );

    await client.walletAddress.updateMany({
      where: {
        OR: uniqueWallets.map((wallet) => ({
          network: wallet.network,
          address: wallet.address
        }))
      },
      data: {
        lastSeenAt: new Date()
      }
    });

    await client.eventParticipant.createMany({
      data: flattened
        .map((participant) => {
          const walletAddressId = walletIdByKey.get(
            [participant.network, participant.address].join("|")
          );

          if (!walletAddressId) {
            throw new Error(
              `Wallet address ${participant.address} (${participant.network}) was not persisted`
            );
          }

          return {
            indexedEventId: participant.indexedEventId,
            walletAddressId,
            role: participant.role,
            argName: participant.argName
          };
        })
        .filter(dedupeParticipants()),
      skipDuplicates: true
    });
  }
}

function dedupeWallets(
  wallets: Array<{ network: string; address: string }>
): Array<{ network: string; address: string }> {
  return [...new Map(wallets.map((wallet) => [[wallet.network, wallet.address].join("|"), wallet])).values()];
}

function dedupeParticipants() {
  const seen = new Set<string>();

  return (participant: {
    indexedEventId: string;
    walletAddressId: string;
    role: string;
    argName: string | null;
  }) => {
    const key = [
      participant.indexedEventId,
      participant.walletAddressId,
      participant.role,
      participant.argName ?? ""
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  };
}
