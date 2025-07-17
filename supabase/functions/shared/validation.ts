// Shared runtime validation utilities for DayStart Edge Functions

// Validate required environment variables
export function validateEnvVars(requiredVars: string[]): void {
  for (const key of requiredVars) {
    if (!Deno.env.get(key)) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

// Validate object shape (shallow, for simple runtime checks)
export function validateObjectShape(obj: any, requiredKeys: string[]): void {
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      throw new Error(`Missing required property: ${key}`);
    }
  }
} 