"use client";

import { useEffect, useRef, useState } from "react";
import {
  HiShoppingCart,
  HiViewGrid,
  HiReceiptRefund,
  HiCurrencyRupee,
  HiChartPie,
  HiDocumentReport,
  HiCash,
  HiLogout,
  HiX,
  HiCog,
  HiFire,
  HiViewBoards,
  HiClock,
  HiChartBar,
  HiArchive,
  HiBookOpen,
} from "react-icons/hi";
import { BiSolidCoffeeBean } from "react-icons/bi";

// roles: owner/admin = all, manager = most, cashier = order+receipts, kitchen = kitchen only
const navItems = [
  { id: 0, label: "New Order", icon: HiShoppingCart, section: "main", roles: ["owner","admin","manager","cashier","staff"] },
  { id: "dashboard", label: "Dashboard", icon: HiChartPie, section: "main", roles: ["owner","admin","manager"] },
  { id: "receipts", label: "Receipts", icon: HiReceiptRefund, section: "main", roles: ["owner","admin","manager","cashier","staff"] },
  { id: "kitchen", label: "Kitchen", icon: HiFire, section: "main", roles: ["owner","admin","manager","kitchen","staff"] },
  { id: 3, label: "Products", icon: HiViewGrid, section: "manage", roles: ["owner","admin","manager"] },
  { id: 4, label: "Sales Summary", icon: HiCurrencyRupee, section: "manage", roles: ["owner","admin","manager"] },
  { id: 5, label: "Daily Report", icon: HiDocumentReport, section: "manage", roles: ["owner","admin","manager"] },
  { id: 6, label: "Expenses", icon: HiCash, section: "manage", roles: ["owner","admin","manager"] },
  { id: "cashbook", label: "Cash Book", icon: HiBookOpen, section: "manage", roles: ["owner","admin","manager","cashier"] },
  { id: "reports", label: "Reports", icon: HiChartBar, section: "manage", roles: ["owner","admin","manager"] },
  { id: "inventory", label: "Inventory", icon: HiArchive, section: "manage", roles: ["owner","admin","manager"] },
  { id: "tables", label: "Tables", icon: HiViewBoards, section: "manage", roles: ["owner","admin","manager","cashier","staff"] },
  { id: "shifts", label: "Shifts", icon: HiClock, section: "manage", roles: ["owner","admin","manager","cashier","staff"] },
  { id: "settings", label: "Settings", icon: HiCog, section: "manage", roles: ["owner","admin"] },
];

export default function Sidebar({ isOpen, onClose, currentPage, setCurrentPage, onLogout, userRole }) {
  const sidebarRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop breakpoint
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Close on Escape (mobile only)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && isOpen && !isDesktop) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, isDesktop]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (isOpen && !isDesktop) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, isDesktop]);

  const handleNavClick = (id) => {
    setCurrentPage(id);
    if (!isDesktop) onClose();
  };

  const role = userRole || "cashier";
  const mainItems = navItems.filter((n) => n.section === "main" && n.roles.includes(role));
  const manageItems = navItems.filter((n) => n.section === "manage" && n.roles.includes(role));

  // Desktop: always render sidebar visible
  // Mobile/Tablet: overlay with backdrop blur
  const sidebarVisible = isDesktop || isOpen;

  return (
    <>
      {/* Backdrop overlay - only on mobile/tablet when open */}
      {isOpen && !isDesktop && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: isDesktop ? "sticky" : "fixed",
          top: 0,
          left: 0,
          height: isDesktop ? "100dvh" : "100%",
          width: isDesktop ? "260px" : "280px",
          zIndex: isDesktop ? 20 : 50,
          transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          flexShrink: 0,
        }}
        className="flex flex-col bg-coffee-dark text-cream shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center">
              <BiSolidCoffeeBean className="w-5 h-5 text-coffee-dark" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-tight">Karupatti</h1>
              <p className="text-[10px] text-cream/50 font-body">Coffee POS · <span className="text-accent uppercase">{role}</span></p>
            </div>
          </div>
          {/* Close button - only mobile */}
          {!isDesktop && (
            <button
              onClick={onClose}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close sidebar"
            >
              <HiX className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 no-scrollbar">
          {/* Main Section */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-cream/30 px-3 mb-1.5">
              Main
            </p>
            <ul className="space-y-0.5">
              {mainItems.map((item) => {
                const isActive = currentPage === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavClick(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                        transition-all duration-150
                        ${isActive
                          ? "bg-accent text-coffee-dark shadow-sm"
                          : "text-cream/70 hover:bg-white/8 hover:text-cream"
                        }
                      `}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-coffee-dark" : ""}`} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Manage Section */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-cream/30 px-3 mb-1.5">
              Manage
            </p>
            <ul className="space-y-0.5">
              {manageItems.map((item) => {
                const isActive = currentPage === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavClick(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                        transition-all duration-150
                        ${isActive
                          ? "bg-accent text-coffee-dark shadow-sm"
                          : "text-cream/70 hover:bg-white/8 hover:text-cream"
                        }
                      `}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-coffee-dark" : ""}`} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-white/10">
          <button
            onClick={() => {
              onLogout();
              if (!isDesktop) onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all duration-150"
          >
            <HiLogout className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Logout</span>
          </button>
          <p className="text-[10px] text-cream/30 text-center py-2">Developed by EndlessScript &copy; 2026</p>
        </div>
      </aside>
    </>
  );
}
