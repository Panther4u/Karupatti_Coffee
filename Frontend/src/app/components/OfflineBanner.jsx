"use client";

import { useState, useEffect } from "react";
import { HiWifi, HiExclamation } from "react-icons/hi";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const on = () => setOnline(true);
    const off = () => setOnline(false);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-500 text-yellow-900 text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
      <HiExclamation className="w-4 h-4" />
      Offline — orders will sync when internet returns
    </div>
  );
}
