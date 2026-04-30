import { access } from "node:fs/promises";

export const evaluateEvidenceGate = async (artifacts: string[]): Promise<{
  passed: boolean;
  failures: string[];
  checks: Array<{ artifactUri: string; exists: boolean; required: boolean }>;
}> => {
  const failures: string[] = [];
  const checks: Array<{ artifactUri: string; exists: boolean; required: boolean }> = [];
  for (const artifact of artifacts) {
    try {
      await access(artifact);
      checks.push({ artifactUri: artifact, exists: true, required: true });
    } catch {
      failures.push(`Missing required artifact: ${artifact}`);
      checks.push({ artifactUri: artifact, exists: false, required: true });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    checks,
  };
};
