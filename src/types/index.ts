/**
 * Shared types. Re-exported from a single barrel so the rest of the
 * code can import from `@/types` without caring about the file
 * layout.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type Reachability = 'confirmed' | 'possible' | 'unknown';
export type Risk = 'low' | 'medium' | 'high';
export type RiskBand = 'critical' | 'high' | 'medium' | 'low';

export interface RiskAssessment {
  readonly score: number;
  readonly band: RiskBand;
  readonly factors: {
    readonly severity: number;
    readonly dependencyScope: number;
    readonly dependencyDepth: number;
    readonly fixAvailability: number;
  };
  readonly explanation: string;
}

export interface Dependency {
  readonly name: string;
  readonly version: string;
  readonly ecosystem: 'npm';
  readonly integrity?: string;
  readonly licenses?: ReadonlyArray<string>;
  readonly purl?: string;
  readonly isDev: boolean;
  readonly isTransitive: boolean;
}

export interface OsvVulnerabilitySummary {
  readonly id: string;
  readonly aliases: ReadonlyArray<string>;
  readonly summary: string;
  readonly severity: Severity;
  readonly cvssScore?: number;
  readonly fixedVersions: ReadonlyArray<string>;
}

export interface Finding {
  readonly id: string;
  readonly kind: 'vulnerability' | 'secret' | 'malformed' | 'missing';
  readonly dependency?: { readonly name: string; readonly version: string };
  readonly vulnerability?: OsvVulnerabilitySummary;
  readonly secret?: SecretHit;
  readonly message: string;
  readonly severity: Severity;
  readonly risk?: RiskAssessment;
}

export interface SecretHit {
  readonly fingerprint: string;
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly ruleId: string;
  readonly category: string;
  readonly confidence: number;
}

export interface ReachabilityResult {
  readonly findingId: string;
  readonly package: string;
  readonly classification: Reachability;
  readonly evidence: ReadonlyArray<{
    readonly file: string;
    readonly line: number;
    readonly snippet: string;
  }>;
}

export interface Remediation {
  readonly package: string;
  readonly currentVersion: string;
  readonly recommendedVersion: string;
  readonly breakingChangeRisk: Risk;
  readonly affectedFiles: ReadonlyArray<string>;
  readonly verificationCommands: ReadonlyArray<string>;
  readonly rationale: string;
}

export interface VerificationResult {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly truncatedStdout: boolean;
  readonly truncatedStderr: boolean;
}

export interface EvidenceReport {
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly inputs: {
    readonly repoRoot: string;
    readonly config: Readonly<Record<string, unknown>>;
  };
  readonly findings: ReadonlyArray<Finding>;
  readonly riskSummary: {
    readonly highestScore: number;
    readonly averageScore: number;
    readonly counts: Readonly<Record<RiskBand, number>>;
  };
  readonly reachability: ReadonlyArray<ReachabilityResult>;
  readonly remediation: ReadonlyArray<Remediation>;
  readonly verification: ReadonlyArray<VerificationResult>;
  readonly verificationPlan: ReadonlyArray<string>;
  readonly limitations: ReadonlyArray<string>;
  readonly redactions: ReadonlyArray<{ readonly kind: string; readonly count: number }>;
}
