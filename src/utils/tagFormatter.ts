/**
 * Tag formatting utilities for consistent tag display
 */

import { normalizeTags } from './tagNormalizer';

/**
 * Format tags for display - converts array to clean string representation
 * @param tags - Array of tag strings
 * @returns Formatted string for display
 */
export function formatTagsForDisplay(tags: string[]): string {
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  
  // Filter out empty tags and join with comma
  return tags.filter(tag => tag && tag.trim().length > 0).join(', ');
}

/**
 * Parse tags from various input formats
 * @param input - String, array, or JSON string
 * @returns Clean array of tag strings
 */
export function parseTagsFromInput(input: any): string[] {
  if (!input) {
    return [];
  }
  
  // If it's already an array
  if (Array.isArray(input)) {
    return input
      .map(tag => typeof tag === 'string' ? tag.trim() : String(tag).trim())
      .filter(tag => tag.length > 0);
  }
  
  // If it's a string
  if (typeof input === 'string') {
    try {
      // Try to parse as JSON first (in case it's a JSON string)
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed
          .map(tag => typeof tag === 'string' ? tag.trim() : String(tag).trim())
          .filter(tag => tag.length > 0);
      }
    } catch {
      // If JSON parsing fails, treat as comma-separated string
      return input
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }
  }
  
  return [];
}

/**
 * Clean and validate tags before saving
 * @param tags - Array of tag strings
 * @returns Cleaned and normalized array of valid tags
 */
export function cleanTagsForStorage(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  
  // First clean JSON formatting and expand comma-separated values
  const allCleanedTags: string[] = [];
  
  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue;
    }
    
    const trimmedTag = tag.trim();
    if (trimmedTag.length === 0) {
      continue;
    }
    
    // Handle JSON array strings like '["seasoning","flavor"]'
    if (trimmedTag.startsWith('[') && trimmedTag.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmedTag);
        if (Array.isArray(parsed)) {
          // Add each item from the JSON array as a separate tag
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim().length > 0) {
              allCleanedTags.push(item.trim());
            }
          }
          continue;
        }
      } catch {
        // If JSON parsing fails, treat as regular string
      }
    }
    
    // Handle comma-separated values in regular strings
    if (trimmedTag.includes(',')) {
      const splitTags = trimmedTag.split(',').map(t => t.trim()).filter(t => t.length > 0);
      allCleanedTags.push(...splitTags);
    } else {
      allCleanedTags.push(trimmedTag);
    }
  }
  
  // Then normalize to merge similar tags
  return normalizeTags(allCleanedTags);
}
