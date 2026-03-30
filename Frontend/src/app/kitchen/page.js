"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { kotAPI, authAPI } from "@/app/lib/api";
import { getSocket } from "@/app/lib/socket";
import { HiArrowLeft, HiRefresh, HiClock, HiExclamation } from "react-icons/hi";
import { offlineAuthCheck } from "@/app/lib/authUtils";

export default function KitchenDisplay() {
  const router = useRouter();
  const [kots, setKots] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const socketRef = useRef(null);
  const audioRef = useRef(null);

  // Auth check (offline-safe)
  useEffect(() => {
    offlineAuthCheck(authAPI, router).then((user) => { if (user) setIsVerified(true); });
  }, [router]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch KOTs
  const fetchKots = useCallback(async () => {
    try {
      setLoading(true);
      const data = await kotAPI.getActive();
      setKots(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error("Fetch KOTs failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVerified) fetchKots();
  }, [isVerified, fetchKots]);

  // Socket.io
  useEffect(() => {
    if (!isVerified) return;
    socketRef.current = getSocket();
    if (!socketRef.current) return;

    const onNew = (data) => {
      setKots((prev) => [data, ...prev]);
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
    };
    const onUpdate = (data) => { setKots((prev) => prev.map((k) => k._id === data._id ? data : k)); };
    const onComplete = (data) => { setKots((prev) => prev.filter((k) => k._id !== data._id)); };

    socketRef.current.on("new-kot", onNew);
    socketRef.current.on("kot-updated", onUpdate);
    socketRef.current.on("kot-completed", onComplete);

    return () => {
      if (socketRef.current) {
        socketRef.current.off("new-kot", onNew);
        socketRef.current.off("kot-updated", onUpdate);
        socketRef.current.off("kot-completed", onComplete);
      }
    };
  }, [isVerified]);

  const updateStatus = async (id, status) => {
    try {
      await kotAPI.updateStatus(id, { status });
      if (status === "completed" || status === "served") {
        setKots((prev) => prev.filter((k) => k._id !== id));
      } else {
        setKots((prev) => prev.map((k) => k._id === id ? { ...k, status } : k));
      }
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const elapsed = (createdAt) => {
    const mins = Math.floor((currentTime - new Date(createdAt)) / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const timerColor = (createdAt) => {
    const mins = Math.floor((currentTime - new Date(createdAt)) / 60000);
    if (mins >= 15) return "bg-red-100 text-red-700";
    if (mins >= 8) return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  };

  const kotTypeStyle = (type) => {
    switch (type) {
      case "repeat": return "border-l-yellow-400";
      case "modified": return "border-l-orange-400";
      case "cancelled": return "border-l-red-500";
      default: return "border-l-blue-400";
    }
  };

  const pending = kots.filter((k) => k.status === "pending");
  const preparing = kots.filter((k) => k.status === "in-progress");
  const ready = kots.filter((k) => k.status === "completed");

  const clock = currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  if (!isVerified) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-10 h-10 border-4 border-coffee border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <audio ref={audioRef} src="/notification.mp3" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-coffee-dark text-cream px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => router.push("/pages/order")} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition flex-shrink-0">
            <HiArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-lg lg:text-xl font-display truncate">KITCHEN DISPLAY</h1>
            <p className="text-[9px] sm:text-[10px] text-cream/60 hidden sm:block">Karupatti Coffee</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <button onClick={fetchKots} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition" aria-label="Refresh">
            <HiRefresh className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="text-sm sm:text-lg lg:text-xl font-mono font-bold tracking-wide">{clock}</div>
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex border-b border-gray-200 bg-white px-3 sm:px-5 py-2 gap-3 sm:gap-6 text-xs sm:text-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 flex-shrink-0"><span className="w-3 h-3 rounded-full bg-red-400" /><span className="font-semibold text-gray-700">Pending: {pending.length}</span></div>
        <div className="flex items-center gap-1.5 flex-shrink-0"><span className="w-3 h-3 rounded-full bg-yellow-400" /><span className="font-semibold text-gray-700">Preparing: {preparing.length}</span></div>
        <div className="flex items-center gap-1.5 flex-shrink-0"><span className="w-3 h-3 rounded-full bg-green-400" /><span className="font-semibold text-gray-700">Ready: {ready.length}</span></div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto"><span className="font-semibold text-gray-500">Total: {kots.length}</span></div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-coffee border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        /* 3-Column Kanban — scrollable on mobile */
        <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 p-2 sm:p-3 lg:p-4 overflow-x-auto no-scrollbar">

          {/* PENDING */}
          <KanbanColumn title="Pending" count={pending.length} borderColor="border-red-400" bgColor="bg-red-50" icon="🔴">
            {pending.length === 0 ? <EmptyState text="All caught up!" /> : pending.map((kot) => (
              <KotCard key={kot._id} kot={kot} elapsed={elapsed} timerColor={timerColor} typeStyle={kotTypeStyle}>
                <button onClick={() => updateStatus(kot._id, "in-progress")}
                  className="w-full py-2.5 sm:py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide transition btn-press">
                  START PREPARING
                </button>
              </KotCard>
            ))}
          </KanbanColumn>

          {/* PREPARING */}
          <KanbanColumn title="Preparing" count={preparing.length} borderColor="border-yellow-400" bgColor="bg-yellow-50" icon="🟡">
            {preparing.length === 0 ? <EmptyState text="Nothing cooking" /> : preparing.map((kot) => (
              <KotCard key={kot._id} kot={kot} elapsed={elapsed} timerColor={timerColor} typeStyle={kotTypeStyle}>
                <button onClick={() => updateStatus(kot._id, "completed")}
                  className="w-full py-2.5 sm:py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide transition btn-press">
                  MARK READY
                </button>
              </KotCard>
            ))}
          </KanbanColumn>

          {/* READY */}
          <KanbanColumn title="Ready" count={ready.length} borderColor="border-green-400" bgColor="bg-green-50" icon="🟢">
            {ready.length === 0 ? <EmptyState text="No ready orders" /> : ready.map((kot) => (
              <KotCard key={kot._id} kot={kot} elapsed={elapsed} timerColor={timerColor} typeStyle={kotTypeStyle}>
                <button onClick={() => updateStatus(kot._id, "served")}
                  className="w-full py-2.5 sm:py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide transition btn-press">
                  SERVED / DONE
                </button>
              </KotCard>
            ))}
          </KanbanColumn>
        </div>
      )}
    </div>
  );
}

// ===== Kanban Column =====
function KanbanColumn({ title, count, borderColor, bgColor, icon, children }) {
  return (
    <div className={`flex-1 min-w-[280px] sm:min-w-[300px] lg:min-w-0 ${bgColor} rounded-xl border-t-4 ${borderColor} flex flex-col`}>
      <div className="px-3 sm:px-4 pt-3 pb-2 flex items-center justify-between">
        <h2 className="font-bold text-sm sm:text-base lg:text-lg text-gray-800 uppercase tracking-wide">
          {icon} {title}
        </h2>
        <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${count > 0 ? "bg-gray-800 text-white" : "bg-gray-300 text-gray-600"} flex items-center justify-center text-xs sm:text-sm font-bold`}>
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-3 space-y-2 sm:space-y-2.5 no-scrollbar">
        {children}
      </div>
    </div>
  );
}

// ===== KOT Card =====
function KotCard({ kot, elapsed, timerColor, typeStyle, children }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${typeStyle(kot.kotType || "new")} overflow-hidden`}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm sm:text-base text-gray-800 font-mono">#{kot.kotNumber}</span>
          {kot.tableNo && <span className="text-[10px] sm:text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">T-{kot.tableNo}</span>}
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold font-mono ${timerColor(kot.createdAt)}`}>
          <HiClock className="w-3 h-3" />
          {elapsed(kot.createdAt)}
        </div>
      </div>

      {/* Type badges */}
      {(kot.kotType === "repeat" || kot.kotType === "modified" || kot.kotType === "cancelled") && (
        <div className="px-3 pt-1.5 flex gap-1 flex-wrap">
          {kot.kotType === "repeat" && <span className="text-[9px] sm:text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase">Repeat</span>}
          {kot.kotType === "modified" && <span className="text-[9px] sm:text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold uppercase">Modified</span>}
          {kot.kotType === "cancelled" && <span className="text-[9px] sm:text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">Cancelled</span>}
        </div>
      )}

      {/* Items */}
      <div className="px-3 py-2">
        {kot.items && kot.items.length > 0 ? (
          <ul className="space-y-1">
            {kot.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-sm sm:text-base text-gray-800 w-6 text-right flex-shrink-0">{item.qty || item.quantity || 1}x</span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm sm:text-base text-gray-800 block">{item.name}</span>
                  {item.notes && (
                    <span className="text-[10px] sm:text-xs text-red-600 italic flex items-center gap-0.5">
                      <HiExclamation className="w-3 h-3 flex-shrink-0" />{item.notes}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">No items</p>
        )}
      </div>

      {/* Action */}
      <div className="px-3 pb-3">
        {children}
      </div>
    </div>
  );
}

// ===== Empty State =====
function EmptyState({ text }) {
  return (
    <div className="flex items-center justify-center py-10 sm:py-16 text-gray-400 text-sm sm:text-base">
      {text}
    </div>
  );
}
