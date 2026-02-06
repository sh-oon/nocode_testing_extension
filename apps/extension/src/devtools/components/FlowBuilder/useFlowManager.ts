import { useCallback, useRef, useState } from 'react';
import type { FlowEdge, FlowNode } from '@like-cake/ast-types';
import type { Edge, Node } from '@xyflow/react';
import { getApiClient, type BackendUserFlow } from '../../../shared/api';

// ============================================================================
// Types
// ============================================================================

export interface BrokenRef {
  /** The flow node ID that contains the broken reference */
  nodeId: string;
  /** The scenario ID that is missing or deleted */
  scenarioId: string;
  /** Display name of the scenario at the time it was added */
  scenarioName: string;
}

export interface FlowManagerState {
  flowId: string | null;
  flowName: string;
  flowDescription: string;
  isModified: boolean;
  isSaving: boolean;
  isLoading: boolean;
  lastSavedAt: number | null;
  brokenRefs: BrokenRef[];
}

export interface UseFlowManagerOptions {
  /** Returns the current flow data (FlowNode[], FlowEdge[]) from the canvas */
  getFlowData: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  /** Replaces all React Flow nodes on the canvas */
  setNodes: (nodes: Node[]) => void;
  /** Replaces all React Flow edges on the canvas */
  setEdges: (edges: Edge[]) => void;
  /** Clears the entire canvas (nodes + edges) */
  clearFlow: () => void;
}

interface CreateNewFlowResult {
  needsConfirmation: boolean;
}

// ============================================================================
// Converters (FlowNode <-> React Flow Node)
// ============================================================================

/**
 * Convert a domain FlowNode (from the backend / AST types) to a React Flow Node
 * so it can be rendered on the canvas.
 */
function flowNodeToReactFlowNode(flowNode: FlowNode): Node {
  return {
    id: flowNode.id,
    type: flowNode.type,
    position: flowNode.position,
    data: flowNode.data as unknown as Record<string, unknown>,
  };
}

/**
 * Convert a domain FlowEdge to a React Flow Edge, applying correct styling
 * for condition branches (green for true, red for false).
 */
function flowEdgeToReactFlowEdge(flowEdge: FlowEdge): Edge {
  let strokeColor = '#6b7280';
  if (flowEdge.sourceHandle === 'true') {
    strokeColor = '#22c55e';
  } else if (flowEdge.sourceHandle === 'false') {
    strokeColor = '#ef4444';
  }

  return {
    id: flowEdge.id,
    source: flowEdge.source,
    target: flowEdge.target,
    sourceHandle: flowEdge.sourceHandle,
    targetHandle: flowEdge.targetHandle,
    label: flowEdge.label,
    style: { strokeWidth: 2, stroke: strokeColor },
    type: flowEdge.type || 'smoothstep',
    animated: flowEdge.animated,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useFlowManager(options: UseFlowManagerOptions) {
  const { getFlowData, setNodes, setEdges, clearFlow } = options;

  // ---- State ----
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowName, setFlowNameInternal] = useState('');
  const [flowDescription, setFlowDescriptionInternal] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [brokenRefs, setBrokenRefs] = useState<BrokenRef[]>([]);

  // Guard against concurrent save/load operations
  const operationLockRef = useRef(false);

  // ---- Derived state object ----
  const state: FlowManagerState = {
    flowId,
    flowName,
    flowDescription,
    isModified,
    isSaving,
    isLoading,
    lastSavedAt,
    brokenRefs,
  };

  // ---- Helpers ----

  /**
   * Populate the React Flow canvas with domain-level flow data from the
   * backend. Converts FlowNode[] / FlowEdge[] into React Flow's Node[] /
   * Edge[] and calls the provided setters.
   */
  const populateCanvas = useCallback(
    (flow: BackendUserFlow) => {
      const rfNodes = flow.nodes.map(flowNodeToReactFlowNode);
      const rfEdges = flow.edges.map(flowEdgeToReactFlowEdge);
      setNodes(rfNodes);
      setEdges(rfEdges);
    },
    [setNodes, setEdges],
  );

  // ---- Actions ----

  /**
   * Validate scenario references for the given nodes.
   * Calls `POST /api/scenarios/check-refs` with the scenario IDs found in
   * the node list. If the endpoint does not exist yet (404) or the request
   * fails, the validation is skipped gracefully and an empty array is
   * returned so the user is not blocked.
   */
  const validateScenarioRefs = useCallback(
    async (nodes: FlowNode[]): Promise<BrokenRef[]> => {
      // Collect all scenario nodes and their referenced IDs
      const scenarioNodes = nodes.filter(
        (n): n is Extract<FlowNode, { type: 'scenario' }> => n.type === 'scenario',
      );

      if (scenarioNodes.length === 0) {
        return [];
      }

      const ids = scenarioNodes.map((n) => n.data.scenarioId);

      try {
        const client = await getApiClient();
        const response = await client.checkScenarioRefs(ids);

        if (!response.success || !response.data) {
          console.warn('[useFlowManager] check-refs API failed — skipping validation');
          return [];
        }

        const broken: BrokenRef[] = [];
        for (const node of scenarioNodes) {
          const exists = response.data.results[node.data.scenarioId];
          if (exists === false) {
            broken.push({
              nodeId: node.id,
              scenarioId: node.data.scenarioId,
              scenarioName: node.data.scenarioName,
            });
          }
        }

        return broken;
      } catch (error) {
        console.warn('[useFlowManager] Failed to validate scenario refs:', error);
        return [];
      }
    },
    [],
  );

  /**
   * Load a flow by ID from the backend, populate the canvas, validate
   * scenario references, and update all internal state.
   */
  const loadFlow = useCallback(
    async (targetFlowId: string): Promise<boolean> => {
      if (operationLockRef.current) return false;
      operationLockRef.current = true;
      setIsLoading(true);

      try {
        const client = await getApiClient();
        const response = await client.getUserFlow(targetFlowId);

        if (!response.success || !response.data) {
          console.error('[useFlowManager] Failed to load flow:', response.error);
          return false;
        }

        const flow = response.data;

        // Populate canvas with converted nodes/edges
        populateCanvas(flow);

        // Update metadata state
        setFlowId(flow.id);
        setFlowNameInternal(flow.name);
        setFlowDescriptionInternal(flow.description || '');
        setIsModified(false);
        setLastSavedAt(flow.updatedAt);

        // Validate scenario references in background
        const broken = await validateScenarioRefs(flow.nodes);
        setBrokenRefs(broken);

        return true;
      } catch (error) {
        console.error('[useFlowManager] Error loading flow:', error);
        return false;
      } finally {
        setIsLoading(false);
        operationLockRef.current = false;
      }
    },
    [populateCanvas, validateScenarioRefs],
  );

  /**
   * Save the current flow. Creates a new flow if `flowId` is null, or
   * updates the existing flow otherwise.
   *
   * Returns the saved flow ID on success, or `null` on failure.
   */
  const saveFlow = useCallback(async (): Promise<string | null> => {
    if (operationLockRef.current) return null;

    const trimmedName = flowName.trim();
    if (!trimmedName) {
      console.warn('[useFlowManager] Cannot save flow without a name');
      return null;
    }

    operationLockRef.current = true;
    setIsSaving(true);

    try {
      const client = await getApiClient();
      const flowData = getFlowData();

      if (flowId) {
        // ---- Update existing flow ----
        const response = await client.updateUserFlow(flowId, {
          name: trimmedName,
          description: flowDescription || undefined,
          nodes: flowData.nodes,
          edges: flowData.edges,
        });

        if (response.success && response.data) {
          setIsModified(false);
          setLastSavedAt(Date.now());
          return flowId;
        }

        console.error('[useFlowManager] Failed to update flow:', response.error);
        return null;
      }

      // ---- Create new flow ----
      const response = await client.createUserFlow({
        name: trimmedName,
        description: flowDescription || undefined,
        nodes: flowData.nodes,
        edges: flowData.edges,
      });

      if (response.success && response.data) {
        setFlowId(response.data.id);
        setIsModified(false);
        setLastSavedAt(Date.now());
        return response.data.id;
      }

      console.error('[useFlowManager] Failed to create flow:', response.error);
      return null;
    } catch (error) {
      console.error('[useFlowManager] Error saving flow:', error);
      return null;
    } finally {
      setIsSaving(false);
      operationLockRef.current = false;
    }
  }, [flowId, flowName, flowDescription, getFlowData]);

  /**
   * Start a new blank flow. If the current flow has unsaved changes,
   * returns `{ needsConfirmation: true }` so the caller can show a
   * confirmation dialog before proceeding. Call `createNewFlow` again
   * after the user confirms (the caller should call `clearFlow` first
   * or ignore the result).
   *
   * When there are no unsaved changes, the canvas is cleared immediately.
   */
  const createNewFlow = useCallback((): CreateNewFlowResult => {
    if (isModified) {
      return { needsConfirmation: true };
    }

    // No unsaved changes — clear everything
    clearFlow();
    setFlowId(null);
    setFlowNameInternal('');
    setFlowDescriptionInternal('');
    setIsModified(false);
    setLastSavedAt(null);
    setBrokenRefs([]);

    return { needsConfirmation: false };
  }, [isModified, clearFlow]);

  /**
   * Force-create a new flow, discarding any unsaved changes. This is the
   * "confirmed" version of `createNewFlow` and always clears the canvas.
   */
  const forceCreateNewFlow = useCallback(() => {
    clearFlow();
    setFlowId(null);
    setFlowNameInternal('');
    setFlowDescriptionInternal('');
    setIsModified(false);
    setLastSavedAt(null);
    setBrokenRefs([]);
  }, [clearFlow]);

  /**
   * Delete a flow by ID via the backend API. If the deleted flow is the
   * currently loaded flow, the canvas is cleared.
   *
   * Returns `true` on success, `false` on failure.
   */
  const deleteFlow = useCallback(
    async (targetFlowId: string): Promise<boolean> => {
      try {
        const client = await getApiClient();
        const response = await client.deleteUserFlow(targetFlowId);

        if (!response.success) {
          console.error('[useFlowManager] Failed to delete flow:', response.error);
          return false;
        }

        // If the deleted flow is the currently loaded one, clear the canvas
        if (targetFlowId === flowId) {
          clearFlow();
          setFlowId(null);
          setFlowNameInternal('');
          setFlowDescriptionInternal('');
          setIsModified(false);
          setLastSavedAt(null);
          setBrokenRefs([]);
        }

        return true;
      } catch (error) {
        console.error('[useFlowManager] Error deleting flow:', error);
        return false;
      }
    },
    [flowId, clearFlow],
  );

  /**
   * Duplicate a flow by ID using the dedicated backend endpoint.
   * Returns the new flow ID or `null` on failure.
   */
  const duplicateFlow = useCallback(
    async (targetFlowId: string): Promise<string | null> => {
      try {
        const client = await getApiClient();
        const response = await client.duplicateUserFlow(targetFlowId);

        if (response.success && response.data) {
          return response.data.id;
        }

        console.error('[useFlowManager] Failed to duplicate flow:', response.error);
        return null;
      } catch (error) {
        console.error('[useFlowManager] Error duplicating flow:', error);
        return null;
      }
    },
    [],
  );

  /**
   * Update the flow name and mark the flow as modified.
   */
  const setFlowName = useCallback((name: string) => {
    setFlowNameInternal(name);
    setIsModified(true);
  }, []);

  /**
   * Update the flow description and mark the flow as modified.
   */
  const setFlowDescription = useCallback((description: string) => {
    setFlowDescriptionInternal(description);
    setIsModified(true);
  }, []);

  /**
   * Manually mark the flow as modified. Useful when external changes
   * (e.g. node drag, edge connect) occur outside this hook.
   */
  const markModified = useCallback(() => {
    setIsModified(true);
  }, []);

  /**
   * Re-validate scenario references for the current canvas nodes.
   * Updates the `brokenRefs` state.
   */
  const refreshBrokenRefs = useCallback(async () => {
    const flowData = getFlowData();
    const broken = await validateScenarioRefs(flowData.nodes);
    setBrokenRefs(broken);
  }, [getFlowData, validateScenarioRefs]);

  return {
    // State (read-only snapshot)
    state,

    // Individual state fields for convenience
    flowId,
    flowName,
    flowDescription,
    isModified,
    isSaving,
    isLoading,
    lastSavedAt,
    brokenRefs,

    // Actions
    loadFlow,
    saveFlow,
    createNewFlow,
    forceCreateNewFlow,
    deleteFlow,
    duplicateFlow,
    validateScenarioRefs,
    refreshBrokenRefs,

    // Setters
    setFlowName,
    setFlowDescription,
    markModified,
  };
}
