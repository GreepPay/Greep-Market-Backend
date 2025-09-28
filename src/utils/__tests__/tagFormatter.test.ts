import { 
  formatTagsForDisplay, 
  parseTagsFromInput, 
  cleanTagsForStorage 
} from '../tagFormatter';

describe('Tag Formatter', () => {
  describe('formatTagsForDisplay', () => {
    it('should format array of tags to comma-separated string', () => {
      const tags = ['Turkey', 'Spices', 'Fresh'];
      const result = formatTagsForDisplay(tags);
      expect(result).toBe('Turkey, Spices, Fresh');
    });

    it('should handle empty array', () => {
      const tags: string[] = [];
      const result = formatTagsForDisplay(tags);
      expect(result).toBe('');
    });

    it('should handle null or undefined input', () => {
      expect(formatTagsForDisplay(null as any)).toBe('');
      expect(formatTagsForDisplay(undefined as any)).toBe('');
    });

    it('should filter out empty tags', () => {
      const tags = ['Turkey', '', 'Spices', '   ', 'Fresh'];
      const result = formatTagsForDisplay(tags);
      expect(result).toBe('Turkey, Spices, Fresh');
    });
  });

  describe('parseTagsFromInput', () => {
    it('should parse comma-separated string', () => {
      const input = 'Turkey, Spices, Fresh';
      const result = parseTagsFromInput(input);
      expect(result).toEqual(['Turkey', 'Spices', 'Fresh']);
    });

    it('should parse JSON array string', () => {
      const input = '["Turkey", "Spices", "Fresh"]';
      const result = parseTagsFromInput(input);
      expect(result).toEqual(['Turkey', 'Spices', 'Fresh']);
    });

    it('should parse already formatted JSON array string', () => {
      const input = '["Turkey"]';
      const result = parseTagsFromInput(input);
      expect(result).toEqual(['Turkey']);
    });

    it('should parse array input', () => {
      const input = ['Turkey', 'Spices', 'Fresh'];
      const result = parseTagsFromInput(input);
      expect(result).toEqual(['Turkey', 'Spices', 'Fresh']);
    });

    it('should handle empty input', () => {
      expect(parseTagsFromInput('')).toEqual([]);
      expect(parseTagsFromInput(null)).toEqual([]);
      expect(parseTagsFromInput(undefined)).toEqual([]);
    });

    it('should trim whitespace from tags', () => {
      const input = ' Turkey ,  Spices  , Fresh ';
      const result = parseTagsFromInput(input);
      expect(result).toEqual(['Turkey', 'Spices', 'Fresh']);
    });
  });

  describe('cleanTagsForStorage', () => {
    it('should clean and validate tags array', () => {
      const tags = ['Turkey', ' Spices ', '', 'Fresh'];
      const result = cleanTagsForStorage(tags);
      expect(result).toEqual(['Turkey', 'Spices', 'Fresh']);
    });

    it('should remove JSON-like formatting', () => {
      const tags = ['["Turkey"]', 'Spices', '["Fresh"]'];
      const result = cleanTagsForStorage(tags);
      expect(result).toEqual(['Turkey', 'Spices', 'Fresh']);
    });

    it('should handle complex JSON-like formatting', () => {
      const tags = ['["[\\"turkey\\"]"]', 'Spices'];
      const result = cleanTagsForStorage(tags);
      expect(result).toEqual(['turkey', 'Spices']);
    });

    it('should handle empty array', () => {
      const tags: string[] = [];
      const result = cleanTagsForStorage(tags);
      expect(result).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(cleanTagsForStorage(null as any)).toEqual([]);
      expect(cleanTagsForStorage(undefined as any)).toEqual([]);
    });

    it('should convert non-string elements to strings', () => {
      const tags = [123, 'Spices', true];
      const result = cleanTagsForStorage(tags as any);
      expect(result).toEqual(['123', 'Spices', 'true']);
    });
  });

  describe('Integration Test - Fix the Display Issue', () => {
    it('should fix the ["Turkey"] display issue', () => {
      // Simulate the problematic input that shows as ["Turkey"] instead of Turkey
      const problematicInput = '["Turkey"]';
      
      // Parse it correctly
      const parsedTags = parseTagsFromInput(problematicInput);
      expect(parsedTags).toEqual(['Turkey']);
      
      // Clean it for storage
      const cleanedTags = cleanTagsForStorage(parsedTags);
      expect(cleanedTags).toEqual(['Turkey']);
      
      // Format for display
      const displayFormat = formatTagsForDisplay(cleanedTags);
      expect(displayFormat).toBe('Turkey');
    });

    it('should handle the complex nested JSON issue', () => {
      // Simulate the complex nested JSON that appears in the UI
      const complexInput = '["[\\"turkey\\"]"]';
      
      const parsedTags = parseTagsFromInput(complexInput);
      const cleanedTags = cleanTagsForStorage(parsedTags);
      const displayFormat = formatTagsForDisplay(cleanedTags);
      
      expect(displayFormat).toBe('turkey');
    });

    it('should handle multiple tags with mixed formatting', () => {
      const mixedInput = ['["Turkey"]', 'Spices', 'Fresh Produce'];
      
      const cleanedTags = cleanTagsForStorage(mixedInput);
      const displayFormat = formatTagsForDisplay(cleanedTags);
      
      expect(cleanedTags).toEqual(['Turkey', 'Spices', 'Fresh Produce']);
      expect(displayFormat).toBe('Turkey, Spices, Fresh Produce');
    });
  });
});
