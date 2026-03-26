"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { BiSolidShoppingBag } from "react-icons/bi";
import { HiEye, HiEyeOff } from "react-icons/hi";
import { authAPI } from "./lib/api";

export default function Home() {
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef();
  const inputRef = useRef();

  // If user already has a valid token, redirect to order page
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authAPI
        .me()
        .then(() => {
          router.replace("/pages/order");
        })
        .catch(() => {
          // Token expired or invalid — stay on login
          localStorage.removeItem("token");
          localStorage.removeItem("isAdmin");
          localStorage.removeItem("adminLoginTime");
        });
    }
  }, [router]);

  useEffect(() => {
    const handler = (e) => {
      if (!modalRef.current?.contains(e.target)) {
        setShowLoginModal(false);
        setError("");
        setPassword("");
        setUsername("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (showLoginModal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showLoginModal]);

  const handleLogin = async () => {
    if (!username.trim()) {
      setError("Username cannot be empty");
      return;
    }
    if (!password) {
      setError("Password cannot be empty");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await authAPI.login(username.trim(), password);

      // Store JWT token
      localStorage.setItem("token", data.token);
      localStorage.setItem("isAdmin", data.user?.role === "admin" ? "true" : "false");
      localStorage.setItem("userRole", data.user?.role || "cashier");

      setShowLoginModal(false);
      setPassword("");
      setUsername("");
      setError("");
      router.push("/pages/order");
    } catch (err) {
      console.error("Login failed:", err);
      if (err.message.includes("Invalid") || err.message.includes("credentials")) {
        setError("Invalid username or password");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="w-full flex justify-center bg-coffee-dark min-h-[100dvh]">
      <div
        className="flex flex-col justify-center min-h-[100dvh] w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto content-center px-4"
      >
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
            className="w-full max-w-[280px] sm:max-w-[400px] md:max-w-[500px] h-auto"
          />
        </div>

        {/* Entry Button */}
        <div className="flex flex-col items-center justify-center mt-16 sm:mt-[90px]">
          <button
            onClick={() => setShowLoginModal(true)}
            aria-label="Open login"
            className="p-5 bg-coffee text-coffee font-bold hover:bg-accent hover:scale-110 active:scale-110 rounded-full transition-all duration-300 min-w-[64px] min-h-[64px] btn-press"
          >
            <h1 className="bg-cream hover:text-cream hover:bg-coffee rounded-full p-2 transition-all duration-300">
              <BiSolidShoppingBag className="h-[40px] w-[40px] text-coffee-dark" aria-hidden="true" />
            </h1>
          </button>
        </div>

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4" role="presentation">
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-modal-title"
              className="bg-cream p-6 rounded-xl w-full max-w-sm md:max-w-md shadow-lg space-y-4 animate-slide-up"
            >
              <h2 id="login-modal-title" className="text-lg font-bold text-center text-coffee-dark font-display">Login</h2>

              {/* Username field */}
              <div>
                <label htmlFor="login-username" className="sr-only">Username</label>
                <input
                  id="login-username"
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Username"
                  autoComplete="username"
                  aria-label="Username"
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`w-full border p-3 h-12 rounded-lg text-coffee-dark bg-white focus:outline-none focus:ring-2 ${
                    error ? "border-red-500 ring-red-200" : "border-tan ring-accent"
                  }`}
                />
              </div>

              {/* Password field */}
              <div className="relative">
                <label htmlFor="login-password" className="sr-only">Password</label>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Password"
                  autoComplete="current-password"
                  aria-label="Password"
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`w-full border p-3 h-12 rounded-lg pr-12 text-coffee-dark bg-white focus:outline-none focus:ring-2 ${
                    error ? "border-red-500 ring-red-200" : "border-tan ring-accent"
                  }`}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-coffee-light min-w-[44px] min-h-[44px] justify-center"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <HiEyeOff className="w-5 h-5" aria-hidden="true" /> : <HiEye className="w-5 h-5" aria-hidden="true" />}
                </button>
              </div>

              {error && (
                <p id="login-error" className="text-red-600 text-sm text-center" role="alert">{error}</p>
              )}

              <div className="flex justify-between gap-3 mt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLogin}
                  aria-label={loading ? "Logging in, please wait" : "Submit login"}
                  className={`flex-1 px-4 py-3 min-h-[48px] font-bold rounded-lg transition-all btn-press ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-coffee text-cream hover:bg-coffee-dark"
                  }`}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setPassword("");
                    setUsername("");
                    setError("");
                  }}
                  aria-label="Cancel login"
                  className="flex-1 px-4 py-3 min-h-[48px] bg-tan hover:bg-gray-300 rounded-lg text-coffee-dark font-semibold transition-all btn-press"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
