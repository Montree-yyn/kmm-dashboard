export type DataAvailability = {
  available: boolean;
  reason: string | null;
};

export type DailySalesDetail = {
  date: string;
  branch: string;
  salesperson: string;
  model: string;
  quantity: number;
};

export type DailyBookingDetail = {
  date: string;
  branch: string;
  salesperson: string;
  model: string;
  purchaseStatus: string;
};

export type DailyManagementSnapshot = {
  asOfDate: string;
  scope: { branch: string | null };
  sourceDates: {
    sales: string | null;
    booking: string | null;
    stock: string | null;
  };
  availableBranches: string[];
  sales: {
    todayUnits: number;
    mtdUnits: number;
    today: DailySalesDetail[];
    byBranch: Array<{ branch: string; units: number }>;
    bySalesperson: Array<{ salesperson: string; units: number }>;
    topSalespeople: Array<{ salesperson: string; units: number }>;
  };
  target: {
    monthlyUnits: number;
    source: string;
    sourceVersion: string;
    effectiveFrom: string;
    evaluationEligible: boolean;
    achievementPercent: number | null;
    gap: number | null;
  } | null;
  booking: {
    newToday: number;
    activeUnits: number;
    aHot: number;
    bHot: number;
    cHot: number;
    today: DailyBookingDetail[];
  };
  stock: {
    engineUnits: number;
    value: number | null;
    byBranch: Array<{ branch: string; units: number }>;
    aging: Array<{ label: "0–30" | "31–60" | "61–90" | ">90" | "Unknown"; units: number }>;
  };
  bookingStock: Array<{
    model: string;
    activeBooking: number;
    stock: number;
    coverageMonths: number | null;
    signal: "shortage" | "high" | "balanced" | "unknown";
  }>;
  availability: {
    target: DataAvailability;
    bookingLifecycle: DataAvailability;
    cancelReason: DataAvailability;
    stockLocation: DataAvailability;
    actions: DataAvailability;
    notes: DataAvailability;
  };
};

export type DailyManagementPayload = {
  source: "d1";
  generatedAt: string;
  timeZone: string;
  snapshot: DailyManagementSnapshot;
};
