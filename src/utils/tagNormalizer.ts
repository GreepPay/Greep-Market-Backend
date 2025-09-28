/**
 * Tag normalization utilities for merging similar tags
 */

/**
 * Normalize a single tag by removing extra spaces, converting to lowercase,
 * and applying common transformations
 */
export function normalizeTag(tag: string): string {
  if (!tag || typeof tag !== 'string') {
    return '';
  }

  let normalized = tag.trim();
  
  // Return empty string for whitespace-only tags
  if (normalized.length === 0 || normalized.match(/^\s*$/)) {
    return '';
  }

  normalized = normalized.toLowerCase();
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Remove special characters except letters, numbers, spaces, hyphens, and unicode
  // Keep parentheses and ampersands as they might be meaningful
  normalized = normalized.replace(/[^\w\s-\u00C0-\u017F\u00C0-\u00FF\u0100-\u017F()&]/g, '');
  
  // Handle common variations and abbreviations
  normalized = normalizeCommonVariations(normalized);
  
  return normalized;
}

/**
 * Normalize common variations and abbreviations
 */
function normalizeCommonVariations(tag: string): string {
  const variations: { [key: string]: string } = {
    // Turkey variations
    'turk': 'turkey',
    'turkish': 'turkey',
    'turkiye': 'turkey',
    
    // Common food terms
    'fresh': 'fresh',
    'organic': 'organic',
    'local': 'local',
    'imported': 'imported',
    'premium': 'premium',
    'quality': 'quality',
    
    // Spice variations
    'spices': 'spices',
    'spice': 'spices',
    'seasoning': 'spices',
    'seasonings': 'spices',
    'herbs': 'herbs',
    'herb': 'herbs',
    
    // Vegetable variations
    'vegetables': 'vegetables',
    'veggies': 'vegetables',
    'produce': 'vegetables',
    'greens': 'vegetables',
    
    // Fruit variations
    'fruits': 'fruit',
    
    // Meat variations
    'meats': 'meat',
    'poultry': 'meat',
    'beef': 'meat',
    'chicken': 'meat',
    'pork': 'meat',
    'lamb': 'meat',
    
    // Dairy variations
    'dairy': 'dairy',
    'milk': 'dairy',
    'cheese': 'dairy',
    'yogurt': 'dairy',
    
    // Grain variations
    'grains': 'grain',
    'cereals': 'grain',
    'bread': 'grain',
    'pasta': 'grain',
    
    // Size variations
    'small': 'small',
    'medium': 'medium',
    'large': 'large',
    'extra large': 'large',
    'xl': 'large',
    'xs': 'small',
    
    // Color variations
    'red': 'red',
    'green': 'green',
    'blue': 'blue',
    'yellow': 'yellow',
    'black': 'black',
    'white': 'white',
    'brown': 'brown',
    
    // Common brand variations
    'mr chef': 'mr chef',
    'mrchef': 'mr chef',
    'mr-chef': 'mr chef',
    
    // Common descriptors
    'hot': 'hot',
    'cold': 'cold',
    'sweet': 'sweet',
    'spicy': 'spicy',
    'mild': 'mild',
    'sour': 'sour',
    'bitter': 'bitter',
  };

  // Check for exact matches first
  if (variations[tag]) {
    return variations[tag];
  }

  // Check for partial matches only if the tag is a single word
  // This prevents "turkey fresh" from becoming just "turkey"
  if (!tag.includes(' ')) {
    for (const [key, value] of Object.entries(variations)) {
      if (tag.includes(key) || key.includes(tag)) {
        return value;
      }
    }
  }

  return tag;
}

/**
 * Normalize an array of tags and remove duplicates
 */
export function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const normalizedMap = new Map<string, string>();
  
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (normalized && normalized.length > 0) {
      // Keep the original casing of the first occurrence
      if (!normalizedMap.has(normalized)) {
        // Find the best representative (prefer title case, then original)
        const originalTag = tag.trim();
        normalizedMap.set(normalized, originalTag);
      }
    }
  }
  
  return Array.from(normalizedMap.values()).sort();
}

/**
 * Find similar tags in a list and suggest merges
 */
export function findSimilarTags(tags: string[]): Array<{
  normalized: string;
  originals: string[];
  suggestion: string;
}> {
  const groups = new Map<string, string[]>();
  
  // Group tags by their normalized form
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (normalized && normalized.length > 0) {
      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(tag);
    }
  }
  
  // Return groups that have multiple variations
  const similarGroups: Array<{
    normalized: string;
    originals: string[];
    suggestion: string;
  }> = [];
  
  for (const [normalized, originals] of groups) {
    if (originals.length > 1) {
      // Suggest the most appropriate representative
      const suggestion = selectBestRepresentative(originals);
      similarGroups.push({
        normalized,
        originals,
        suggestion
      });
    }
  }
  
  return similarGroups.sort((a, b) => b.originals.length - a.originals.length);
}

/**
 * Select the best representative tag from a group of similar tags
 */
export function selectBestRepresentative(tags: string[]): string {
  // Prefer title case
  const titleCase = tags.find(tag => 
    tag === tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()
  );
  if (titleCase) return titleCase;
  
  // Prefer longer tags (more descriptive)
  const longest = tags.reduce((longest, current) => 
    current.length > longest.length ? current : longest
  );
  
  // If longest is reasonable length, use it
  if (longest.length <= 20) {
    return longest;
  }
  
  // Otherwise, use the first one
  return tags[0];
}

/**
 * Get tag statistics for analysis
 */
export function getTagStatistics(tags: string[]): {
  total: number;
  unique: number;
  normalized: number;
  duplicates: Array<{ tag: string; count: number }>;
  similar: Array<{ normalized: string; originals: string[]; suggestion: string }>;
} {
  const normalized = normalizeTags(tags);
  const similar = findSimilarTags(tags);
  
  // Count duplicates
  const tagCounts = new Map<string, number>();
  for (const tag of tags) {
    const normalizedTag = normalizeTag(tag);
    tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
  }
  
  const duplicates = Array.from(tagCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  
  return {
    total: tags.length,
    unique: new Set(tags.map(normalizeTag)).size,
    normalized: normalized.length,
    duplicates,
    similar
  };
}

/**
 * Batch normalize tags for database migration
 */
export function batchNormalizeTags(tags: string[], batchSize: number = 100): string[][] {
  const batches: string[][] = [];
  
  for (let i = 0; i < tags.length; i += batchSize) {
    const batch = tags.slice(i, i + batchSize);
    const normalizedBatch = normalizeTags(batch);
    batches.push(normalizedBatch);
  }
  
  return batches;
}
