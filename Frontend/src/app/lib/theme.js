"use client";

export function getTheme() {
  return "light";
}

export function setTheme() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark");
  root.setAttribute("data-theme", "light");
}

export function toggleTheme() {
  return "light";
}
