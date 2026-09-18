/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/route-state.schema.json */

/**
 * Host and application route focus and view state
 */
export interface RouteStatePayload {
  schemaVersion: string;
  routeId: string;
  routeName: string;
  isFocused: boolean;
  activeView: string;
  metadata?: {
    [k: string]: unknown | undefined;
  };
  updatedAt: string;
}
