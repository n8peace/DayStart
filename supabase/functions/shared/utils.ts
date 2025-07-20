// Last Updated: 2024-07-19
// Shared utilities for DayStart Edge Functions
import { LogEntry } from './types.ts';

export async function safeLogError(supabaseClient: any, logData: Partial<LogEntry>): Promise<void> {
  try {
    await supabaseClient.from('logs').insert(logData);
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
}

export function utcDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// Add other shared utilities as needed 