import type { Finding, ReachabilityResult, Remediation, Risk } from '../types/index.js';

export function planRemediation(
  findings: ReadonlyArray<Finding>,
  reachability: ReadonlyArray<ReachabilityResult>,
): ReadonlyArray<Remediation> {
  const reachabilityByFinding = new Map(reachability.map((result) => [result.findingId, result]));
  return findings
    .flatMap((finding): Remediation[] => {
      const dependency = finding.dependency;
      const recommendedVersion = finding.vulnerability?.fixedVersions[0];
      if (!dependency || !recommendedVersion) return [];
      const reachable = reachabilityByFinding.get(finding.id);
      const affectedFiles = new Set<string>(['package.json', 'package-lock.json']);
      for (const evidence of reachable?.evidence ?? []) affectedFiles.add(evidence.file);
      return [
        {
          package: dependency.name,
          currentVersion: dependency.version,
          recommendedVersion,
          breakingChangeRisk: breakingRisk(dependency.version, recommendedVersion),
          affectedFiles: [...affectedFiles].sort(),
          verificationCommands: ['npm run typecheck', 'npm test', 'npm run build'],
          rationale: [
            `Upgrade to a version that fixes ${finding.vulnerability?.id ?? finding.id}.`,
            reachable
              ? `Reachability is ${reachable.classification} with ${reachable.evidence.length} source reference(s).`
              : 'Reachability could not be assessed.',
          ].join(' '),
        },
      ];
    })
    .sort((a, b) => {
      const riskDelta = riskRank(b.breakingChangeRisk) - riskRank(a.breakingChangeRisk);
      return riskDelta !== 0 ? riskDelta : a.package.localeCompare(b.package);
    });
}

function breakingRisk(currentVersion: string, recommendedVersion: string): Risk {
  const current = parseVersion(currentVersion);
  const recommended = parseVersion(recommendedVersion);
  if (!current || !recommended) return 'medium';
  if (recommended.major > current.major) return 'high';
  if (recommended.minor > current.minor) return 'medium';
  return 'low';
}

function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/u.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function riskRank(risk: Risk): number {
  return risk === 'high' ? 3 : risk === 'medium' ? 2 : 1;
}
