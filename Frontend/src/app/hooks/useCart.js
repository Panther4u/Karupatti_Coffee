"use client";

import { createContext, useContext, useReducer, useCallback, useMemo } from "react";

// Action types
const ADD_ITEM = "ADD_ITEM";
const REMOVE_ITEM = "REMOVE_ITEM";
const UPDATE_QUANTITY = "UPDATE_QUANTITY";
const UPDATE_NOTES = "UPDATE_NOTES";
const CLEAR_CART = "CLEAR_CART";

// Reducer
function cartReducer(state, action) {
  switch (action.type) {
    case ADD_ITEM: {
      const existing = state.items.find((item) => item.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === action.payload.id
              ? { ...item, amount: item.amount + 1 }
              : item
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          { ...action.payload, amount: 1, notes: action.payload.notes || "" },
        ],
      };
    }

    case REMOVE_ITEM: {
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
      };
    }

    case UPDATE_QUANTITY: {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== id),
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === id ? { ...item, amount: quantity } : item
        ),
      };
    }

    case UPDATE_NOTES: {
      const { id, notes } = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === id ? { ...item, notes } : item
        ),
      };
    }

    case CLEAR_CART: {
      return { ...state, items: [] };
    }

    default:
      return state;
  }
}

// Initial state
const initialState = {
  items: [],
};

// Context
const CartContext = createContext(null);

// Provider component
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback(
    (item) => dispatch({ type: ADD_ITEM, payload: item }),
    []
  );

  const removeItem = useCallback(
    (id) => dispatch({ type: REMOVE_ITEM, payload: id }),
    []
  );

  const updateQuantity = useCallback(
    (id, quantity) =>
      dispatch({ type: UPDATE_QUANTITY, payload: { id, quantity } }),
    []
  );

  const updateNotes = useCallback(
    (id, notes) =>
      dispatch({ type: UPDATE_NOTES, payload: { id, notes } }),
    []
  );

  const clearCart = useCallback(() => dispatch({ type: CLEAR_CART }), []);

  const getTotal = useMemo(() => {
    return state.items.reduce(
      (sum, item) => sum + item.price * item.amount,
      0
    );
  }, [state.items]);

  const getItemCount = useMemo(() => {
    return state.items.reduce((count, item) => count + item.amount, 0);
  }, [state.items]);

  const value = useMemo(
    () => ({
      items: state.items,
      addItem,
      removeItem,
      updateQuantity,
      updateNotes,
      clearCart,
      getTotal,
      getItemCount,
    }),
    [state.items, addItem, removeItem, updateQuantity, updateNotes, clearCart, getTotal, getItemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Hook
export default function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
