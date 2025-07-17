// Centralized status values and utilities for content blocks

export const ContentBlockStatus = {
  PENDING: 'pending',
  CONTENT_GENERATING: 'content_generating',
  CONTENT_READY: 'content_ready',
  CONTENT_FAILED: 'content_failed',
  SCRIPT_GENERATING: 'script_generating',
  SCRIPT_GENERATED: 'script_generated',
  SCRIPT_FAILED: 'script_failed',
  AUDIO_GENERATING: 'audio_generating',
  READY: 'ready',
  AUDIO_FAILED: 'audio_failed',
  FAILED: 'failed',
  EXPIRED: 'expired',
  RETRY_PENDING: 'retry_pending',
} as const;

export type ContentBlockStatusType = typeof ContentBlockStatus[keyof typeof ContentBlockStatus];

// Valid status transitions
const validTransitions: Record<ContentBlockStatusType, ContentBlockStatusType[]> = {
  pending: ['content_generating', 'content_ready', 'content_failed'],
  content_generating: ['content_ready', 'content_failed'],
  content_ready: ['script_generating', 'content_failed'],
  content_failed: ['retry_pending', 'failed'],
  script_generating: ['script_generated', 'script_failed'],
  script_generated: ['audio_generating', 'audio_failed'],
  script_failed: ['retry_pending', 'failed'],
  audio_generating: ['ready', 'audio_failed'],
  ready: ['expired'],
  audio_failed: ['retry_pending', 'failed'],
  failed: [],
  expired: [],
  retry_pending: ['content_generating', 'script_generating', 'audio_generating', 'failed'],
};

export function isValidStatusTransition(from: ContentBlockStatusType, to: ContentBlockStatusType): boolean {
  return validTransitions[from]?.includes(to) ?? false;
} 