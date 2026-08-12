export type OperationalFilters = {
  year?: string[];
  month?: string[];
  branch?: string[];
  salesperson?: string[];
  product?: string[];
  status?: string[];
  purchaseStatus?: string[];
};

export type BookingAdapterRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  price: number | null;
  bookingNo: string;
  customer: string;
  deposit: number | null;
  paymentType: string;
  financeType: string;
  purchaseStatus: string;
  statusDate: string;
  status: string;
};

export type StockAdapterRow = {
  companyId: string;
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  kmm: number | string | null;
  productType: string;
  productGroup: string;
  model: string;
  ageBucket: string;
  ageDays: number | null;
  snapshotDate: string;
  msrp: number | null;
  stockId: string | null;
  serialNumber: string | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  currentStatus: string;
};

export type OperationalBusiness = {
  booking: { unit: number; value: number | null; deposit: number | null; averageAge: number | null; conversionRate: number | null; byProduct: ReturnType<typeof import("../dashboard/booking-selectors").getBookingByProduct> };
  stock: { unit: number; value: number | null; averageAge: number | null; agedUnit: number; byProduct: ReturnType<typeof import("../dashboard/stock-selectors").getStockByProduct> };
};
