"use client";

import { useEffect, useState } from "react";
import { HiPencil, HiTrash } from "react-icons/hi";
import { expensesAPI } from "@/app/lib/api";

export default function DailyExpenseTracker({ selectedDate: initialDate }) {
  const [selectedDate, setSelectedDate] = useState(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState("out");
  const [method, setMethod] = useState("Cash");
  const [editingId, setEditingId] = useState(null);
  const isEditing = Boolean(editingId);

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    expensesAPI.getByDate(selectedDate)
      .then((data) => {
        const items = data?.expenses || (Array.isArray(data) ? data : []);
        setExpenses(items.map((e) => ({ id: e._id || e.id, ...e })));
      })
      .catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const totalIn = expenses.filter((e) => (e.type || "").toLowerCase() === "in").reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalOut = expenses.filter((e) => (e.type || "").toLowerCase() === "out").reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalIn - totalOut;

  const resetForm = () => { setCategory(""); setAmount(""); setNotes(""); setType("out"); setMethod("Cash"); setEditingId(null); };

  const fetchAgain = async () => {
    const data = await expensesAPI.getByDate(selectedDate);
    const items = data?.expenses || (Array.isArray(data) ? data : []);
    setExpenses(items.map((e) => ({ id: e._id || e.id, ...e })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !amount) return alert("Category and Amount required.");
    const payload = { category, amount: parseFloat(amount), notes, type: type.toLowerCase(), method, date: selectedDate, createdAt: new Date().toISOString() };
    try {
      const result = isEditing
        ? await expensesAPI.update(editingId, payload)
        : await expensesAPI.create(payload);
      if (result.success !== false) { resetForm(); await fetchAgain(); }
      else alert(result.message || "Error saving.");
    } catch (err) { alert(err.message || "Unexpected error."); }
  };

  const handleEdit = (exp) => { setCategory(exp.category); setAmount(exp.amount); setNotes(exp.notes || ""); setType(exp.type || "out"); setMethod(exp.method || "Cash"); setEditingId(exp.id); };

  const handleDelete = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try { await expensesAPI.delete(id); await fetchAgain(); }
    catch { alert("Delete failed."); }
  };

  const inputCls = "w-full border border-gray-200 px-3 py-2 h-9 rounded-lg text-sm text-coffee-dark bg-white focus:ring-2 focus:ring-accent focus:outline-none";

  return (
    <div className="w-full text-coffee-dark">
      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-coffee-light mb-0.5 uppercase tracking-wide">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} required>
              <option value="" disabled>-- Select --</option>
              <optgroup label="Salary">
                <option value="Salary > Dhanush">Dhanush</option>
                <option value="Salary > Manjula">Manjula</option>
                <option value="Salary > Seenu">Seenu</option>
                <option value="Salary > Vadaimaster">Vadaimaster</option>
                <option value="Salary > Janaki">Janaki</option>
                <option value="Salary > Nandhu">Nandhu</option>
                <option value="Salary > Nivi">Nivi</option>
                <option value="Salary > Ajith">Ajith</option>
                <option value="Salary > Ramesh">Ramesh</option>
                <option value="Salary > Kavin">Kavin</option>
                <option value="Salary > Kavitha">Kavitha</option>
              </optgroup>
              <optgroup label="Essentials">
                <option value="Milk">Milk</option>
                <option value="Curd">Curd</option>
                <option value="Grocery & Vegetables">Grocery & Veg</option>
                <option value="Essential Items">Essentials</option>
                <option value="Kaaraalan">Kaaraalan</option>
                <option value="Sai Agency">Sai Agency</option>
              </optgroup>
              <optgroup label="Snacks">
                <option value="Samosa">Samosa</option>
                <option value="Puffs">Puffs</option>
                <option value="Banana Cake">Banana Cake</option>
                <option value="Banana Bun">Banana Bun</option>
                <option value="Poli">Poli</option>
                <option value="Brownie">Brownie</option>
                <option value="Water">Water</option>
                <option value="Sweet & Salt Biscuit">Biscuit</option>
              </optgroup>
              <optgroup label="Shop">
                <option value="Shop Expense > Rent">Rent</option>
                <option value="Shop Expense > EB">EB</option>
                <option value="Shop Expense > Gas">Gas</option>
                <option value="Shop Expense > NKC Sweet & Savouries">NKC Sweet</option>
                <option value="Shop Expense > NKC Icecream">NKC Icecream</option>
              </optgroup>
              <optgroup label="Other">
                <option value="Wastage">Wastage</option>
                <option value="Other">Other</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-coffee-light mb-0.5 uppercase tracking-wide">Date</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-coffee-light mb-0.5 uppercase tracking-wide">Amount *</label>
            <input type="number" inputMode="decimal" placeholder="₹ 0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-coffee-light mb-0.5 uppercase tracking-wide">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="out">Out</option>
              <option value="in">In</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-coffee-light mb-0.5 uppercase tracking-wide">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option>Bank</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-coffee-light mb-0.5 uppercase tracking-wide">Notes</label>
            <input type="text" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            className={`flex-1 h-9 rounded-lg text-sm font-semibold btn-press text-cream ${isEditing ? "bg-accent hover:bg-caramel" : "bg-coffee hover:bg-coffee-dark"}`}
          >
            {isEditing ? "Update" : "Add Expense"}
          </button>
          {isEditing && (
            <button type="button" onClick={resetForm} className="px-4 h-9 rounded-lg bg-gray-100 text-coffee-dark text-sm hover:bg-gray-200">Cancel</button>
          )}
        </div>
      </form>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-xs font-medium mb-4">
        <div className="text-center p-2 rounded-lg bg-green-50 text-green-700">In: ₹{totalIn.toFixed(0)}</div>
        <div className="text-center p-2 rounded-lg bg-red-50 text-red-700">Out: ₹{totalOut.toFixed(0)}</div>
        <div className="text-center p-2 rounded-lg bg-tan text-coffee-dark font-bold">Bal: ₹{balance.toFixed(0)}</div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-coffee-light text-center text-sm py-4">Loading...</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-coffee-light text-center py-4">No expenses for this date.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {expenses.map((e) => (
            <div
              key={e.id}
              className={`p-2.5 rounded-lg border text-xs flex justify-between items-start ${
                e.type === "in" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-coffee-dark text-sm truncate">{e.category}</p>
                <p className="text-coffee-light">{e.method} | ₹{Number(e.amount).toFixed(0)}</p>
                {e.notes && <p className="text-coffee-light truncate">{e.notes}</p>}
              </div>
              <div className="flex gap-1 ml-2 flex-shrink-0">
                <button onClick={() => handleEdit(e)} className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-gray-100 text-coffee">
                  <HiPencil className="w-3 h-3" />
                </button>
                <button onClick={() => handleDelete(e.id)} className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-red-50 text-red-500">
                  <HiTrash className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
