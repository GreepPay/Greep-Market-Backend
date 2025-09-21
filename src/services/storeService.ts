import { Store, IStore } from '../models/Store';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';

export interface CreateStoreData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  currency?: string;
  timezone?: string;
  business_type?: string;
  owner_id?: string;
  subscription_plan?: string;
  subscription_expires_at?: Date;
}

export interface UpdateStoreData extends Partial<CreateStoreData> {
  is_active?: boolean;
}

export class StoreService {
  /**
   * Get store by ID
   */
  static async getStoreById(storeId: string): Promise<IStore> {
    try {
      logger.info(`Getting store by ID: ${storeId}`);
      
      // Handle special case for "default-store"
      if (storeId === 'default-store') {
        logger.info('Handling special case for default-store');
        // Return the first active store as the default store
        const defaultStore = await Store.findOne({ 
          is_active: true 
        }).sort({ created_at: 1 }); // Get the oldest store as default
        
        if (defaultStore) {
          logger.info(`Default store found: ${defaultStore.name} (${defaultStore._id})`);
          return defaultStore;
        } else {
          logger.warn('No active stores found in database');
          throw new CustomError('No stores found', 404);
        }
      }
      
      // Validate ObjectId format for regular store IDs
      if (!storeId.match(/^[0-9a-fA-F]{24}$/)) {
        logger.warn(`Invalid store ID format: ${storeId}`);
        throw new CustomError('Invalid store ID format', 400);
      }
      
      const store = await Store.findById(storeId);
      
      if (!store) {
        logger.warn(`Store not found with ID: ${storeId}`);
        throw new CustomError('Store not found', 404);
      }

      logger.info(`Store found: ${store.name} (${storeId})`);
      return store;
    } catch (error) {
      logger.error(`Error getting store by ID ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Get all stores
   */
  static async getAllStores(): Promise<IStore[]> {
    try {
      logger.info('Getting all stores');
      
      const stores = await Store.find({ is_active: true })
        .sort({ created_at: -1 });
      
      logger.info(`Found ${stores.length} stores`);
      return stores;
    } catch (error) {
      logger.error('Error getting all stores:', error);
      throw error;
    }
  }

  /**
   * Create new store
   */
  static async createStore(storeData: CreateStoreData): Promise<IStore> {
    try {
      logger.info(`Creating new store: ${storeData.name}`);
      
      // Check if store with same name already exists
      const existingStore = await Store.findOne({ 
        name: storeData.name,
        is_active: true 
      });
      
      if (existingStore) {
        logger.warn(`Store with name "${storeData.name}" already exists`);
        throw new CustomError('Store with this name already exists', 400);
      }

      const store = new Store(storeData);
      await store.save();
      
      logger.info(`Store created successfully: ${store.name} (${store._id})`);
      return store;
    } catch (error) {
      logger.error('Error creating store:', error);
      throw error;
    }
  }

  /**
   * Update store
   */
  static async updateStore(storeId: string, updateData: UpdateStoreData): Promise<IStore> {
    try {
      logger.info(`Updating store: ${storeId}`);
      
      let store;
      
      // Handle special case for "default-store"
      if (storeId === 'default-store') {
        logger.info('Handling special case for default-store update');
        store = await Store.findOne({ 
          is_active: true 
        }).sort({ created_at: 1 }); // Get the oldest store as default
        
        if (!store) {
          logger.warn('No active stores found in database');
          throw new CustomError('No stores found', 404);
        }
      } else {
        // Validate ObjectId format for regular store IDs
        if (!storeId.match(/^[0-9a-fA-F]{24}$/)) {
          logger.warn(`Invalid store ID format: ${storeId}`);
          throw new CustomError('Invalid store ID format', 400);
        }
        
        store = await Store.findById(storeId);
        
        if (!store) {
          logger.warn(`Store not found with ID: ${storeId}`);
          throw new CustomError('Store not found', 404);
        }
      }

      // Check if name is being updated and if it conflicts with existing store
      if (updateData.name && updateData.name !== store.name) {
        const existingStore = await Store.findOne({ 
          name: updateData.name,
          is_active: true,
          _id: { $ne: store._id }
        });
        
        if (existingStore) {
          logger.warn(`Store with name "${updateData.name}" already exists`);
          throw new CustomError('Store with this name already exists', 400);
        }
      }

      Object.assign(store, updateData);
      await store.save();
      
      logger.info(`Store updated successfully: ${store.name} (${storeId})`);
      return store;
    } catch (error) {
      logger.error(`Error updating store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Delete store (soft delete)
   */
  static async deleteStore(storeId: string): Promise<void> {
    try {
      logger.info(`Deleting store: ${storeId}`);
      
      // Validate ObjectId format
      if (!storeId.match(/^[0-9a-fA-F]{24}$/)) {
        logger.warn(`Invalid store ID format: ${storeId}`);
        throw new CustomError('Invalid store ID format', 400);
      }
      
      const store = await Store.findById(storeId);
      
      if (!store) {
        logger.warn(`Store not found with ID: ${storeId}`);
        throw new CustomError('Store not found', 404);
      }

      // Soft delete by setting is_active to false
      store.is_active = false;
      await store.save();
      
      logger.info(`Store deleted successfully: ${store.name} (${storeId})`);
    } catch (error) {
      logger.error(`Error deleting store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Get store statistics
   */
  static async getStoreStats(storeId: string): Promise<{
    totalProducts: number;
    totalTransactions: number;
    totalRevenue: number;
    activeUsers: number;
  }> {
    try {
      logger.info(`Getting store statistics for: ${storeId}`);
      
      // This would require importing other models and services
      // For now, return basic structure
      const stats = {
        totalProducts: 0,
        totalTransactions: 0,
        totalRevenue: 0,
        activeUsers: 0,
      };
      
      logger.info(`Store statistics retrieved for: ${storeId}`);
      return stats;
    } catch (error) {
      logger.error(`Error getting store statistics for ${storeId}:`, error);
      throw error;
    }
  }
}
