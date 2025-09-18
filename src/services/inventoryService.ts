import { Product } from '../models/Product';

export interface InventoryAlert {
  _id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  min_stock_level: number;
  alert_type: 'low_stock' | 'out_of_stock';
  store_id: string;
  created_at: Date;
}

export interface LowStockItem {
  product_id: string;
  product_name: string;
  current_stock: number;
  min_stock_level: number;
  category: string;
  price: number;
  alert_type: 'low_stock' | 'out_of_stock';
}

export class InventoryService {
  /**
   * Get low stock items
   */
  static async getLowStockItems(storeId?: string): Promise<LowStockItem[]> {
    try {
      const filter = storeId ? { store_id: storeId } : {};
      
      const lowStockProducts = await Product.find({
        ...filter,
        $expr: {
          $lte: ['$stock_quantity', '$min_stock_level']
        }
      }).sort({ stock_quantity: 1 });

      return lowStockProducts.map(product => ({
        product_id: product._id.toString(),
        product_name: product.name,
        current_stock: product.stock_quantity,
        min_stock_level: product.min_stock_level,
        category: product.category,
        price: product.price,
        alert_type: product.stock_quantity === 0 ? 'out_of_stock' : 'low_stock'
      }));
    } catch (error) {
      console.error('Error getting low stock items:', error);
      throw error;
    }
  }

  /**
   * Get out of stock items
   */
  static async getOutOfStockItems(storeId?: string): Promise<LowStockItem[]> {
    try {
      const filter = storeId ? { store_id: storeId } : {};
      
      const outOfStockProducts = await Product.find({
        ...filter,
        stock_quantity: 0
      }).sort({ name: 1 });

      return outOfStockProducts.map(product => ({
        product_id: product._id.toString(),
        product_name: product.name,
        current_stock: product.stock_quantity,
        min_stock_level: product.min_stock_level,
        category: product.category,
        price: product.price,
        alert_type: 'out_of_stock' as const
      }));
    } catch (error) {
      console.error('Error getting out of stock items:', error);
      throw error;
    }
  }

  /**
   * Get inventory alerts
   */
  static async getInventoryAlerts(storeId?: string): Promise<InventoryAlert[]> {
    try {
      const lowStockItems = await this.getLowStockItems(storeId);
      
      return lowStockItems.map(item => ({
        _id: item.product_id,
        product_id: item.product_id,
        product_name: item.product_name,
        current_quantity: item.current_stock,
        min_stock_level: item.min_stock_level,
        alert_type: item.alert_type,
        store_id: storeId || '',
        created_at: new Date()
      }));
    } catch (error) {
      console.error('Error getting inventory alerts:', error);
      throw error;
    }
  }

  /**
   * Update product stock
   */
  static async updateProductStock(productId: string, newStock: number): Promise<void> {
    try {
      await Product.findByIdAndUpdate(productId, {
        stock_quantity: newStock,
        updated_at: new Date()
      });
    } catch (error) {
      console.error('Error updating product stock:', error);
      throw error;
    }
  }

  /**
   * Get inventory summary
   */
  static async getInventorySummary(storeId?: string): Promise<{
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalInventoryValue: number;
  }> {
    try {
      const filter = storeId ? { store_id: storeId } : {};
      
      const [
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        allProducts
      ] = await Promise.all([
        Product.countDocuments(filter),
        Product.countDocuments({
          ...filter,
          $expr: {
            $and: [
              { $lte: ['$stock_quantity', '$min_stock_level'] },
              { $gt: ['$stock_quantity', 0] }
            ]
          }
        }),
        Product.countDocuments({ ...filter, stock_quantity: 0 }),
        Product.find(filter)
      ]);

      const totalInventoryValue = allProducts.reduce((sum, product) => {
        return sum + (product.price * product.stock_quantity);
      }, 0);

      return {
        totalProducts,
        lowStockItems: lowStockProducts,
        outOfStockItems: outOfStockProducts,
        totalInventoryValue
      };
    } catch (error) {
      console.error('Error getting inventory summary:', error);
      throw error;
    }
  }
}
