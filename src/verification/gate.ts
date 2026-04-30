import { access } from "node:fs/promises";

export const evaluateEvidenceGate = async (artifacts: string[]): Promise<{
  passed: boolean;
  failures: string[];
}> => {
  const failures: string[] = [];
  for (const artifact of artifacts) {
    try {
      await access(artifact);
    } catch {
      failures.push(`Missing required artifact: ${artifact}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
};
