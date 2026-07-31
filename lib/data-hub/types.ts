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

export type ParsedImportFile = {
  filename: string;
  extension: "xlsx" | "xls" | "csv";
  headers: string[];
  rows: ImportRow[];
  sheetName: string;
};

export type ValidationIssueCode =
  | "missing_column"
  | "duplicate"
  | "wrong_data_type"
  | "empty_cell";

export type ValidationIssue = {
  code: ValidationIssueCode;
  message: string;
  row?: number;
  column?: string;
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
