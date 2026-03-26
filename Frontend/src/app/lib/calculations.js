/**
 * Shared calculation utilities for sales, expenses, and payments.
 */

/** Calculate sales summary from report items */
export function calculateSalesSummary(items = []) {
  const totalSales = items.reduce((s, i) => s + (i.totalSales || 0), 0);
  const totalCost = items.reduce((s, i) => s + (i.totalCost || 0), 0);
  const grossProfit = totalSales - totalCost;
  return { totalSales, totalCost, grossProfit };
}

/** Calculate expense summary — separates in/out types */
export function calculateExpenseSummary(expenses = []) {
  const totalIn = expenses.filter((e) => e.type === "in").reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalOut = expenses.filter((e) => e.type === "out").reduce((s, e) => s + Number(e.amount || 0), 0);
  const netExpenses = totalOut - totalIn;
  return { totalIn, totalOut, netExpenses };
}

/** Aggregate orders by payment method — returns { Cash: amount, UPI: amount, ... } */
export function aggregatePaymentMethods(orders = []) {
  return (Array.isArray(orders) ? orders : []).reduce((acc, o) => {
    const method = o.paymentMethod || "Other";
    acc[method] = (acc[method] || 0) + (o.grandTotal || 0);
    return acc;
  }, {});
}
