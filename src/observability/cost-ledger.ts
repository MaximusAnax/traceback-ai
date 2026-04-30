import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CursorRunEnvelope } from "../contracts/run-envelope.js";

export const persistRunEnvelope = async (traceId: string, envelope: CursorRunEnvelope): Promise<string> => {
  const folder = path.resolve(process.cwd(), "artifacts", traceId, "runs");
  await mkdir(folder, { recursive: true });
  const filePath = path.join(folder, `${envelope.role}.json`);
  await writeFile(filePath, JSON.stringify(envelope, null, 2), "utf8");
  return filePath;
};
