import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { ReviewPacketEnvelopeSchema, type ReviewPacketEnvelope } from "../contracts/review-packet.js";

export interface ArtifactStorageAdapter {
  listReviewPackets(): Promise<ReviewPacketEnvelope[]>;
  getReviewPacket(traceId: string): Promise<ReviewPacketEnvelope | undefined>;
}

export class LocalArtifactStorageAdapter implements ArtifactStorageAdapter {
  private readonly root = path.resolve(process.cwd(), env.TRACEBACK_ARTIFACTS_ROOT);

  async listReviewPackets(): Promise<ReviewPacketEnvelope[]> {
    let traceDirs: string[];
    try {
      traceDirs = await readdir(this.root);
    } catch {
      return [];
    }

    const packets = await Promise.all(
      traceDirs.map(async (traceDir) => this.getReviewPacket(traceDir)),
    );
    return packets
      .filter((packet): packet is ReviewPacketEnvelope => Boolean(packet))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async getReviewPacket(traceId: string): Promise<ReviewPacketEnvelope | undefined> {
    const packetPath = path.join(this.root, traceId, "review-packet.json");
    try {
      const raw = await readFile(packetPath, "utf8");
      return ReviewPacketEnvelopeSchema.parse(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }
}

export const createArtifactStorageAdapter = (): ArtifactStorageAdapter => {
  return new LocalArtifactStorageAdapter();
};
