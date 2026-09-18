import type { Clock, IdGenerator } from '@ai-team/core-domain';
import type { UIActionEnvelope, ActionResultPayload } from '@ai-team/ui-contract';

export interface ApplicationContext {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export interface ActionDispatcherPort {
  dispatch(action: UIActionEnvelope): Promise<ActionResultPayload>;
}
