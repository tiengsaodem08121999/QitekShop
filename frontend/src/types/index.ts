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
  email: string | null;
  address: string | null;
  notes: string | null;
  total_purchased?: number;
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

export type PaymentMethod = "cash" | "transfer";
export type PaymentType = "payment" | "refund";

export interface Payment {
  id: number;
  quotation_id: number;
  amount: number;
  method: PaymentMethod;
  payment_type: PaymentType;
  date: string;
  note: string | null;
  transaction_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type ReturnReason = "seller_fault" | "customer_fault";

export interface Return {
  id: number;
  quotation_id: number;
  item_name: string;
  reason: ReturnReason;
  selling_price: number;
  refund_percent: number;
  refund_amount: number;
  date: string;
  note: string | null;
  transaction_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
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
  total_refund: number;
  total_refund_paid: number;
  profit: number;
  items: QuotationItem[];
  payments: Payment[];
  returns: Return[];
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

export type YearlySummary = MonthlySummary[];

export interface DashboardData {
  quotation_count: number;
  total_income: number;
  total_expense: number;
  month: number;
  year: number;
}

export type EventStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface ScheduleTag {
  id: number;
  name: string;
  color: string;
}

export interface ScheduleEvent {
  id: number;
  title: string;
  date: string;            // YYYY-MM-DD
  start_time: string;      // HH:MM:SS
  end_time: string;        // HH:MM:SS
  status: EventStatus;
  description: string | null;
  tags: ScheduleTag[];
  created_by: number;
  created_by_name: string;
  created_at: string;
}
