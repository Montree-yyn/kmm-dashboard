export type SalesFilterInput = {
  year?: string[] | number[];
  month?: string[] | number[];
  branch?: string[];
  salesperson?: string[];
  productGroup?: string[];
};

export type CanonicalSalesRow = {
  id: string;
  date: string;
  year: number;
  month: number | null;
  branch: string;
  salesperson: string;
  salespersonCode: string | null;
  employeeCode: string;
  productType: string;
  model: string;
  modelCode: string;
  quantity: number;
  saleAmount: number;
  finalReceived: number | null;
  netReceived: number | null;
  gp1: number | null;
  expense: number | null;
  commission: number | null;
};

/**
 * Minimum row shape accepted by the shared Sales business rules.
 *
 * `quantity` is optional only for compatibility with the pre-D1
 * dashboard-data.json payload, where one row historically represented one
 * transaction unit. D1/API rows always preserve the imported quantity.
 */
export type SalesBusinessRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model?: string;
  quantity?: number;
  finalReceived: number | null;
  gp1: number | null;
  expense: number | null;
};

export type SalesKpis = {
  salesUnit: number;
  salesValue: number | null;
  grossProfit: number | null;
  grossProfitAvailable: boolean;
  expense: number | null;
};

export type SalesSummary = { label: string; value: number; available: boolean }[];
