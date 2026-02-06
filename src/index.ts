/**
 * @miriam/core - Core tools for Miriam AI agent
 * 
 * Provides memory, research, and dashboard tools.
 * Module structure ready for OpenClaw plugin registration.
 */

// Export emotional state tool
export {
  initEmotionalState,
  readEmotionalState,
  updateEmotionalState,
} from "./tools/emotional-state.ts";
export type {
  EmotionalState,
  EmotionalStateUpdate,
  WakeEntry,
} from "./tools/emotional-state.ts";

// Export memory update tool
export {
  memoryUpdate,
  validateMemoryPath,
  MemoryOperation,
} from "./tools/memory-update.ts";
export type { MemoryOperation as MemoryOperationType } from "./tools/memory-update.ts";

// Export research tool
export {
  checkQuota,
  routeResearch,
  saveResult,
  logUsage,
  resetDailyQuota,
} from "./tools/research.ts";
export type {
  ResearchConfig,
  QuotaInfo,
  RouteDecision,
  ResearchResult,
  RouteOptions,
} from "./tools/research.ts";

// Export dashboard note tool
export {
  updateDashboardNote,
  readCurrentNote,
  validateNoteContent,
} from "./tools/dashboard-note.ts";
export type {
  DashboardNote,
  ValidationResult,
} from "./tools/dashboard-note.ts";

// Export memory search tool
export { memorySearch } from "./tools/memory-search.ts";
export type {
  MemorySearchParams,
  SearchResult,
  MemorySearchResult,
} from "./tools/memory-search.ts";

// Export quick capture tool
export { quickCapture } from "./tools/quick-capture.ts";
export type {
  QuickCaptureParams,
  QuickCaptureResult,
} from "./tools/quick-capture.ts";

// Export thread marker tool
export { threadMarker } from "./tools/thread-marker.ts";
export type {
  ThreadMarkerParams,
  ThreadMarkerResult,
} from "./tools/thread-marker.ts";

// Export task executor tool
export { taskExecutor } from "./tools/task-executor.ts";
export type {
  TaskExecutorParams,
  Task,
  TaskExecutorResult,
} from "./tools/task-executor.ts";

// Export diary tool
export {
  diaryWrite,
  diaryRead,
  diaryToday,
  diaryStats,
} from "./tools/diary.ts";
export type {
  DiaryEntry,
  DiaryWriteParams,
  DiaryReadParams,
} from "./tools/diary.ts";

// Export file utilities
export {
  safeReadFile,
  readJSON,
  writeJSON,
  atomicWrite,
  backupFile,
  appendToFile,
  fileExists,
} from "./utils/fs.ts";
export type { WriteOptions } from "./utils/fs.ts";

// Plugin manifest structure (for future OpenClaw registration)
export const PLUGIN_MANIFEST = {
  name: "@miriam/core",
  version: "1.0.0",
  description: "Core tools for Miriam AI agent",
  tools: [
    "emotional-state",
    "memory-update",
    "research",
    "dashboard-note",
    "memory-search",
    "quick-capture",
    "thread-marker",
    "task-executor",
    "diary",
  ],
} as const;
