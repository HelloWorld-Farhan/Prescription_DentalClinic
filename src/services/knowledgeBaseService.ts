import { getUserScopedKey, pushKnowledgeSyncState } from './cloudSyncService';

export interface KnowledgeBaseProfile {
  id: string; // 'kb-1' | 'kb-2' | 'kb-3'
  name: string;
  description: string;
  selection: string[];
  docs: string[];
  checks: string[];
  rules: string[];
  conditions: string[];
  updatedAt: string;
}

export interface MultiKnowledgeBaseState {
  activeKbId: string;
  knowledgeBases: KnowledgeBaseProfile[];
}

export const DEFAULT_KNOWLEDGE_BASES: KnowledgeBaseProfile[] = [
  {
    id: 'kb-1',
    name: 'Primary Clinical & Prescription Protocol',
    description: 'Comprehensive evaluation cross-screening patient history documents and prior prescription checks.',
    selection: [],
    docs: [],
    checks: [],
    rules: [],
    conditions: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-2',
    name: 'Renal & Hepatic Impairment Protocol',
    description: 'Targeted safety screening focused on organ clearance, dosage adjustments, and nephro/hepatotoxic risks.',
    selection: [],
    docs: [],
    checks: [],
    rules: [],
    conditions: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-3',
    name: 'Custom Dental Operatory Protocol',
    description: 'Specialized dental procedures, local anesthetic interactions, and antibiotic stewardship protocols.',
    selection: [],
    docs: [],
    checks: [],
    rules: [],
    conditions: [],
    updatedAt: new Date().toISOString(),
  },
];

const STORAGE_KEY_MULTI_KB = 'smileclinic_multi_knowledge_bases';
const STORAGE_KEY_ACTIVE_KB = 'smileclinic_active_kb_id';

/**
 * Retrieve the current Multi-KB state, migrating legacy single-KB state if needed
 */
export function getMultiKnowledgeBaseState(): MultiKnowledgeBaseState {
  if (typeof window === 'undefined') {
    return {
      activeKbId: 'kb-1',
      knowledgeBases: DEFAULT_KNOWLEDGE_BASES,
    };
  }

  try {
    const kMulti = getUserScopedKey(STORAGE_KEY_MULTI_KB);
    const kActive = getUserScopedKey(STORAGE_KEY_ACTIVE_KB);

    const rawMulti = kMulti ? localStorage.getItem(kMulti) : null;
    const rawActive = kActive ? localStorage.getItem(kActive) : null;

    let activeKbId = rawActive || 'kb-1';
    let knowledgeBases: KnowledgeBaseProfile[] = [];

    if (rawMulti) {
      const parsed = JSON.parse(rawMulti);
      if (Array.isArray(parsed) && parsed.length === 3) {
        knowledgeBases = parsed;
      }
    }

    // Fallback: If no multi-KB state exists, seed with default profiles and migrate legacy selection into kb-1
    if (knowledgeBases.length !== 3) {
      knowledgeBases = JSON.parse(JSON.stringify(DEFAULT_KNOWLEDGE_BASES));

      // Attempt legacy migration into kb-1
      const legacySelKey = getUserScopedKey('smileclinic_synced_knowledge_selection');
      const legacyDocsKey = getUserScopedKey('smileclinic_synced_active_docs');
      const legacyChecksKey = getUserScopedKey('smileclinic_synced_active_checks');
      const legacyCondsKey = getUserScopedKey('smileclinic_synced_active_conditions');

      const rawSel = legacySelKey ? localStorage.getItem(legacySelKey) : null;
      const rawDocs = legacyDocsKey ? localStorage.getItem(legacyDocsKey) : null;
      const rawChecks = legacyChecksKey ? localStorage.getItem(legacyChecksKey) : null;
      const rawConds = legacyCondsKey ? localStorage.getItem(legacyCondsKey) : null;

      if (rawSel || rawDocs || rawChecks || rawConds) {
        try {
          knowledgeBases[0].selection = rawSel ? JSON.parse(rawSel) : [];
          knowledgeBases[0].docs = rawDocs ? JSON.parse(rawDocs) : [];
          knowledgeBases[0].checks = rawChecks ? JSON.parse(rawChecks) : [];
          knowledgeBases[0].conditions = rawConds ? JSON.parse(rawConds) : [];
          knowledgeBases[0].updatedAt = new Date().toISOString();
        } catch {}
      }

      // Persist the initialized 3 KBs
      if (kMulti) localStorage.setItem(kMulti, JSON.stringify(knowledgeBases));
      if (kActive) localStorage.setItem(kActive, activeKbId);
    }

    if (!knowledgeBases.some((kb) => kb.id === activeKbId)) {
      activeKbId = 'kb-1';
    }

    return { activeKbId, knowledgeBases };
  } catch (err) {
    console.warn('[KnowledgeBaseService] Error loading multi-KB state:', err);
    return {
      activeKbId: 'kb-1',
      knowledgeBases: DEFAULT_KNOWLEDGE_BASES,
    };
  }
}

/**
 * Get the currently active Knowledge Base (the single one evaluated in AI Safety Checks)
 */
export function getActiveKnowledgeBase(): KnowledgeBaseProfile {
  const state = getMultiKnowledgeBaseState();
  const active = state.knowledgeBases.find((kb) => kb.id === state.activeKbId);
  return active || state.knowledgeBases[0] || DEFAULT_KNOWLEDGE_BASES[0];
}

/**
 * Persist and broadcast state changes
 */
function persistAndBroadcast(state: MultiKnowledgeBaseState) {
  if (typeof window === 'undefined') return;

  try {
    const kMulti = getUserScopedKey(STORAGE_KEY_MULTI_KB);
    const kActive = getUserScopedKey(STORAGE_KEY_ACTIVE_KB);

    if (kMulti) localStorage.setItem(kMulti, JSON.stringify(state.knowledgeBases));
    if (kActive) localStorage.setItem(kActive, state.activeKbId);

    // Keep legacy single-KB storage keys synchronized with the active KB for backwards compatibility
    const activeKb = state.knowledgeBases.find((kb) => kb.id === state.activeKbId) || state.knowledgeBases[0];
    const kSel = getUserScopedKey('smileclinic_synced_knowledge_selection');
    const kDocs = getUserScopedKey('smileclinic_synced_active_docs');
    const kChecks = getUserScopedKey('smileclinic_synced_active_checks');
    const kRules = getUserScopedKey('smileclinic_synced_active_rules');
    const kConds = getUserScopedKey('smileclinic_synced_active_conditions');
    const kSync = getUserScopedKey('smileclinic_last_rules_sync');

    if (kSel) localStorage.setItem(kSel, JSON.stringify(activeKb.selection));
    if (kDocs) localStorage.setItem(kDocs, JSON.stringify(activeKb.docs));
    if (kChecks) localStorage.setItem(kChecks, JSON.stringify(activeKb.checks));
    if (kRules) localStorage.setItem(kRules, JSON.stringify(activeKb.rules));
    if (kConds) localStorage.setItem(kConds, JSON.stringify(activeKb.conditions));
    if (kSync) localStorage.setItem(kSync, new Date().toISOString());

    // Broadcast reactive event
    window.dispatchEvent(
      new CustomEvent('smileclinic_knowledge_synced', {
        detail: {
          activeKbId: state.activeKbId,
          activeKb,
          allKbs: state.knowledgeBases,
          selection: activeKb.selection,
          docs: activeKb.docs,
          checks: activeKb.checks,
          rules: activeKb.rules,
          conditions: activeKb.conditions,
        },
      })
    );

    // Push state to PostgreSQL cloud backend
    pushKnowledgeSyncState({
      selection: activeKb.selection,
      conditions: activeKb.conditions,
      checks: activeKb.checks,
      rules: activeKb.rules,
      docs: activeKb.docs,
      multiKb: state,
    } as any).catch(() => {});
  } catch (err) {
    console.warn('[KnowledgeBaseService] Failed to persist and broadcast KB state:', err);
  }
}

/**
 * Select the one active Knowledge Base to be used in Prescription AI Safety Checks
 */
export function setActiveKnowledgeBase(kbId: string): MultiKnowledgeBaseState {
  const state = getMultiKnowledgeBaseState();
  if (state.knowledgeBases.some((kb) => kb.id === kbId)) {
    state.activeKbId = kbId;
    persistAndBroadcast(state);
  }
  return state;
}

/**
 * Update a specific Knowledge Base with selected items, docs, checks, and conditions
 */
export function saveKnowledgeBase(
  kbId: string,
  data: {
    selection: string[];
    docs: string[];
    checks: string[];
    rules?: string[];
    conditions: string[];
    name?: string;
    description?: string;
  }
): MultiKnowledgeBaseState {
  const state = getMultiKnowledgeBaseState();
  const kb = state.knowledgeBases.find((k) => k.id === kbId);

  if (kb) {
    kb.selection = data.selection;
    kb.docs = data.docs;
    kb.checks = data.checks;
    kb.rules = data.rules || [];
    kb.conditions = data.conditions;
    if (data.name) kb.name = data.name.trim();
    if (data.description) kb.description = data.description.trim();
    kb.updatedAt = new Date().toISOString();

    persistAndBroadcast(state);
  }

  return state;
}

/**
 * Clear all knowledge sources from a specific Knowledge Base (resets to 0 active sources)
 */
export function clearKnowledgeBase(kbId: string): MultiKnowledgeBaseState {
  const state = getMultiKnowledgeBaseState();
  const kb = state.knowledgeBases.find((k) => k.id === kbId);

  if (kb) {
    kb.selection = [];
    kb.docs = [];
    kb.checks = [];
    kb.rules = [];
    kb.conditions = [];
    kb.updatedAt = new Date().toISOString();

    persistAndBroadcast(state);
  }

  return state;
}

/**
 * Rename a Knowledge Base
 */
export function renameKnowledgeBase(kbId: string, newName: string): MultiKnowledgeBaseState {
  const state = getMultiKnowledgeBaseState();
  const kb = state.knowledgeBases.find((k) => k.id === kbId);

  if (kb && newName.trim()) {
    kb.name = newName.trim();
    kb.updatedAt = new Date().toISOString();
    persistAndBroadcast(state);
  }

  return state;
}
