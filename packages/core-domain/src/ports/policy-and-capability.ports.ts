export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly requiredApprovals?: readonly string[];
}

export interface PolicyEvaluationContext {
  readonly intent: string;
  readonly target?: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly stateRevision: number;
}

export interface PolicyEvaluatorPort {
  evaluate(context: PolicyEvaluationContext): Promise<PolicyDecision>;
}

export interface HostCapabilityInfo {
  readonly capabilityId: string;
  readonly supported: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CapabilityRegistryPort {
  has(capabilityId: string): Promise<boolean>;
  get(capabilityId: string): Promise<HostCapabilityInfo | null>;
  listSupported(): Promise<readonly HostCapabilityInfo[]>;
}
