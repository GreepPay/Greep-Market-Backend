import { 
  normalizeTag, 
  normalizeTags, 
  findSimilarTags, 
  getTagStatistics,
  selectBestRepresentative 
} from '../tagNormalizer';

describe('Tag Normalizer', () => {
  describe('normalizeTag', () => {
    it('should normalize basic tags', () => {
      expect(normalizeTag('Turkey')).toBe('turkey');
      expect(normalizeTag('  Turkey  ')).toBe('turkey');
      expect(normalizeTag('TURKEY')).toBe('turkey');
    });

    it('should handle common variations', () => {
      expect(normalizeTag('Turk')).toBe('turkey');
      expect(normalizeTag('Turkish')).toBe('turkey');
      expect(normalizeTag('Turkiye')).toBe('turkey');
    });

    it('should handle food category variations', () => {
      expect(normalizeTag('Spices')).toBe('spices');
      expect(normalizeTag('Seasoning')).toBe('spices');
      expect(normalizeTag('Seasonings')).toBe('spices');
      expect(normalizeTag('Herbs')).toBe('herbs');
      expect(normalizeTag('Vegetables')).toBe('vegetables');
      expect(normalizeTag('Veggies')).toBe('vegetables');
      expect(normalizeTag('Fruits')).toBe('fruit');
      expect(normalizeTag('Meats')).toBe('meat');
      expect(normalizeTag('Poultry')).toBe('meat');
    });

    it('should handle brand variations', () => {
      expect(normalizeTag('Mr Chef')).toBe('mr chef');
      expect(normalizeTag('MrChef')).toBe('mr chef');
      expect(normalizeTag('Mr-Chef')).toBe('mr chef');
    });

    it('should handle size variations', () => {
      expect(normalizeTag('Extra Large')).toBe('large');
      expect(normalizeTag('XL')).toBe('large');
      expect(normalizeTag('XS')).toBe('small');
    });

    it('should remove special characters', () => {
      expect(normalizeTag('Turkey!')).toBe('turkey');
      expect(normalizeTag('Turkey@#$')).toBe('turkey');
      expect(normalizeTag('Turkey (Fresh)')).toBe('turkey (fresh)');
    });

    it('should handle empty or invalid input', () => {
      expect(normalizeTag('')).toBe('');
      expect(normalizeTag('   ')).toBe('');
      expect(normalizeTag(null as any)).toBe('');
      expect(normalizeTag(undefined as any)).toBe('');
    });
  });

  describe('normalizeTags', () => {
    it('should normalize and deduplicate tags', () => {
      const tags = ['Turkey', 'turkey', 'Turk', 'Spices', 'spice'];
      const result = normalizeTags(tags);
      expect(result).toEqual(['Spices', 'Turkey']); // Keeps first occurrence casing
    });

    it('should handle empty array', () => {
      expect(normalizeTags([])).toEqual([]);
    });

    it('should handle array with duplicates', () => {
      const tags = ['Turkey', 'Turkey', 'turkey', 'Turk'];
      const result = normalizeTags(tags);
      expect(result).toEqual(['Turkey']); // Only one unique normalized tag
    });

    it('should sort results alphabetically', () => {
      const tags = ['Zebra', 'Apple', 'Banana'];
      const result = normalizeTags(tags);
      expect(result).toEqual(['Apple', 'Banana', 'Zebra']);
    });

    it('should handle complex variations', () => {
      const tags = ['Turkey', 'Turk', 'Turkish', 'Turkiye', 'Spices', 'Seasoning'];
      const result = normalizeTags(tags);
      expect(result).toEqual(['Spices', 'Turkey']); // Both normalize to different values
    });
  });

  describe('findSimilarTags', () => {
    it('should find similar tag groups', () => {
      const tags = ['Turkey', 'turkey', 'Turk', 'Spices', 'spice', 'unique'];
      const result = findSimilarTags(tags);
      
      expect(result).toHaveLength(2);
      
      const turkeyGroup = result.find(group => group.normalized === 'turkey');
      const spiceGroup = result.find(group => group.normalized === 'spices');
      
      expect(turkeyGroup).toBeDefined();
      expect(turkeyGroup?.originals).toContain('Turkey');
      expect(turkeyGroup?.originals).toContain('turkey');
      expect(turkeyGroup?.originals).toContain('Turk');
      
      expect(spiceGroup).toBeDefined();
      expect(spiceGroup?.originals).toContain('Spices');
      expect(spiceGroup?.originals).toContain('spice');
    });

    it('should return empty array for no similar tags', () => {
      const tags = ['Apple', 'Banana', 'Cherry'];
      const result = findSimilarTags(tags);
      expect(result).toEqual([]);
    });

    it('should suggest best representative', () => {
      const tags = ['turkey', 'Turkey', 'TURKEY'];
      const result = findSimilarTags(tags);
      
      expect(result).toHaveLength(1);
      expect(result[0].suggestion).toBe('Turkey'); // Title case is preferred
    });
  });

  describe('getTagStatistics', () => {
    it('should provide comprehensive statistics', () => {
      const tags = ['Turkey', 'turkey', 'Turk', 'Spices', 'spice', 'unique', 'Turkey'];
      const stats = getTagStatistics(tags);
      
      expect(stats.total).toBe(7);
      expect(stats.unique).toBe(3); // turkey, spices, unique
      expect(stats.normalized).toBe(3); // turkey, spices, unique
      expect(stats.duplicates).toHaveLength(2);
      expect(stats.similar).toHaveLength(2);
      
      expect(stats.duplicates[0].tag).toBe('turkey');
      expect(stats.duplicates[0].count).toBe(4); // Turkey, turkey, Turk, Turkey (duplicate)
    });

    it('should handle empty array', () => {
      const stats = getTagStatistics([]);
      
      expect(stats.total).toBe(0);
      expect(stats.unique).toBe(0);
      expect(stats.normalized).toBe(0);
      expect(stats.duplicates).toEqual([]);
      expect(stats.similar).toEqual([]);
    });
  });

  describe('Integration Tests', () => {
    it('should merge turkey variations correctly', () => {
      const tags = ['turkey', 'Turkey', 'Turk', 'Turkish', 'Turkiye'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['turkey']); // All merge to one
    });

    it('should merge spice variations correctly', () => {
      const tags = ['Spices', 'spice', 'Seasoning', 'seasonings', 'Herbs'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['Herbs', 'Spices']); // Spices->spices, Seasoning->spices, Herbs->herbs
    });

    it('should handle mixed case scenarios', () => {
      const tags = ['Mr Chef', 'mrchef', 'Mr-Chef', 'MR CHEF'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['Mr Chef']); // All merge to one
    });

    it('should handle real-world product tags', () => {
      const tags = [
        'Turkey',
        'turkey', 
        'Fresh',
        'Spices',
        'spice',
        'Mr Chef',
        'mrchef',
        'Hot',
        'hot',
        'Vegetables',
        'veggies'
      ];
      
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual([
        'Fresh',
        'Hot',
        'Mr Chef', 
        'Spices',
        'Turkey',
        'Vegetables'
      ]);
    });

    it('should preserve meaningful differences', () => {
      const tags = ['Hot', 'Cold', 'Sweet', 'Sour'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['Cold', 'Hot', 'Sour', 'Sweet']); // All different, none merge
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long tags', () => {
      const longTag = 'A'.repeat(100);
      const result = normalizeTag(longTag);
      expect(result).toBe('a'.repeat(100));
    });

    it('should handle tags with numbers', () => {
      expect(normalizeTag('Product123')).toBe('product123');
      expect(normalizeTag('Item-456')).toBe('item-456');
    });

    it('should handle unicode characters', () => {
      expect(normalizeTag('Café')).toBe('café');
      expect(normalizeTag('Naïve')).toBe('naïve');
    });

    it('should handle special characters in the middle', () => {
      expect(normalizeTag('Turkey-Product')).toBe('turkey');
      expect(normalizeTag('Hot & Spicy')).toBe('hot & spicy'); // & is preserved
    });
  });
});
