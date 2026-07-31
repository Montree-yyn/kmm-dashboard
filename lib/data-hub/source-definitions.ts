import type {
  DataFieldDefinition,
  DataModule,
  DataSourceDefinition,
  MasterDataDefinition,
  MasterDataType,
} from "./types";

const field = (
  key: string,
  label: string,
  type: DataFieldDefinition["type"] = "string",
  required = true,
): DataFieldDefinition => ({ key, label, type, required });

export const dataSourceDefinitions: DataSourceDefinition[] = [
  {
    id: "master_data",
    label: "Master Data",
    description: "Product, people, place and campaign reference records",
    visible: true,
    fields: [field("record_id", "Record ID")],
    duplicateKey: ["record_id"],
  },
  {
    id: "sales",
    label: "Sales",
    description: "Invoice, product, branch and sales value",
    visible: true,
    fields: [
      field("sale_date", "Sale Date", "date"),
      field("invoice_no", "Invoice No."),
      field("branch", "Branch"),
      field("model_code", "Model Code"),
      field("employee_code", "Employee Code", "string", false),
      field("quantity", "Quantity", "number"),
      field("sale_amount", "Sale Amount", "number"),
    ],
    duplicateKey: ["invoice_no"],
  },
  {
    id: "booking",
    label: "Booking",
    description: "Booking pipeline, customer and status",
    visible: true,
    fields: [
      field("booking_date", "Booking Date", "date"),
      field("booking_no", "Booking No."),
      field("branch", "Branch"),
      field("customer", "Customer"),
      field("product", "Product"),
      field("status", "Status"),
    ],
    duplicateKey: ["booking_no"],
  },
  {
    id: "stock",
    label: "Stock",
    description: "Inventory position by branch and product",
    visible: true,
    fields: [
      field("as_of_date", "As of Date", "date"),
      field("branch", "Branch"),
      field("product", "Product"),
      field("quantity", "Quantity", "number"),
    ],
    duplicateKey: ["as_of_date", "branch", "product"],
  },
  {
    id: "expense",
    label: "Expense",
    description: "Expense transactions by branch and category",
    visible: true,
    fields: [
      field("expense_date", "Expense Date", "date"),
      field("branch", "Branch"),
      field("category", "Category"),
      field("amount", "Amount", "number"),
    ],
    duplicateKey: ["expense_date", "branch", "category", "amount"],
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Township activity and campaign records",
    visible: true,
    fields: [
      field("activity_date", "Activity Date", "date"),
      field("township", "Township"),
      field("activity", "Activity"),
      field("campaign", "Campaign"),
    ],
    duplicateKey: ["activity_date", "township", "activity"],
  },
  {
    id: "team",
    label: "Team",
    description: "Employee, role, branch and reporting data",
    visible: true,
    fields: [
      field("employee_id", "Employee ID"),
      field("name", "Name"),
      field("position", "Position"),
      field("branch", "Branch"),
    ],
    duplicateKey: ["employee_id"],
  },
];

// This registry is intentionally data-driven so future master data types only
// need a schema entry; import UI and validation reuse the same definition.
export const masterDataDefinitions: MasterDataDefinition[] = [
  {
    id: "product",
    label: "Product Master",
    description: "Products, categories and model relationships",
    fields: [
      field("product_id", "Product ID"),
      field("product_name", "Product Name"),
      field("model_code", "Model Code"),
      field("category", "Category"),
    ],
    duplicateKey: ["product_id"],
  },
  {
    id: "model",
    label: "Model Master",
    description: "Product model definitions",
    fields: [
      field("model_code", "Model Code"),
      field("model_name", "Model Name"),
      field("category", "Category"),
    ],
    duplicateKey: ["model_code"],
  },
  {
    id: "branch",
    label: "Branch Master",
    description: "Branch ownership and regional records",
    fields: [
      field("branch_code", "Branch Code"),
      field("branch_name", "Branch Name"),
      field("region", "Region"),
    ],
    duplicateKey: ["branch_code"],
  },
  {
    id: "employee",
    label: "Employee Master",
    description: "Employee, position and branch records",
    fields: [
      field("employee_id", "Employee ID"),
      field("name", "Name"),
      field("position", "Position"),
      field("branch", "Branch"),
    ],
    duplicateKey: ["employee_id"],
  },
  {
    id: "salesman",
    label: "Salesman Master",
    description: "Sales ownership, territory and branch records",
    fields: [
      field("salesman_id", "Salesman ID"),
      field("salesman_name", "Salesman Name"),
      field("branch", "Branch"),
      field("territory", "Territory"),
    ],
    duplicateKey: ["salesman_id"],
  },
  {
    id: "customer_type",
    label: "Customer Type Master",
    description: "Customer segmentation and classification records",
    fields: [
      field("customer_type_id", "Customer Type ID"),
      field("customer_type_name", "Customer Type Name"),
      field("description", "Description", "string", false),
    ],
    duplicateKey: ["customer_type_id"],
  },
  {
    id: "customer",
    label: "Customer Master",
    description: "Customer identity and location records",
    fields: [
      field("customer_id", "Customer ID"),
      field("name", "Name"),
      field("township", "Township"),
      field("phone", "Phone", "string", false),
    ],
    duplicateKey: ["customer_id"],
  },
  {
    id: "township",
    label: "Township Master",
    description: "Canonical township and state or region records",
    fields: [
      field("township_id", "Township ID"),
      field("township_name", "Township Name"),
      field("state_region", "State / Region"),
    ],
    duplicateKey: ["township_id"],
  },
  {
    id: "dealer",
    label: "Dealer Master",
    description: "Dealer identity and territory records",
    fields: [
      field("dealer_id", "Dealer ID"),
      field("dealer_name", "Dealer Name"),
      field("township", "Township"),
    ],
    duplicateKey: ["dealer_id"],
  },
  {
    id: "campaign",
    label: "Campaign Master",
    description: "Campaign definitions and activity dates",
    fields: [
      field("campaign_id", "Campaign ID"),
      field("campaign_name", "Campaign Name"),
      field("start_date", "Start Date", "date"),
      field("end_date", "End Date", "date"),
    ],
    duplicateKey: ["campaign_id"],
  },
  {
    id: "price_list",
    label: "Price List Master",
    description: "Product pricing and effective-date records",
    fields: [
      field("price_list_id", "Price List ID"),
      field("product_id", "Product ID"),
      field("effective_date", "Effective Date", "date"),
      field("price", "Price", "number"),
    ],
    duplicateKey: ["price_list_id", "product_id", "effective_date"],
  },
];

export const visibleDataSources = dataSourceDefinitions.filter(
  (source) => source.visible,
);

export function getDataSourceDefinition(module: Exclude<DataModule, "master_data">) {
  const source = dataSourceDefinitions.find((item) => item.id === module);
  if (!source) throw new Error(`Unsupported Data Hub module: ${module}`);
  return source;
}

export function getMasterDataDefinition(type: MasterDataType) {
  const source = masterDataDefinitions.find((item) => item.id === type);
  if (!source) throw new Error(`Unsupported master data type: ${type}`);
  return source;
}

export function getImportSourceDefinition(
  module: DataModule,
  masterDataType: MasterDataType,
): DataSourceDefinition {
  if (module !== "master_data") return getDataSourceDefinition(module);
  const masterData = getMasterDataDefinition(masterDataType);
  return { ...masterData, id: module, visible: true };
}
