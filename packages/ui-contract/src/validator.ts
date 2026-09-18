import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import commonSchema from '../schemas/common.schema.json' with { type: 'json' };
import coreEventSchema from '../schemas/core-event-envelope.schema.json' with { type: 'json' };
import uiActionSchema from '../schemas/ui-action-envelope.schema.json' with { type: 'json' };
import actionResultSchema from '../schemas/action-result.schema.json' with { type: 'json' };
import sessionStateSchema from '../schemas/session-state.schema.json' with { type: 'json' };
import goalStateSchema from '../schemas/goal-state.schema.json' with { type: 'json' };
import agentStateSchema from '../schemas/agent-state.schema.json' with { type: 'json' };
import workerStateSchema from '../schemas/worker-state.schema.json' with { type: 'json' };
import capabilityReqSchema from '../schemas/capability-requirement.schema.json' with { type: 'json' };
import hostCapRegistrySchema from '../schemas/host-capability-registry.schema.json' with { type: 'json' };
import routeStateSchema from '../schemas/route-state.schema.json' with { type: 'json' };
import systemRecoverySchema from '../schemas/system-recovery.schema.json' with { type: 'json' };
import recommendedActionSchema from '../schemas/recommended-action.schema.json' with { type: 'json' };

import type {
  CoreEventEnvelope,
  UIActionEnvelope,
  ActionResultPayload,
  SessionStatePayload,
  GoalStatePayload,
  AgentStatePayload,
  WorkerStatePayload,
  CapabilityRequirementPayload,
  HostCapabilityRegistryPayload,
  RouteStatePayload,
  SystemRecoveryPayload,
  RecommendedActionPayload,
} from './generated/index.js';

export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors?: readonly string[];
}

export class ContractValidator {
  private readonly ajv: Ajv2020;
  private readonly validators: Map<string, ValidateFunction> = new Map();

  constructor() {
    this.ajv = new Ajv2020({ allErrors: true, strict: false });
    const addFormatsFn = (addFormats as any).default ?? addFormats;
    addFormatsFn(this.ajv);

    this.ajv.addSchema(commonSchema);
    this.validators.set('CoreEventEnvelope', this.ajv.compile(coreEventSchema));
    this.validators.set('UIActionEnvelope', this.ajv.compile(uiActionSchema));
    this.validators.set('ActionResultPayload', this.ajv.compile(actionResultSchema));
    this.validators.set('SessionStatePayload', this.ajv.compile(sessionStateSchema));
    this.validators.set('GoalStatePayload', this.ajv.compile(goalStateSchema));
    this.validators.set('AgentStatePayload', this.ajv.compile(agentStateSchema));
    this.validators.set('WorkerStatePayload', this.ajv.compile(workerStateSchema));
    this.validators.set('CapabilityRequirementPayload', this.ajv.compile(capabilityReqSchema));
    this.validators.set('HostCapabilityRegistryPayload', this.ajv.compile(hostCapRegistrySchema));
    this.validators.set('RouteStatePayload', this.ajv.compile(routeStateSchema));
    this.validators.set('SystemRecoveryPayload', this.ajv.compile(systemRecoverySchema));
    this.validators.set('RecommendedActionPayload', this.ajv.compile(recommendedActionSchema));
  }

  private validate<T>(key: string, payload: unknown): ValidationResult<T> {
    const validator = this.validators.get(key);
    if (!validator) {
      return { success: false, errors: [`No compiled validator for ${key}`] };
    }
    const valid = validator(payload);
    if (valid) {
      return { success: true, data: payload as T };
    }
    const errors = (validator.errors || []).map((err: any) => `${err.instancePath || '/'}: ${err.message}`);
    return { success: false, errors };
  }

  public validateCoreEventEnvelope(payload: unknown) { return this.validate<CoreEventEnvelope>('CoreEventEnvelope', payload); }
  public validateUIActionEnvelope(payload: unknown) { return this.validate<UIActionEnvelope>('UIActionEnvelope', payload); }
  public validateActionResultPayload(payload: unknown) { return this.validate<ActionResultPayload>('ActionResultPayload', payload); }
  public validateSessionStatePayload(payload: unknown) { return this.validate<SessionStatePayload>('SessionStatePayload', payload); }
  public validateGoalStatePayload(payload: unknown) { return this.validate<GoalStatePayload>('GoalStatePayload', payload); }
  public validateAgentStatePayload(payload: unknown) { return this.validate<AgentStatePayload>('AgentStatePayload', payload); }
  public validateWorkerStatePayload(payload: unknown) { return this.validate<WorkerStatePayload>('WorkerStatePayload', payload); }
  public validateCapabilityRequirementPayload(payload: unknown) { return this.validate<CapabilityRequirementPayload>('CapabilityRequirementPayload', payload); }
  public validateHostCapabilityRegistryPayload(payload: unknown) { return this.validate<HostCapabilityRegistryPayload>('HostCapabilityRegistryPayload', payload); }
  public validateRouteStatePayload(payload: unknown) { return this.validate<RouteStatePayload>('RouteStatePayload', payload); }
  public validateSystemRecoveryPayload(payload: unknown) { return this.validate<SystemRecoveryPayload>('SystemRecoveryPayload', payload); }
  public validateRecommendedActionPayload(payload: unknown) { return this.validate<RecommendedActionPayload>('RecommendedActionPayload', payload); }
}

export const defaultValidator = new ContractValidator();
