import type { UIActionEnvelope } from '@ai-team/ui-contract';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function actionFingerprint(action: UIActionEnvelope): string {
  return JSON.stringify(canonicalize({
    schemaVersion: action.schemaVersion, actionId: action.actionId, operationId: action.operationId,
    intent: action.intent, projectId: action.projectId, sessionId: action.sessionId ?? null,
    goalId: action.goalId ?? null, expectedStateRevision: action.expectedStateRevision,
    target: action.target ?? null, parameters: action.parameters,
  }));
}