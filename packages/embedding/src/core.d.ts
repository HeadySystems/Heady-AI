// heady-allow:orphans — baseline orphan (rebuild in progress); triage dead-vs-wire in follow-up (audit FILE_MANIFEST)
// Types for the dependency-free core (core.mjs).
export interface ModelLock {
  id: string;
  dim: number;
  pooling: "mean" | "cls";
  version: string;
}
export const LOCKED_MODEL: Readonly<ModelLock>;
export function assertModelLock(model?: ModelLock): true;
export function normalizeContent(text: string): string;
export function contentHash(text: string): string;
export function vectorKey(text: string, model?: ModelLock): string;
export function idempotencyKey(text: string, model?: ModelLock): string;
export function significantDigest(record: Record<string, unknown>, significantFields?: string[]): string;
export function significanceGate(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
  significantFields?: string[],
): { reembed: boolean; reason: string };
export function dedupLookup<T>(
  ledger: { get(key: string): T | undefined },
  key: string,
): { hit: boolean; ref: T | null };

export interface AcquireTier<T = number[]> {
  name: string;
  latencyClass?: string;
  get(key: string): Promise<T | undefined> | T | undefined;
}
export const DEFAULT_TIER_ORDER: readonly ["kv", "vectorize", "pgvector"];
export function acquire<T = number[]>(
  key: string,
  tiers: AcquireTier<T>[],
): Promise<{ hit: boolean; tier: string | null; latencyClass: string | null; value: T | null }>;

export type JobState =
  | "QUEUED" | "DEDUPED" | "SKIPPED" | "EMBEDDING" | "PERSISTED" | "PROJECTED" | "FAILED";
export const JOB_STATES: readonly JobState[];
export function nextState(state: JobState, event: string): JobState;
export function isTerminal(state: JobState): boolean;
export const ACQUISITION_RULES: ReadonlyArray<{ id: number; name: string; invariant: string }>;
