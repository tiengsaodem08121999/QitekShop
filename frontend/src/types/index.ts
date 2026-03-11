export type UserRole = "admin" | "sales" | "accountant";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface QuotationItem {
  id?: number;
  is_trade_in: boolean;
  name: string;
  condition: string | null;
  purchase_price: number;
  selling_price: number;
  warranty: string | null;
  warranty_start: string | null;
  delivery_date: string | null;
  notes: string | null;
}

export type QuotationStatus = "draft" | "confirmed";

export interface Quotation {
  id: number;
  customer: Customer;
  status: QuotationStatus;
  total_amount: number;
  total_paid: number;
  total_trade_in: number;
  remaining: number;
  total_purchase: number;
  profit: number;
  items: QuotationItem[];
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface QuotationListItem {
  id: number;
  customer_name: string;
  customer_id: number;
  status: QuotationStatus;
  total_amount: number;
  total_paid: number;
  total_trade_in: number;
  remaining: number;
  created_at: string;
}

export type TransactionType = "thu" | "chi";

export interface Transaction {
  id: number;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  notes: string | null;
  created_by: number;
  created_at: string;
}

export interface MonthlySummary {
  year: number;
  month: number;
  opening_balance: number;
  total_income: number;
  total_expense: number;
  profit: number;
  closing_balance: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardData {
  quotation_count: number;
  total_income: number;
  total_expense: number;
  month: number;
  year: number;
}
