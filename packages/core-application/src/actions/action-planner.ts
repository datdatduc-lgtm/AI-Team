import type { DomainEventType, ProjectState } from '@ai-team/core-domain';
import type { UIActionEnvelope } from '@ai-team/ui-contract';

export type ActionPlan =
  | { readonly kind: 'ACCEPT'; readonly eventType: DomainEventType; readonly payload: unknown; readonly sessionId?: string; readonly goalId?: string }
  | { readonly kind: 'REJECT'; readonly message: string; readonly rejectionReason?: string; readonly errors?: readonly string[] }
  | { readonly kind: 'REQUIRES_APPROVAL'; readonly message: string }
  | { readonly kind: 'UNSUPPORTED'; readonly message: string };

export interface ActionPlannerPort {
  plan(action: UIActionEnvelope, state: ProjectState): ActionPlan;
}