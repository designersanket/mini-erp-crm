export type UserRole = 'admin' | 'sales' | 'warehouse' | 'accounts';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AuthPayload {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export type CustomerType = 'retail' | 'wholesale' | 'distributor';
export type CustomerStatus = 'lead' | 'active' | 'inactive';

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  business_name: string | null;
  gst_number: string | null;
  customer_type: CustomerType;
  address: string | null;
  status: CustomerStatus;
  followup_date: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  unit_price: number;
  current_stock: number;
  min_stock_alert: number;
  location: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: number;
  product_id: number;
  quantity: number;
  movement_type: MovementType;
  reason: string | null;
  reference_type: string | null;
  reference_id: number | null;
  created_by: number | null;
  created_at: string;
}

export type ChallanStatus = 'draft' | 'confirmed' | 'cancelled';

export interface Challan {
  id: number;
  challan_number: string;
  customer_id: number;
  status: ChallanStatus;
  total_quantity: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
}

export interface ChallanItem {
  id: number;
  challan_id: number;
  product_id: number;
  product_name_snapshot: string;
  product_sku_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
}
