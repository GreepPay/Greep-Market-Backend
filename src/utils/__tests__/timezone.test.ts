import { 
  parseDateRange, 
  getTodayRange, 
  getThisMonthRange, 
  getLastNDaysRange,
  getStoreTimezone,
  debugTimezoneInfo
} from '../timezone';

describe('Timezone Utils', () => {
  const mockTimezone = 'Europe/Istanbul'; // GMT+3

  beforeEach(() => {
    // Mock console.log to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseDateRange', () => {
    it('should parse date range correctly for GMT+3 timezone', () => {
      const result = parseDateRange('2025-09-28', '2025-09-28', mockTimezone);
      
      expect(result).not.toBeNull();
      expect(result!.start).toEqual(new Date(2025, 8, 28, 0, 0, 0, 0)); // September 28, 2025 00:00:00
      expect(result!.end).toEqual(new Date(2025, 8, 28, 23, 59, 59, 999)); // September 28, 2025 23:59:59
    });

    it('should handle multi-day ranges correctly', () => {
      const result = parseDateRange('2025-09-27', '2025-09-28', mockTimezone);
      
      expect(result).not.toBeNull();
      expect(result!.start).toEqual(new Date(2025, 8, 27, 0, 0, 0, 0)); // September 27, 2025 00:00:00
      expect(result!.end).toEqual(new Date(2025, 8, 28, 23, 59, 59, 999)); // September 28, 2025 23:59:59
    });

    it('should return null for invalid date strings', () => {
      const result = parseDateRange('invalid-date', '2025-09-28', mockTimezone);
      expect(result).toBeNull();
    });

    it('should return null for missing parameters', () => {
      const result = parseDateRange(undefined, '2025-09-28', mockTimezone);
      expect(result).toBeNull();
    });
  });

  describe('getTodayRange', () => {
    it('should return today\'s range correctly', () => {
      const now = new Date();
      const result = getTodayRange(mockTimezone);
      
      expect(result.start).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
      expect(result.end).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
    });
  });

  describe('getThisMonthRange', () => {
    it('should return current month\'s range correctly', () => {
      const now = new Date();
      const result = getThisMonthRange(mockTimezone);
      
      expect(result.start).toEqual(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      expect(result.end).toEqual(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    });
  });

  describe('getLastNDaysRange', () => {
    it('should return last 7 days range correctly', () => {
      const result = getLastNDaysRange(7, mockTimezone);
      
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      
      expect(result.start).toEqual(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0));
      expect(result.end).toEqual(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999));
    });

    it('should return last 30 days range correctly', () => {
      const result = getLastNDaysRange(30, mockTimezone);
      
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      
      expect(result.start).toEqual(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0));
      expect(result.end).toEqual(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999));
    });
  });

  describe('getStoreTimezone', () => {
    it('should return default timezone when no store ID provided', () => {
      const result = getStoreTimezone();
      expect(result).toBe('Europe/Istanbul');
    });

    it('should return default timezone for any store ID', () => {
      const result = getStoreTimezone('test-store-id');
      expect(result).toBe('Europe/Istanbul');
    });
  });

  describe('debugTimezoneInfo', () => {
    it('should not throw errors when called with valid parameters', () => {
      expect(() => {
        debugTimezoneInfo('2025-09-28', mockTimezone);
      }).not.toThrow();
    });

    it('should not throw errors when called without date string', () => {
      expect(() => {
        debugTimezoneInfo(undefined, mockTimezone);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year dates correctly', () => {
      const result = parseDateRange('2024-02-29', '2024-02-29', mockTimezone);
      
      expect(result).not.toBeNull();
      expect(result!.start).toEqual(new Date(2024, 1, 29, 0, 0, 0, 0)); // February 29, 2024 00:00:00
      expect(result!.end).toEqual(new Date(2024, 1, 29, 23, 59, 59, 999)); // February 29, 2024 23:59:59
    });

    it('should handle month boundaries correctly', () => {
      const result = parseDateRange('2025-01-31', '2025-02-01', mockTimezone);
      
      expect(result).not.toBeNull();
      expect(result!.start).toEqual(new Date(2025, 0, 31, 0, 0, 0, 0)); // January 31, 2025 00:00:00
      expect(result!.end).toEqual(new Date(2025, 1, 1, 23, 59, 59, 999)); // February 1, 2025 23:59:59
    });

    it('should handle year boundaries correctly', () => {
      const result = parseDateRange('2024-12-31', '2025-01-01', mockTimezone);
      
      expect(result).not.toBeNull();
      expect(result!.start).toEqual(new Date(2024, 11, 31, 0, 0, 0, 0)); // December 31, 2024 00:00:00
      expect(result!.end).toEqual(new Date(2025, 0, 1, 23, 59, 59, 999)); // January 1, 2025 23:59:59
    });
  });
});

describe('Timezone Fix Integration Test', () => {
  it('should solve the 1:33 AM timezone boundary issue', () => {
    // Simulate the scenario: User is at 1:33 AM on September 28, 2025 (GMT+3)
    // Frontend sends: startDate: "2025-09-28", endDate: "2025-09-28"
    // Backend should interpret this as the full day September 28 in GMT+3
    
    const startDate = '2025-09-28';
    const endDate = '2025-09-28';
    const timezone = 'Europe/Istanbul';
    
    const result = parseDateRange(startDate, endDate, timezone);
    
    expect(result).not.toBeNull();
    
    // The result should cover the entire day of September 28, 2025 in GMT+3
    expect(result!.start).toEqual(new Date(2025, 8, 28, 0, 0, 0, 0)); // 2025-09-28 00:00:00 GMT+3
    expect(result!.end).toEqual(new Date(2025, 8, 28, 23, 59, 59, 999)); // 2025-09-28 23:59:59 GMT+3
    
    // This means that at 1:33 AM on September 28, the user will see data from September 28
    // instead of September 27 (which was the bug)
    
    // Verify that the range covers the problematic time
    const problemTime = new Date(2025, 8, 28, 1, 33, 0, 0); // 1:33 AM on September 28
    expect(problemTime >= result!.start && problemTime <= result!.end).toBe(true);
  });
});
