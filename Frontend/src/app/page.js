"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { BiSolidShoppingBag } from "react-icons/bi";
import { HiBackspace } from "react-icons/hi";
import { authAPI } from "./lib/api";

export default function Home() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const containerRef = useRef();

  const PIN_LENGTH = 4;

  // If user already has a valid token, redirect based on role
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authAPI
        .me()
        .then((user) => {
          const role = user?.role || localStorage.getItem("userRole") || "cashier";
          navigateByRole(role);
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("isAdmin");
          localStorage.removeItem("userRole");
          localStorage.removeItem("adminLoginTime");
        });
    }
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateByRole = useCallback((role) => {
    switch (role) {
      case "admin":
      case "manager":
        router.replace("/dashboard");
        break;
      case "staff":
        router.replace("/kitchen");
        break;
      case "cashier":
      default:
        router.replace("/pages/order");
        break;
    }
  }, [router]);

  // Auto-login when PIN reaches correct length
  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      handlePinLogin(pin);
    }
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinLogin = async (passcode) => {
    setLoading(true);
    setError("");
    try {
      const data = await authAPI.loginPin(passcode);

      localStorage.setItem("token", data.token);
      localStorage.setItem("isAdmin", data.user?.role === "admin" ? "true" : "false");
      localStorage.setItem("userRole", data.user?.role || "cashier");
      localStorage.setItem("userName", data.user?.displayName || data.user?.username || "");

      setPin("");
      setError("");
      navigateByRole(data.user?.role || "cashier");
    } catch (err) {
      setError("Invalid PIN");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const addDigit = (digit) => {
    if (pin.length < PIN_LENGTH) {
      setPin((p) => p + digit);
      setError("");
    }
  };

  const removeDigit = () => {
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const clearPin = () => {
    setPin("");
    setError("");
  };

  // Physical keyboard support
  useEffect(() => {
    if (!showPad) return;
    const handler = (e) => {
      if (e.key >= "0" && e.key <= "9") { addDigit(e.key); return; }
      if (e.key === "Backspace") { removeDigit(); return; }
      if (e.key === "Escape") { clearPin(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showPad, pin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full flex justify-center bg-coffee-dark min-h-[100dvh]">
      <div className="flex flex-col justify-center min-h-[100dvh] w-full max-w-sm sm:max-w-md mx-auto content-center px-4">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/Logo.png"
            width={600}
            height={600}
            alt="coffee company logo"
            quality={100}
            unoptimized
            priority
            className="w-full max-w-[220px] sm:max-w-[320px] h-auto"
          />
        </div>

        {!showPad ? (
          /* Entry Button */
          <div className="flex flex-col items-center justify-center mt-12">
            <button
              onClick={() => setShowPad(true)}
              aria-label="Open login"
              className="p-5 bg-coffee text-coffee font-bold hover:bg-accent hover:scale-110 active:scale-110 rounded-full transition-all duration-300 min-w-[64px] min-h-[64px] btn-press"
            >
              <h1 className="bg-cream hover:text-cream hover:bg-coffee rounded-full p-2 transition-all duration-300">
                <BiSolidShoppingBag className="h-[40px] w-[40px] text-coffee-dark" aria-hidden="true" />
              </h1>
            </button>
          </div>
        ) : (
          /* PIN Pad */
          <div ref={containerRef} className="mt-8 animate-slide-up">
            {/* PIN Display */}
            <div className="flex flex-col items-center mb-6">
              <p className="text-cream/70 text-sm font-medium mb-3">Enter Passcode</p>
              <div className="flex gap-3">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${
                      i < pin.length
                        ? "bg-coffee border-coffee scale-105"
                        : "bg-white/10 border-white/20"
                    }`}
                  >
                    {i < pin.length && (
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-cream rounded-full" />
                    )}
                  </div>
                ))}
              </div>
              {error && (
                <p className="text-red-400 text-sm mt-2 font-medium animate-shake">{error}</p>
              )}
              {loading && (
                <p className="text-coffee text-sm mt-2 font-medium">Verifying...</p>
              )}
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => addDigit(String(num))}
                  disabled={loading || pin.length >= PIN_LENGTH}
                  className="h-14 sm:h-16 rounded-xl bg-white/10 hover:bg-white/20 active:bg-coffee active:scale-95 text-cream text-xl sm:text-2xl font-bold transition-all duration-150 disabled:opacity-40"
                >
                  {num}
                </button>
              ))}
              {/* Bottom row: Clear, 0, Backspace */}
              <button
                onClick={clearPin}
                disabled={loading}
                className="h-14 sm:h-16 rounded-xl bg-white/5 hover:bg-white/10 text-cream/60 text-xs font-bold transition-all"
              >
                Clear
              </button>
              <button
                onClick={() => addDigit("0")}
                disabled={loading || pin.length >= PIN_LENGTH}
                className="h-14 sm:h-16 rounded-xl bg-white/10 hover:bg-white/20 active:bg-coffee active:scale-95 text-cream text-xl sm:text-2xl font-bold transition-all duration-150 disabled:opacity-40"
              >
                0
              </button>
              <button
                onClick={removeDigit}
                disabled={loading || pin.length === 0}
                className="h-14 sm:h-16 rounded-xl bg-white/5 hover:bg-white/10 active:bg-red-500/30 text-cream/60 flex items-center justify-center transition-all disabled:opacity-30"
              >
                <HiBackspace className="w-6 h-6" />
              </button>
            </div>

            {/* Back button */}
            <div className="flex justify-center mt-4">
              <button
                onClick={() => { setShowPad(false); setPin(""); setError(""); }}
                className="text-cream/40 text-xs hover:text-cream/70 transition"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-6 text-center">&copy; 2026 EndlessScript. All rights reserved.</p>
      </div>
    </div>
  );
}
