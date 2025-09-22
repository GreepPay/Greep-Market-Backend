import { Rider, IRider } from '../models/Rider';
import { logger } from '../utils/logger';

export interface CreateRiderData {
  name: string;
  phone: string;
  email?: string;
  store_id: string;
}

export interface UpdateRiderData {
  name?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
  current_balance?: number;
  total_delivered?: number;
  total_reconciled?: number;
  pending_reconciliation?: number;
}

export interface RiderResponse {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  is_active: boolean;
  current_balance: number;
  total_delivered: number;
  total_reconciled: number;
  pending_reconciliation: number;
  store_id: string;
  created_at: Date;
  updated_at: Date;
}

export class RiderService {
  /**
   * Get all riders for a store
   */
  static async getRiders(storeId?: string): Promise<RiderResponse[]> {
    try {
      const filter = storeId ? { store_id: storeId } : {};
      const riders = await Rider.find(filter).sort({ created_at: -1 });
      
      return riders.map(rider => ({
        _id: rider._id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        is_active: rider.is_active,
        current_balance: rider.current_balance,
        total_delivered: rider.total_delivered,
        total_reconciled: rider.total_reconciled,
        pending_reconciliation: rider.pending_reconciliation,
        store_id: rider.store_id,
        created_at: rider.created_at,
        updated_at: rider.updated_at,
      }));
    } catch (error) {
      logger.error('Error getting riders:', error);
      throw error;
    }
  }

  /**
   * Get rider by ID
   */
  static async getRiderById(riderId: string): Promise<RiderResponse | null> {
    try {
      const rider = await Rider.findById(riderId);
      if (!rider) {
        return null;
      }

      return {
        _id: rider._id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        is_active: rider.is_active,
        current_balance: rider.current_balance,
        total_delivered: rider.total_delivered,
        total_reconciled: rider.total_reconciled,
        pending_reconciliation: rider.pending_reconciliation,
        store_id: rider.store_id,
        created_at: rider.created_at,
        updated_at: rider.updated_at,
      };
    } catch (error) {
      logger.error('Error getting rider by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new rider
   */
  static async createRider(riderData: CreateRiderData): Promise<RiderResponse> {
    try {
      // Check if phone already exists for this store
      const existingRider = await Rider.findOne({
        phone: riderData.phone,
        store_id: riderData.store_id,
      });

      if (existingRider) {
        throw new Error('Rider with this phone number already exists for this store');
      }

      const rider = new Rider(riderData);
      await rider.save();

      return {
        _id: rider._id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        is_active: rider.is_active,
        current_balance: rider.current_balance,
        total_delivered: rider.total_delivered,
        total_reconciled: rider.total_reconciled,
        pending_reconciliation: rider.pending_reconciliation,
        store_id: rider.store_id,
        created_at: rider.created_at,
        updated_at: rider.updated_at,
      };
    } catch (error) {
      logger.error('Error creating rider:', error);
      throw error;
    }
  }

  /**
   * Update rider
   */
  static async updateRider(riderId: string, updateData: UpdateRiderData): Promise<RiderResponse | null> {
    try {
      // If phone is being updated, check for duplicates
      if (updateData.phone) {
        const rider = await Rider.findById(riderId);
        if (!rider) {
          return null;
        }

        const existingRider = await Rider.findOne({
          phone: updateData.phone,
          store_id: rider.store_id,
          _id: { $ne: riderId },
        });

        if (existingRider) {
          throw new Error('Rider with this phone number already exists for this store');
        }
      }

      const rider = await Rider.findByIdAndUpdate(
        riderId,
        { ...updateData, updated_at: new Date() },
        { new: true, runValidators: true }
      );

      if (!rider) {
        return null;
      }

      return {
        _id: rider._id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        is_active: rider.is_active,
        current_balance: rider.current_balance,
        total_delivered: rider.total_delivered,
        total_reconciled: rider.total_reconciled,
        pending_reconciliation: rider.pending_reconciliation,
        store_id: rider.store_id,
        created_at: rider.created_at,
        updated_at: rider.updated_at,
      };
    } catch (error) {
      logger.error('Error updating rider:', error);
      throw error;
    }
  }

  /**
   * Delete rider
   */
  static async deleteRider(riderId: string): Promise<boolean> {
    try {
      const result = await Rider.findByIdAndDelete(riderId);
      return result !== null;
    } catch (error) {
      logger.error('Error deleting rider:', error);
      throw error;
    }
  }

  /**
   * Update rider balance (for reconciliation)
   */
  static async updateRiderBalance(
    riderId: string, 
    amount: number, 
    type: 'delivery' | 'reconciliation'
  ): Promise<RiderResponse | null> {
    try {
      const rider = await Rider.findById(riderId);
      if (!rider) {
        return null;
      }

      let updateData: any = {};

      if (type === 'delivery') {
        updateData = {
          current_balance: rider.current_balance + amount,
          total_delivered: rider.total_delivered + amount,
          pending_reconciliation: rider.pending_reconciliation + amount,
        };
      } else if (type === 'reconciliation') {
        updateData = {
          current_balance: Math.max(0, rider.current_balance - amount),
          total_reconciled: rider.total_reconciled + amount,
          pending_reconciliation: Math.max(0, rider.pending_reconciliation - amount),
        };
      }

      const updatedRider = await Rider.findByIdAndUpdate(
        riderId,
        { ...updateData, updated_at: new Date() },
        { new: true, runValidators: true }
      );

      if (!updatedRider) {
        return null;
      }

      return {
        _id: updatedRider._id,
        name: updatedRider.name,
        phone: updatedRider.phone,
        email: updatedRider.email,
        is_active: updatedRider.is_active,
        current_balance: updatedRider.current_balance,
        total_delivered: updatedRider.total_delivered,
        total_reconciled: updatedRider.total_reconciled,
        pending_reconciliation: updatedRider.pending_reconciliation,
        store_id: updatedRider.store_id,
        created_at: updatedRider.created_at,
        updated_at: updatedRider.updated_at,
      };
    } catch (error) {
      logger.error('Error updating rider balance:', error);
      throw error;
    }
  }
}
