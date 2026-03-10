import { query } from "./_generated/server";
import { httpAction } from "./_generated/server";

/**
 * Health check query - can be called from the client
 */
export const health = query(async () => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "convex",
  };
});