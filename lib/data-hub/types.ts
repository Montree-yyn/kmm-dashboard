export type DataModule =
  | "sales"
  | "booking"
  | "stock"
  | "expense"
  | "marketing"
  | "team"
  | "master_data";

export type MasterDataType =
  | "product"
  | "model"
  | "branch"
  | "employee"
  | "salesman"
  | "customer"
  | "customer_type"
  | "township"
  | "dealer"
  | "campaign"
  | "price_list";

export type DataFieldType = "string" | "number" | "date";

export type DataFieldDefinition = {
  key: string;
  label: string;
  type: DataFieldType;
  required: boolean;
};

export type DataSourceDefinition = {
  id: DataModule;
  label: string;
  description: string;
  visible: boolean;
  fields: DataFieldDefinition[];
  duplicateKey: string[];
};

export type MasterDataDefinition = Omit<DataSourceDefinition, "id" | "visible"> & {
  id: MasterDataType;
};

export type ImportRow = Record<string, unknown>;

export type QuantityRule =
  | "one_per_verified_sales_transaction"
  | "one_per_verified_stock_record";

export type DuplicateRule =
  | "booking_source_rows_are_transactions"
  | "current_stock_physical_identifier";

export type BookingStatusRule = "month_out_lifecycle";

export type ParsedImportFile = {
  filename: string;
  extension: "xlsx" | "xls" | "csv";
  headers: string[];
  rows: ImportRow[];
  sheetName: string;
  headerRow: number | null;
  headerConfidence: "high" | "medium" | "low" | "manual";
  detectedColumns: number;
  sourceRowNumbers?: number[];
  sourceRowSignatures?: string[];
  structureError?: string;
  inferredFields?: string[];
  canonicalCopies?: Record<string, string>;
  quantityRule?: QuantityRule;
  duplicateRule?: DuplicateRule;
  bookingStatusRule?: BookingStatusRule;
  detectedModule?: ImportModule;
  workbookSheetNames?: string[];
  sheets?: ParsedImportSheet[];
  detection?: ImportDetection;
};

export type DetectionConfidence = "high" | "medium" | "low" | "unknown";
export type DetectionEvidenceSource = "workbook_metadata" | "column_value" | "sheet_name" | "filename" | "saved_mapping";
export type DetectionEvidence = { source: DetectionEvidenceSource; detail: string };
export type DetectedValue<T extends string | number | null> = {
  value: T;
  confidence: DetectionConfidence;
  evidence: DetectionEvidence[];
};
export type ImportDetection = {
  company: DetectedValue<string | null>;
  module: DetectedValue<DataModule | null>;
  year: DetectedValue<number | null>;
  month: DetectedValue<number | null>;
  businessWeek: DetectedValue<number | null>;
  warnings: string[];
  candidateSheets: string[];
};
export type ParsedImportSheet = {
  name: string;
  headers: string[];
  rows: ImportRow[];
  headerRow: number | null;
  headerConfidence: "high" | "medium" | "low" | "manual";
  detectedColumns: number;
  sourceRowNumbers: number[];
  sourceRowSignatures: string[];
  structureError?: string;
  inferredFields: string[];
  canonicalCopies: Record<string, string>;
  quantityRule?: QuantityRule;
  duplicateRule?: DuplicateRule;
  bookingStatusRule?: BookingStatusRule;
  detectedModule?: ImportModule;
  isDataCandidate: boolean;
  headerScore: number;
  isSalesCandidate: boolean;
  salesScore: number;
  isBookingCandidate?: boolean;
  isStockCandidate?: boolean;
};

export type ValidationIssueCode =
  | "missing_column"
  | "duplicate"
  | "wrong_data_type"
  | "empty_cell"
  | "unmapped_employee";

export type ValidationIssue = {
  code: ValidationIssueCode;
  message: string;
  row?: number;
  column?: string;
  severity?: "error" | "warning";
};

export type ValidationSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  emptyCells: number;
  wrongTypeCells: number;
  warningCells: number;
  missingColumns: string[];
  issues: ValidationIssue[];
  canImport: boolean;
};

export type ImportHistoryRecord = {
  id: string;
  filename: string;
  module: string;
  importedAt: string;
  importedBy: string;
  rows: number;
  success: number;
  warning: number;
  error: number;
  status: ImportStatus;
  failureReason?: string;
  durationMs: number;
  rollbackAvailable: boolean;
};

export type ImportStatus =
  | "ready"
  | "uploading"
  | "validating"
  | "warning"
  | "importing"
  | "success"
  | "failed"
  | "rollback";

export type ImportModule = "sales" | "booking" | "stock";
