import { getUserScopedKey, pushKnowledgeSyncState } from './cloudSyncService';
import { InteractionRule, SafetyCheckRecord } from '../types';
import { UploadedDocumentRecord } from './r2StorageService';
import { API_BASE_URL } from '../config/api';

export interface KnowledgeBaseProfile {
  id: string;
  name: string;
  description: string;
  selection: string[];
  docs: string[];
  checks: string[];
  rules: string[];
  conditions: string[];
  synthesizedRules?: InteractionRule[];
  precautions?: string[];
  updatedAt: string;
}

export interface MultiKnowledgeBaseState {
  activeKbId: string | null;
  knowledgeBases: KnowledgeBaseProfile[];
}

export const DEFAULT_KNOWLEDGE_BASES: KnowledgeBaseProfile[] = [];

const STORAGE_KEY_MULTI_KB = 'smileclinic_multi_knowledge_bases';
const STORAGE_KEY_ACTIVE_KB = 'smileclinic_active_kb_id';

/**
 * Retrieve the current Multi-KB state. Zero dummy data.
 */
export function getMultiKnowledgeBaseState(): MultiKnowledgeBaseState {
  if (typeof window === 'undefined') {
    return {
      activeKbId: null,
      knowledgeBases: [],
    };
  }

  try {
    const kMulti = getUserScopedKey(STORAGE_KEY_MULTI_KB);
    const kActive = getUserScopedKey(STORAGE_KEY_ACTIVE_KB);

    const rawMulti = kMulti ? localStorage.getItem(kMulti) : null;
    const rawActive = kActive ? localStorage.getItem(kActive) : null;

    let activeKbId: string | null = rawActive || null;
    let knowledgeBases: KnowledgeBaseProfile[] = [];

    if (rawMulti) {
      const parsed = JSON.parse(rawMulti);
      if (Array.isArray(parsed)) {
        // Filter out legacy unconfigured empty dummy presets if user never configured them
        knowledgeBases = parsed.filter((kb) => {
          if (!kb || !kb.id || !kb.name) return false;
          // If it was one of the old dummy defaults with 0 items, discard it
          const isOldDummy =
            (kb.name === 'Primary Clinical & Prescription Protocol' ||
             kb.name === 'Renal & Hepatic Impairment Protocol' ||
             kb.name === 'Custom Dental Operatory Protocol') &&
            (!kb.selection || kb.selection.length === 0) &&
            (!kb.docs || kb.docs.length === 0) &&
            (!kb.checks || kb.checks.length === 0);
          return !isOldDummy;
        });
      }
    }

    if (activeKbId && !knowledgeBases.some((kb) => kb.id === activeKbId)) {
      activeKbId = knowledgeBases.length > 0 ? knowledgeBases[0].id : null;
    }

    return { activeKbId, knowledgeBases };
  } catch (err) {
    console.warn('[KnowledgeBaseService] Error loading multi-KB state:', err);
    return {
      activeKbId: null,
      knowledgeBases: [],
    };
  }
}

/**
 * Get the currently active Knowledge Base (or null if unselected)
 */
export function getActiveKnowledgeBase(): KnowledgeBaseProfile | null {
  const state = getMultiKnowledgeBaseState();
  if (!state.activeKbId) return null;
  const active = state.knowledgeBases.find((kb) => kb.id === state.activeKbId);
  return active || null;
}

/**
 * Persist and broadcast state changes across tabs and cloud database
 */
function persistAndBroadcast(state: MultiKnowledgeBaseState) {
  if (typeof window === 'undefined') return;

  try {
    const kMulti = getUserScopedKey(STORAGE_KEY_MULTI_KB);
    const kActive = getUserScopedKey(STORAGE_KEY_ACTIVE_KB);

    if (kMulti) localStorage.setItem(kMulti, JSON.stringify(state.knowledgeBases));
    if (kActive) {
      if (state.activeKbId) {
        localStorage.setItem(kActive, state.activeKbId);
      } else {
        localStorage.removeItem(kActive);
      }
    }

    const activeKb = state.activeKbId
      ? state.knowledgeBases.find((kb) => kb.id === state.activeKbId) || null
      : null;

    const kSel = getUserScopedKey('smileclinic_synced_knowledge_selection');
    const kDocs = getUserScopedKey('smileclinic_synced_active_docs');
    const kChecks = getUserScopedKey('smileclinic_synced_active_checks');
    const kRules = getUserScopedKey('smileclinic_synced_active_rules');
    const kConds = getUserScopedKey('smileclinic_synced_active_conditions');
    const kSync = getUserScopedKey('smileclinic_last_rules_sync');

    if (kSel) localStorage.setItem(kSel, JSON.stringify(activeKb?.selection || []));
    if (kDocs) localStorage.setItem(kDocs, JSON.stringify(activeKb?.docs || []));
    if (kChecks) localStorage.setItem(kChecks, JSON.stringify(activeKb?.checks || []));
    if (kRules) localStorage.setItem(kRules, JSON.stringify(activeKb?.rules || []));
    if (kConds) localStorage.setItem(kConds, JSON.stringify(activeKb?.conditions || []));
    if (kSync) localStorage.setItem(kSync, new Date().toISOString());

    // Broadcast reactive event
    window.dispatchEvent(
      new CustomEvent('smileclinic_knowledge_synced', {
        detail: {
          activeKbId: state.activeKbId,
          activeKb,
          allKbs: state.knowledgeBases,
          selection: activeKb?.selection || [],
          docs: activeKb?.docs || [],
          checks: activeKb?.checks || [],
          rules: activeKb?.rules || [],
          conditions: activeKb?.conditions || [],
        },
      })
    );

    // Push state to cloud backend
    pushKnowledgeSyncState({
      selection: activeKb?.selection || [],
      conditions: activeKb?.conditions || [],
      checks: activeKb?.checks || [],
      rules: activeKb?.rules || [],
      docs: activeKb?.docs || [],
      multiKb: state,
    } as any).catch(() => {});
  } catch (err) {
    console.warn('[KnowledgeBaseService] Failed to persist and broadcast KB state:', err);
  }
}

/**
 * Select or unselect a Knowledge Base
 * If already active, it toggles off (unselects, setting activeKbId to null)
 */
export function toggleActiveKnowledgeBase(kbId: string): MultiKnowledgeBaseState {
  const state = getMultiKnowledgeBaseState();
  if (state.activeKbId === kbId) {
    state.activeKbId = null; // Unselect!
  } else if (state.knowledgeBases.some((kb) => kb.id === kbId)) {
    state.activeKbId = kbId; // Select!
  }
  persistAndBroadcast(state);
  return state;
}

/**
 * Explicitly set active Knowledge Base (or null to unselect all)
 */
export function setActiveKnowledgeBase(kbId: string | null): MultiKnowledgeBaseState {
  const state = getMultiKnowledgeBaseState();
  if (kbId === null || kbId === '') {
    state.activeKbId = null;
    persistAndBroadcast(state);
  } else if (state.knowledgeBases.some((kb) => kb.id === kbId)) {
    state.activeKbId = kbId;
    persistAndBroadcast(state);
  }
  return state;
}

/**
 * Create a new Knowledge Base or update an existing one
 */
export function saveKnowledgeBase(
  kbId: string,
  data: {
    name: string;
    selection: string[];
    docs: string[];
    checks: string[];
    rules?: string[];
    conditions: string[];
    description?: string;
    synthesizedRules?: InteractionRule[];
    precautions?: string[];
  }
): { state: MultiKnowledgeBaseState; savedKb: KnowledgeBaseProfile } {
  const state = getMultiKnowledgeBaseState();
  let existingIndex = state.knowledgeBases.findIndex((k) => k.id === kbId);

  const cleanName = data.name.trim();

  let targetKb: KnowledgeBaseProfile;
  if (existingIndex >= 0) {
    targetKb = state.knowledgeBases[existingIndex];
    targetKb.name = cleanName;
    targetKb.selection = data.selection;
    targetKb.docs = data.docs;
    targetKb.checks = data.checks;
    targetKb.rules = data.rules || [];
    targetKb.conditions = data.conditions;
    if (data.description !== undefined) targetKb.description = data.description;
    if (data.synthesizedRules !== undefined) targetKb.synthesizedRules = data.synthesizedRules;
    if (data.precautions !== undefined) targetKb.precautions = data.precautions;
    targetKb.updatedAt = new Date().toISOString();
  } else {
    // Create new custom profile
    const newId = kbId.startsWith('kb-') ? kbId : `kb-${Date.now()}`;
    targetKb = {
      id: newId,
      name: cleanName,
      description: data.description || `Custom clinical protocol for ${cleanName}`,
      selection: data.selection,
      docs: data.docs,
      checks: data.checks,
      rules: data.rules || [],
      conditions: data.conditions,
      synthesizedRules: data.synthesizedRules || [],
      precautions: data.precautions || [],
      updatedAt: new Date().toISOString(),
    };
    state.knowledgeBases.push(targetKb);
  }

  // Automatically make the newly configured KB the active one
  state.activeKbId = targetKb.id;

  persistAndBroadcast(state);
  return { state, savedKb: targetKb };
}

/**
 * Delete a Knowledge Base completely
 */
export function deleteKnowledgeBase(kbId: string): MultiKnowledgeBaseState {
  const state = getMultiKnowledgeBaseState();
  state.knowledgeBases = state.knowledgeBases.filter((k) => k.id !== kbId);
  if (state.activeKbId === kbId) {
    state.activeKbId = state.knowledgeBases.length > 0 ? state.knowledgeBases[0].id : null;
  }
  persistAndBroadcast(state);
  return state;
}

/**
 * Clear all knowledge sources from a specific Knowledge Base
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
    kb.synthesizedRules = [];
    kb.precautions = [];
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

/**
 * Call the backend Gemini failover AI engine to synthesize connections
 * across selected medicines, prior regimens, and clinical history documents.
 */
export async function synthesizeKnowledgeWithAI(payload: {
  name: string;
  documents: string[];
  regimens: any[];
  conditions: string[];
}): Promise<{
  status: string;
  name: string;
  summary: string;
  extractedMedicines: any[];
  rules: InteractionRule[];
  precautions: string[];
}> {
  const cleanName = payload.name.trim();
  if (!cleanName || cleanName.length < 3) {
    throw new Error('Knowledge Base name is required (minimum 3 characters)');
  }

  const endpoint = `${API_BASE_URL}/api/prescriptions/synthesize-knowledge`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanName,
        documents: payload.documents,
        regimens: payload.regimens,
        conditions: payload.conditions,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI Synthesis endpoint error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      status: 'success',
      name: cleanName,
      summary: data.summary || `Synthesized protocol for ${cleanName}`,
      extractedMedicines: data.extractedMedicines || [],
      rules: (data.rules || []).map((r: any, idx: number) => ({
        id: `synth-rule-${Date.now()}-${idx}`,
        drugA: r.drugA || 'Medication A',
        drugB: r.drugB || 'Medication B',
        severity: (r.severity || 'moderate').toLowerCase(),
        category: r.category || 'Drug-Drug',
        description: r.description || 'Clinical interaction detected during AI synthesis.',
        active: r.active !== false,
        sourceFile: 'AI Knowledge Synthesis',
      })),
      precautions: data.precautions || [],
    };
  } catch (err: any) {
    console.warn('[KnowledgeBaseService] AI synthesis remote failed, using local clinical synthesis:', err);
    // Local clinical fallback
    const fallbackRules: InteractionRule[] = [];
    payload.conditions.forEach((cond, idx) => {
      fallbackRules.push({
        id: `synth-rule-local-c-${idx}`,
        drugA: 'Dental NSAIDs / Opioids',
        drugB: cond,
        severity: 'moderate',
        category: 'Drug-Condition',
        description: `Precautionary review required: patient clinical history documents ${cond}.`,
        active: true,
        sourceFile: 'Clinical History Synthesis',
      });
    });

    payload.regimens.forEach((reg: any, idx: number) => {
      const medList = reg.medications || reg.prescriptions || [];
      medList.forEach((m: any, mIdx: number) => {
        const mName = m.drugName || m.name || (typeof m === 'string' ? m : 'Active Med');
        fallbackRules.push({
          id: `synth-rule-local-r-${idx}-${mIdx}`,
          drugA: mName,
          drugB: 'Dental Antibiotics / Analgesics',
          severity: 'moderate',
          category: 'Drug-Drug',
          description: `Screen concurrent therapy against patient prior regimen: ${mName}.`,
          active: true,
          sourceFile: 'Prior Regimen Synthesis',
        });
      });
    });

    return {
      status: 'success',
      name: cleanName,
      summary: `Synthesized clinical safety protocol for ${cleanName}`,
      extractedMedicines: [],
      rules: fallbackRules,
      precautions: [
        `Enforce targeted surveillance against selected clinical history (${payload.documents.slice(0, 3).join(', ') || 'history sources'}).`,
      ],
    };
  }
}

export interface ResolvedKnowledgeRule {
  rule: InteractionRule;
  sourceDoc?: UploadedDocumentRecord;
  sourceCheck?: SafetyCheckRecord;
  pdfUrl?: string;
  sourceType: 'document' | 'check' | 'direct' | 'synthesized';
}

/**
 * Aggregate all clinical rules that make up a specific Knowledge Base,
 * including synthesized rules from Gemini AI analysis.
 */
export function getRulesForKnowledgeBase(
  kb: KnowledgeBaseProfile | null,
  allRules: InteractionRule[],
  allDocs: UploadedDocumentRecord[] = [],
  allChecks: SafetyCheckRecord[] = []
): ResolvedKnowledgeRule[] {
  if (!kb) return [];

  const resolved: ResolvedKnowledgeRule[] = [];
  const seenRuleIds = new Set<string>();

  // 0. Include AI-synthesized rules for this Knowledge Base
  if (Array.isArray(kb.synthesizedRules) && kb.synthesizedRules.length > 0) {
    for (const r of kb.synthesizedRules) {
      if (!seenRuleIds.has(r.id)) {
        seenRuleIds.add(r.id);
        resolved.push({
          rule: r,
          sourceType: 'synthesized',
        });
      }
    }
  }

  const docNameSet = new Set((kb.docs || []).map((d) => (d || '').toLowerCase().trim()));
  const checkIdSet = new Set((kb.checks || []).map((c) => String(c).toLowerCase().trim()));
  const directRuleSet = new Set((kb.rules || []).map((r) => String(r).toLowerCase().trim()));
  const selectionSet = new Set((kb.selection || []).map((s) => String(s).toLowerCase().trim()));

  // 1. Check all docs in this KB
  for (const doc of allDocs) {
    const fn = (doc.filename || '').toLowerCase().trim();
    const docId = String(doc.id || '').toLowerCase().trim();
    const isDocSelected =
      docNameSet.has(fn) ||
      selectionSet.has('doc-' + fn) ||
      selectionSet.has('doc-' + docId) ||
      (kb.docs || []).some((d) => d && (fn.includes(d.toLowerCase()) || d.toLowerCase().includes(fn)));

    if (isDocSelected) {
      const docRules = (doc as any).extractedRules;
      if (Array.isArray(docRules) && docRules.length > 0) {
        for (const r of docRules) {
          if (!seenRuleIds.has(r.id)) {
            seenRuleIds.add(r.id);
            resolved.push({
              rule: r,
              sourceDoc: doc,
              pdfUrl: doc.storageUrl,
              sourceType: 'document',
            });
          }
        }
      }
      for (const r of allRules) {
        const sf = (r.sourceFile || '').toLowerCase().trim();
        if (sf && (sf === fn || fn.includes(sf) || sf.includes(fn))) {
          if (!seenRuleIds.has(r.id)) {
            seenRuleIds.add(r.id);
            resolved.push({
              rule: r,
              sourceDoc: doc,
              pdfUrl: doc.storageUrl || r.storageUrl,
              sourceType: 'document',
            });
          }
        }
      }
    }
  }

  // 2. Direct rules matching kb.rules or kb.selection
  for (const r of allRules) {
    const rId = String(r.id).toLowerCase().trim();
    if (directRuleSet.has(rId) || selectionSet.has('rule-' + rId)) {
      if (!seenRuleIds.has(r.id)) {
        seenRuleIds.add(r.id);
        const matchingDoc = allDocs.find(
          (d) => (d.filename || '').toLowerCase() === (r.sourceFile || '').toLowerCase()
        );
        resolved.push({
          rule: r,
          sourceDoc: matchingDoc,
          pdfUrl: matchingDoc?.storageUrl || r.storageUrl,
          sourceType: 'direct',
        });
      }
    }
  }

  // 3. Checks in this KB
  for (const chk of allChecks) {
    const chkId = String(chk.id).toLowerCase().trim();
    const chkNum = String(chk.checkNumber || '').toLowerCase().trim();
    const isCheckSelected =
      checkIdSet.has(chkId) ||
      checkIdSet.has(chkNum) ||
      selectionSet.has('check-' + chkId) ||
      selectionSet.has('check-' + chkNum);

    if (isCheckSelected) {
      const medNames = (chk.prescriptions || [])
        .map((p) => (p.drugName || '').toLowerCase().trim())
        .filter(Boolean);

      for (const r of allRules) {
        const dA = (r.drugA || '').toLowerCase().trim();
        const dB = (r.drugB || '').toLowerCase().trim();
        if (medNames.some((m) => m === dA || m === dB)) {
          if (!seenRuleIds.has(r.id)) {
            seenRuleIds.add(r.id);
            resolved.push({
              rule: r,
              sourceCheck: chk,
              sourceType: 'check',
            });
          }
        }
      }
    }
  }

  return resolved;
}
