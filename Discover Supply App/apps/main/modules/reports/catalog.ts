export type ReportColumnFormat = "text" | "number" | "money" | "date" | "percent";

export type ReportColumn = {
  key: string;
  label: string;
  format?: ReportColumnFormat;
};

export type ReportFilterKey = "sku" | "categoryId" | "customerId" | "inactivityDays";

export type ReportDefinition = {
  id: string;
  name: string;
  group: "Inventory" | "Sales" | "Customers";
  description: string;
  filters: ReportFilterKey[];
  columns: ReportColumn[];
  defaultSort: string;
  sortOptions: Array<{ key: string; label: string }>;
};

export const reportDefinitions = [
  {
    id: "inventory-turnover",
    name: "Inventory turnover",
    group: "Inventory",
    description: "Units sold, cost of goods, average stock, and turnover by product and month.",
    filters: ["sku", "categoryId"],
    defaultSort: "month",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "month", label: "Month" },
      { key: "unitsSold", label: "Units sold", format: "number" },
      { key: "cogs", label: "COGS", format: "money" },
      { key: "avgInventory", label: "Avg inventory", format: "number" },
      { key: "turnoverRatio", label: "Turnover", format: "number" },
    ],
    sortOptions: [
      { key: "month", label: "Month" },
      { key: "unitsSold", label: "Units sold" },
      { key: "turnoverRatio", label: "Turnover" },
      { key: "product", label: "Product" },
    ],
  },
  {
    id: "inventory-aging",
    name: "Inventory aging",
    group: "Inventory",
    description: "Current stock value with last movement date and idle days.",
    filters: ["sku", "categoryId", "inactivityDays"],
    defaultSort: "daysIdle",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "onHand", label: "On hand", format: "number" },
      { key: "committed", label: "Committed", format: "number" },
      { key: "availableStock", label: "Available", format: "number" },
      { key: "inventoryValue", label: "Value", format: "money" },
      { key: "lastMovementAt", label: "Last movement", format: "date" },
      { key: "daysIdle", label: "Idle days", format: "number" },
    ],
    sortOptions: [
      { key: "daysIdle", label: "Idle days" },
      { key: "inventoryValue", label: "Value" },
      { key: "onHand", label: "On hand" },
      { key: "product", label: "Product" },
    ],
  },
  {
    id: "stock-movement",
    name: "Stock movement",
    group: "Inventory",
    description: "Receive, consume, commit, release, adjustment, and return activity.",
    filters: ["sku", "categoryId"],
    defaultSort: "createdAt",
    columns: [
      { key: "createdAt", label: "Date", format: "date" },
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "kind", label: "Type" },
      { key: "onHandDelta", label: "On-hand delta", format: "number" },
      { key: "committedDelta", label: "Committed delta", format: "number" },
      { key: "referenceType", label: "Reference" },
      { key: "note", label: "Note" },
    ],
    sortOptions: [
      { key: "createdAt", label: "Date" },
      { key: "product", label: "Product" },
      { key: "kind", label: "Type" },
      { key: "onHandDelta", label: "On-hand delta" },
    ],
  },
  {
    id: "low-stock",
    name: "Low stock",
    group: "Inventory",
    description: "Active inventory at or below the reorder point.",
    filters: ["sku", "categoryId"],
    defaultSort: "currentStock",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "currentStock", label: "Current stock", format: "number" },
      { key: "reorderPoint", label: "Reorder point", format: "number" },
      { key: "avgDailySales", label: "Avg daily sales", format: "number" },
      { key: "suggestedReorderQty", label: "Suggested reorder", format: "number" },
    ],
    sortOptions: [
      { key: "currentStock", label: "Current stock" },
      { key: "reorderPoint", label: "Reorder point" },
      { key: "avgDailySales", label: "Avg daily sales" },
      { key: "product", label: "Product" },
    ],
  },
  {
    id: "total-sales",
    name: "Total sales",
    group: "Sales",
    description: "Order-level sales totals with customer, payment, and balance details.",
    filters: ["customerId"],
    defaultSort: "date",
    columns: [
      { key: "date", label: "Date", format: "date" },
      { key: "orderNumber", label: "Order #" },
      { key: "customer", label: "Customer" },
      { key: "storeCode", label: "Store code" },
      { key: "orderTotal", label: "Order total", format: "money" },
      { key: "amountPaid", label: "Amount paid", format: "money" },
      { key: "balanceDue", label: "Balance due", format: "money" },
      { key: "paymentStatus", label: "Payment status" },
      { key: "stage", label: "Stage" },
    ],
    sortOptions: [
      { key: "date", label: "Date" },
      { key: "customer", label: "Customer" },
      { key: "orderTotal", label: "Order total" },
      { key: "amountPaid", label: "Amount paid" },
      { key: "balanceDue", label: "Balance due" },
      { key: "orderNumber", label: "Order #" },
    ],
  },
  {
    id: "top-selling-products",
    name: "Top selling products",
    group: "Sales",
    description: "Products ranked by quantity, revenue, order count, and last sale.",
    filters: ["sku", "categoryId"],
    defaultSort: "revenue",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "unitsSold", label: "Units sold", format: "number" },
      { key: "orderCount", label: "Orders", format: "number" },
      { key: "revenue", label: "Revenue", format: "money" },
      { key: "avgPrice", label: "Avg price", format: "money" },
      { key: "lastSoldAt", label: "Last sold", format: "date" },
    ],
    sortOptions: [
      { key: "revenue", label: "Revenue" },
      { key: "unitsSold", label: "Units sold" },
      { key: "orderCount", label: "Orders" },
      { key: "lastSoldAt", label: "Last sold" },
    ],
  },
  {
    id: "slow-dead-inventory",
    name: "Slow/dead inventory",
    group: "Inventory",
    description: "On-hand items with no recent sales activity.",
    filters: ["sku", "categoryId", "inactivityDays"],
    defaultSort: "daysSinceLastSale",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "onHand", label: "On hand", format: "number" },
      { key: "inventoryValue", label: "Value", format: "money" },
      { key: "lastSoldAt", label: "Last sold", format: "date" },
      { key: "daysSinceLastSale", label: "Days since sale", format: "number" },
    ],
    sortOptions: [
      { key: "daysSinceLastSale", label: "Days since sale" },
      { key: "inventoryValue", label: "Value" },
      { key: "onHand", label: "On hand" },
      { key: "product", label: "Product" },
    ],
  },
  {
    id: "gross-margin-by-product",
    name: "Gross margin by product",
    group: "Sales",
    description: "Revenue, COGS, gross profit, and margin rate by product.",
    filters: ["sku", "categoryId"],
    defaultSort: "grossProfit",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "unitsSold", label: "Units sold", format: "number" },
      { key: "revenue", label: "Revenue", format: "money" },
      { key: "cogs", label: "COGS", format: "money" },
      { key: "grossProfit", label: "Gross profit", format: "money" },
      { key: "grossMarginPct", label: "Margin", format: "percent" },
    ],
    sortOptions: [
      { key: "grossProfit", label: "Gross profit" },
      { key: "grossMarginPct", label: "Margin" },
      { key: "revenue", label: "Revenue" },
      { key: "unitsSold", label: "Units sold" },
    ],
  },
  {
    id: "customer-purchase-behavior",
    name: "Customer purchase behavior",
    group: "Customers",
    description: "Customer ordering frequency, revenue, average order, and city.",
    filters: ["customerId"],
    defaultSort: "revenue",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "storeCode", label: "Store code" },
      { key: "city", label: "City" },
      { key: "orderCount", label: "Orders", format: "number" },
      { key: "revenue", label: "Revenue", format: "money" },
      { key: "avgOrder", label: "Avg order", format: "money" },
      { key: "lastOrderAt", label: "Last order", format: "date" },
    ],
    sortOptions: [
      { key: "revenue", label: "Revenue" },
      { key: "orderCount", label: "Orders" },
      { key: "avgOrder", label: "Avg order" },
      { key: "lastOrderAt", label: "Last order" },
    ],
  },
  {
    id: "sales-by-category",
    name: "Sales by category",
    group: "Sales",
    description: "Revenue, quantity, and order count grouped by product category.",
    filters: ["categoryId"],
    defaultSort: "revenue",
    columns: [
      { key: "category", label: "Category" },
      { key: "unitsSold", label: "Units sold", format: "number" },
      { key: "orderCount", label: "Orders", format: "number" },
      { key: "revenue", label: "Revenue", format: "money" },
      { key: "avgLineValue", label: "Avg line value", format: "money" },
    ],
    sortOptions: [
      { key: "revenue", label: "Revenue" },
      { key: "unitsSold", label: "Units sold" },
      { key: "orderCount", label: "Orders" },
      { key: "category", label: "Category" },
    ],
  },
  {
    id: "inventory-valuation",
    name: "Inventory valuation",
    group: "Inventory",
    description: "Current stock, committed stock, available stock, cost value, and retail value.",
    filters: ["sku", "categoryId"],
    defaultSort: "inventoryValue",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "onHand", label: "On hand", format: "number" },
      { key: "committed", label: "Committed", format: "number" },
      { key: "availableStock", label: "Available", format: "number" },
      { key: "unitCost", label: "Unit cost", format: "money" },
      { key: "unitPrice", label: "Unit price", format: "money" },
      { key: "inventoryValue", label: "Cost value", format: "money" },
      { key: "retailValue", label: "Retail value", format: "money" },
    ],
    sortOptions: [
      { key: "inventoryValue", label: "Cost value" },
      { key: "retailValue", label: "Retail value" },
      { key: "onHand", label: "On hand" },
      { key: "product", label: "Product" },
    ],
  },
  {
    id: "customer-reorder-prediction",
    name: "Customer reorder prediction",
    group: "Customers",
    description: "Expected reorder timing based on customer order cadence.",
    filters: ["customerId", "inactivityDays"],
    defaultSort: "daysUntilExpected",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "storeCode", label: "Store code" },
      { key: "orderCount", label: "Orders", format: "number" },
      { key: "revenue", label: "Revenue", format: "money" },
      { key: "lastOrderAt", label: "Last order", format: "date" },
      { key: "avgCycleDays", label: "Avg cycle", format: "number" },
      { key: "nextExpectedOrderAt", label: "Expected reorder", format: "date" },
      { key: "daysUntilExpected", label: "Days until expected", format: "number" },
    ],
    sortOptions: [
      { key: "daysUntilExpected", label: "Days until expected" },
      { key: "lastOrderAt", label: "Last order" },
      { key: "revenue", label: "Revenue" },
      { key: "orderCount", label: "Orders" },
    ],
  },
] as const satisfies readonly ReportDefinition[];

export type ReportId = (typeof reportDefinitions)[number]["id"];

export const reportIds: string[] = reportDefinitions.map((report) => report.id);

export function getReportDefinition(reportId: string | undefined) {
  return reportDefinitions.find((report) => report.id === reportId) ?? reportDefinitions[0];
}
