import { Expense, IExpense } from '../models/Expense';

export interface CreateExpenseData {
  store_id: string;
  date: Date;
  product_name: string;
  unit: 'pieces' | 'kgs' | 'liters' | 'boxes' | 'packets' | 'other';
  quantity: number;
  amount: number;
  currency?: 'TRY' | 'USD' | 'NGN' | 'EUR';
  payment_method: 'cash' | 'isbank' | 'naira' | 'card' | 'transfer' | 'other';
  category?: 'food' | 'supplies' | 'utilities' | 'equipment' | 'maintenance' | 'other';
  description?: string;
  receipt_number?: string;
  vendor_name?: string;
  created_by: string;
}

export interface UpdateExpenseData {
  date?: Date;
  product_name?: string;
  unit?: 'pieces' | 'kgs' | 'liters' | 'boxes' | 'packets' | 'other';
  quantity?: number;
  amount?: number;
  currency?: 'TRY' | 'USD' | 'NGN' | 'EUR';
  payment_method?: 'cash' | 'isbank' | 'naira' | 'card' | 'transfer' | 'other';
  category?: 'food' | 'supplies' | 'utilities' | 'equipment' | 'maintenance' | 'other';
  description?: string;
  receipt_number?: string;
  vendor_name?: string;
}

export interface ExpenseResponse {
  _id: string;
  store_id: string;
  date: Date;
  month_year: string;
  product_name: string;
  unit: string;
  quantity: number;
  amount: number;
  currency: string;
  payment_method: string;
  category: string;
  description?: string;
  receipt_number?: string;
  vendor_name?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExpenseStats {
  totalExpenses: number;
  totalAmount: number;
  expensesByCategory: Array<{
    category: string;
    count: number;
    amount: number;
  }>;
  expensesByPaymentMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  expensesByMonth: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
  topExpenseItems: Array<{
    product_name: string;
    total_amount: number;
    count: number;
  }>;
}

export class ExpenseService {
  /**
   * Create a new expense
   */
  static async createExpense(expenseData: CreateExpenseData): Promise<ExpenseResponse> {
    try {
      // Generate month_year from the date
      const date = new Date(expenseData.date);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthYear = `${monthNames[date.getMonth()]} - ${date.getFullYear()}`;

      const expense = new Expense({
        ...expenseData,
        month_year: monthYear,
        currency: expenseData.currency || 'TRY',
        category: expenseData.category || 'other',
      });

      await expense.save();
      return this.formatExpenseResponse(expense);
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  /**
   * Get expenses with pagination and filtering
   */
  static async getExpenses(
    page: number = 1,
    limit: number = 20,
    storeId?: string,
    category?: string,
    paymentMethod?: string,
    startDate?: Date,
    endDate?: Date,
    search?: string
  ): Promise<{
    expenses: ExpenseResponse[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const query: any = {};
      
      if (storeId) {
        query.store_id = storeId;
      }
      
      if (category) {
        query.category = category;
      }
      
      if (paymentMethod) {
        query.payment_method = paymentMethod;
      }
      
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
      }
      
      if (search) {
        query.$or = [
          { product_name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { vendor_name: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;

      const [expenses, total] = await Promise.all([
        Expense.find(query)
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit),
        Expense.countDocuments(query),
      ]);

      return {
        expenses: expenses.map(e => this.formatExpenseResponse(e)),
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting expenses:', error);
      throw error;
    }
  }

  /**
   * Get expense by ID
   */
  static async getExpenseById(expenseId: string): Promise<ExpenseResponse | null> {
    try {
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        return null;
      }

      return this.formatExpenseResponse(expense);
    } catch (error) {
      console.error('Error getting expense by ID:', error);
      throw error;
    }
  }

  /**
   * Update expense
   */
  static async updateExpense(
    expenseId: string, 
    updateData: UpdateExpenseData
  ): Promise<ExpenseResponse> {
    try {
      const expense = await Expense.findByIdAndUpdate(
        expenseId,
        updateData,
        { new: true }
      );

      if (!expense) {
        throw new Error('Expense not found');
      }

      return this.formatExpenseResponse(expense);
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  /**
   * Delete expense
   */
  static async deleteExpense(expenseId: string): Promise<void> {
    try {
      const expense = await Expense.findByIdAndDelete(expenseId);
      if (!expense) {
        throw new Error('Expense not found');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  /**
   * Get expense statistics
   */
  static async getExpenseStats(
    storeId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ExpenseStats> {
    try {
      const filter: any = {};
      
      if (storeId) {
        filter.store_id = storeId;
      }
      
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = startDate;
        if (endDate) filter.date.$lte = endDate;
      }

      const [
        totalExpenses,
        totalAmountResult,
        categoryStats,
        paymentMethodStats,
        monthlyStats,
        topItems
      ] = await Promise.all([
        Expense.countDocuments(filter),
        Expense.aggregate([
          { $match: filter },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Expense.aggregate([
          { $match: filter },
          { $group: { 
            _id: '$category', 
            count: { $sum: 1 }, 
            amount: { $sum: '$amount' }
          }},
          { $project: { category: '$_id', count: 1, amount: 1, _id: 0 } }
        ]),
        Expense.aggregate([
          { $match: filter },
          { $group: { 
            _id: '$payment_method', 
            count: { $sum: 1 }, 
            amount: { $sum: '$amount' }
          }},
          { $project: { method: '$_id', count: 1, amount: 1, _id: 0 } }
        ]),
        Expense.aggregate([
          { $match: filter },
          { $group: { 
            _id: '$month_year', 
            count: { $sum: 1 }, 
            amount: { $sum: '$amount' }
          }},
          { $sort: { '_id': -1 } },
          { $limit: 12 },
          { $project: { month: '$_id', count: 1, amount: 1, _id: 0 } }
        ]),
        Expense.aggregate([
          { $match: filter },
          { $group: { 
            _id: '$product_name', 
            total_amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }},
          { $sort: { total_amount: -1 } },
          { $limit: 10 },
          { $project: { 
            product_name: '$_id', 
            total_amount: 1, 
            count: 1, 
            _id: 0 
          }}
        ])
      ]);

      return {
        totalExpenses,
        totalAmount: totalAmountResult[0]?.total || 0,
        expensesByCategory: categoryStats,
        expensesByPaymentMethod: paymentMethodStats,
        expensesByMonth: monthlyStats,
        topExpenseItems: topItems
      };
    } catch (error) {
      console.error('Error getting expense stats:', error);
      throw error;
    }
  }

  /**
   * Get expenses by date range
   */
  static async getExpensesByDateRange(
    startDate: Date,
    endDate: Date,
    storeId?: string
  ): Promise<ExpenseResponse[]> {
    try {
      const filter: any = {
        date: { $gte: startDate, $lte: endDate }
      };
      
      if (storeId) {
        filter.store_id = storeId;
      }

      const expenses = await Expense.find(filter).sort({ date: -1 });
      return expenses.map(e => this.formatExpenseResponse(e));
    } catch (error) {
      console.error('Error getting expenses by date range:', error);
      throw error;
    }
  }

  /**
   * Get monthly expense summary
   */
  static async getMonthlyExpenseSummary(
    year: number,
    storeId?: string
  ): Promise<Array<{
    month: string;
    total_amount: number;
    expense_count: number;
    categories: Array<{
      category: string;
      amount: number;
    }>;
  }>> {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      
      const filter: any = {
        date: { $gte: startDate, $lte: endDate }
      };
      
      if (storeId) {
        filter.store_id = storeId;
      }

      const monthlyData = await Expense.aggregate([
        { $match: filter },
        { $group: { 
          _id: { 
            month: { $month: '$date' },
            year: { $year: '$date' }
          }, 
          total_amount: { $sum: '$amount' },
          expense_count: { $sum: 1 },
          categories: { $push: { category: '$category', amount: '$amount' } }
        }},
        { $sort: { '_id.month': 1 } },
        { $project: { 
          month: { 
            $dateToString: { 
              format: '%B', 
              date: { $dateFromParts: { year: '$_id.year', month: '$_id.month', day: 1 } }
            }
          },
          total_amount: 1,
          expense_count: 1,
          categories: 1,
          _id: 0
        }}
      ]);

      // Process categories for each month
      return monthlyData.map(month => ({
        month: month.month,
        total_amount: month.total_amount,
        expense_count: month.expense_count,
        categories: month.categories.reduce((acc: any[], curr: any) => {
          const existing = acc.find(c => c.category === curr.category);
          if (existing) {
            existing.amount += curr.amount;
          } else {
            acc.push({ category: curr.category, amount: curr.amount });
          }
          return acc;
        }, [])
      }));
    } catch (error) {
      console.error('Error getting monthly expense summary:', error);
      throw error;
    }
  }

  /**
   * Format expense response
   */
  private static formatExpenseResponse(expense: IExpense): ExpenseResponse {
    return {
      _id: expense._id.toString(),
      store_id: expense.store_id,
      date: expense.date,
      month_year: expense.month_year,
      product_name: expense.product_name,
      unit: expense.unit,
      quantity: expense.quantity,
      amount: expense.amount,
      currency: expense.currency,
      payment_method: expense.payment_method,
      category: expense.category,
      description: expense.description,
      receipt_number: expense.receipt_number,
      vendor_name: expense.vendor_name,
      created_by: expense.created_by,
      created_at: expense.created_at,
      updated_at: expense.updated_at,
    };
  }
}
