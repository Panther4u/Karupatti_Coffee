"use client";

import { CartProvider } from "@/app/hooks/useCart";
import OfflineBanner from "@/app/components/OfflineBanner";

export default function Providers({ children }) {
  return (
    <CartProvider>
      <OfflineBanner />
      {children}
    </CartProvider>
  );
}
