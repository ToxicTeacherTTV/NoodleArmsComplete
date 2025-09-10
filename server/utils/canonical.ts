/**
 * Shared utility for generating canonical keys for fact deduplication
 */
export function generateCanonicalKey(content: string): string {
  // Normalize content for consistent matching
  const normalized = content
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .substring(0, 100);      // Limit length
  
  // Simple hash for canonical key
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `fact_${Math.abs(hash)}`;
}