export interface ProductImportRow {
  Code?: string;
  Name: string;
  Category?: string;
  Unit?: string;
  "Current Stock"?: string;
  "Minimum Stock"?: string;
  Cost?: string;
  Price?: string;
  "Current Stock Value"?: string;
  "Current Stock Cost"?: string;
  "Amount Sold"?: string;
  "Quantity Sold"?: string;
  Profit?: string;
  Image_Path?: string;
}

export interface CustomerImportRow {
  Name: string;
  Phone?: string;
  Address?: string;
  "Address Line 2"?: string;
  Email?: string;
  "Work Phone"?: string;
  ID?: string;
  Notes?: string;
  Sold?: string;
  "Quantity Sold"?: string;
  "Date Created"?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
