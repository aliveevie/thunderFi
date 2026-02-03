import { create } from 'zustand';
import type { Action, Order } from '@/types';
import { generateId } from '@/lib/utils';

interface ActionsState {
  actions: Action[];
  orders: Order[];
  isExecuting: boolean;

  placeOrder: (order: Omit<Order, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  clearActions: () => void;
}

export const useActionsStore = create<ActionsState>((set) => ({
  actions: [],
  orders: [],
  isExecuting: false,

  placeOrder: async (orderData) => {
    set({ isExecuting: true });

    // Simulate instant off-chain execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    const order: Order = {
      id: generateId(),
      ...orderData,
      status: 'open',
      createdAt: new Date(),
    };

    const action: Action = {
      id: generateId(),
      type: 'place_order',
      timestamp: new Date(),
      amount: orderData.amount,
      pair: orderData.pair,
      side: orderData.side,
      price: orderData.price,
      status: 'confirmed',
      fee: '0.001',
    };

    set((state) => ({
      orders: [order, ...state.orders],
      actions: [action, ...state.actions],
      isExecuting: false,
    }));
  },

  cancelOrder: async (orderId) => {
    set({ isExecuting: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const action: Action = {
      id: generateId(),
      type: 'cancel_order',
      timestamp: new Date(),
      status: 'confirmed',
      fee: '0.001',
    };

    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'cancelled' } : o
      ),
      actions: [action, ...state.actions],
      isExecuting: false,
    }));
  },

  clearActions: () => {
    set({ actions: [], orders: [] });
  },
}));
