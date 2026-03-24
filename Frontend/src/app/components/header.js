"use client";
import {
  ArrowLeftIcon,
  Bars4Icon,
  HeartIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { Dropdown } from "flowbite-react";
import {
  HiHeart,
  HiLogout,
  HiShoppingCart,
  HiViewGrid,
  HiReceiptRefund,
  HiCurrencyRupee,
  HiChartPie,
} from "react-icons/hi";
import { motion as m } from "framer-motion";
import { useState } from "react";


export default function Header({
  page,
  onClickOrder,
  onClickFavorite,
  onClickCart,
  totalPrice,
  allMenuItems = [],
  setCurrentPage,
  searchText,
  setSearchText,
}) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);

  const buttonMenu = [
    {
      icon: <HeartIcon />,
      function: onClickFavorite,
      label: "Favorites",
    },
    {
      icon: (
        <>
          <ShoppingCartIcon />
          {totalPrice !== 0 && (
            <p className="absolute -mt-6 ml-5 w-2.5 h-2.5 border border-cream bg-red-600 rounded-full"></p>
          )}
        </>
      ),
      function: onClickCart,
      label: "Cart",
    },
    {
      icon: <MagnifyingGlassIcon />,
      function: () => setShowSearch((prev) => !prev),
      label: "Search",
    },
  ];

const buttonDropdown = [
  { name: "Dashboard", icon: HiChartPie, function: () => router.push("/dashboard") },
  { name: "Order", icon: HiViewGrid, function: onClickOrder },
  { name: "View Receipts", icon: HiReceiptRefund, function: () => router.push("/viewreceipts") },
  { name: "Add Product", icon: HiViewGrid, function: () => setCurrentPage(3) },
  { name: "Sales Summary", icon: HiCurrencyRupee, function: () => setCurrentPage(4) },

  {
    name: "Daily Report",
    icon: HiCurrencyRupee,
    function: () => setCurrentPage(5),
  },

  {
    name: "Daily Expense Tracker",
    icon: HiCurrencyRupee,
    function: () => setCurrentPage(6),
  },

  { name: "Divider", icon: "", function: "" },

  {
    name: "Logout",
    icon: HiLogout,
    function: () => {
      localStorage.removeItem("token");
      localStorage.removeItem("isAdmin");
      localStorage.removeItem("adminLoginTime");
      router.replace("/");
    },
  },
];

  return (
    <>
{showSearch && (
  <div className="fixed top-[52px] z-50 w-full left-0 right-0 bg-white shadow-md p-2 sm:p-3 animate-slide-down">
<label htmlFor="header-search" className="sr-only">Search menu items</label>
<input
  id="header-search"
  type="text"
  placeholder="Search items..."
  value={searchText}
  onChange={(e) => setSearchText(e.target.value)}
  aria-label="Search menu items"
  className="w-full p-2 sm:p-3 h-10 sm:h-12 border border-gray-200 rounded-lg text-sm sm:text-base text-coffee-dark bg-white focus:ring-2 focus:ring-accent focus:outline-none"
/>

{searchText.length > 0 && allMenuItems.length > 0 && (
  <ul className="max-h-48 overflow-y-auto mt-2 bg-white z-50 relative shadow-md rounded-lg border border-tan" role="listbox" aria-label="Search results">
    {allMenuItems
      .filter((item) =>
        item.name.toLowerCase().includes(searchText.toLowerCase())
      )
      .map((item) => (
        <li
          key={item.id}
          role="option"
          aria-selected={false}
          className="p-3 min-h-[44px] border-b border-tan cursor-pointer hover:bg-tan text-sm text-coffee-dark flex items-center"
          onClick={() => {
            setSearchText(item.name);
            setShowSearch(false);
          }}
        >
          {item.name}
        </li>
      ))}
  </ul>
)}

  </div>
)}


      <div className="z-50 top-0 fixed w-full left-0 right-0 h-[52px] sm:h-[56px] md:h-[60px] grid grid-cols-[auto_1fr_auto] px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3 items-center text-coffee-dark text-base sm:text-lg font-semibold bg-white shadow-sm border-b border-gray-100" role="banner">
        <div className="flex items-center overflow-hidden">
          {page === "Order" ? (
            <Dropdown
              placement="bottom"
              renderTrigger={() => (
                <m.span
                  initial={{ y: "100%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.3, ease: "easeIn" }}
                  className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center cursor-pointer"
                >
                  <Bars4Icon className="h-[22px] w-[22px] sm:h-[26px] sm:w-[26px] fill-coffee transition-all" aria-label="Open menu" />
                </m.span>
              )}
            >
              {buttonDropdown.map((data, idx) => {
                if (data.name !== "Divider") {
                  return (
                    <Dropdown.Item
                      key={idx}
                      icon={data.icon}
                      as="button"
                      onClick={data.function}
                    >
                      {data.name}
                    </Dropdown.Item>
                  );
                } else {
                  return <Dropdown.Divider key={idx} />;
                }
              })}
            </Dropdown>
          ) : (
            <m.button
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 0.3, ease: "easeIn" }}
              onClick={onClickOrder}
              className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
              aria-label="Go back to orders"
            >
              <ArrowLeftIcon className="h-[22px] w-[22px] sm:h-[26px] sm:w-[26px] fill-coffee transition-all" />
            </m.button>
          )}
        </div>
        <button
          className="flex justify-center items-center font-bold font-display text-coffee text-sm sm:text-base md:text-lg truncate px-1"
          aria-label={`Scroll to top of ${page}`}
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          {page}
        </button>
        <div className="flex justify-end items-center space-x-1 sm:space-x-2 md:space-x-4">
          {buttonMenu.map((data, idx) => (
            <button
              key={idx}
              onClick={data.function}
              className="min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center btn-press text-coffee"
              aria-label={data.label}
            >
              <span className="h-[20px] w-[20px] sm:h-[22px] sm:w-[22px]">{data.icon}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
