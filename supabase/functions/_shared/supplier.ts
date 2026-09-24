export type SupplierAddress = {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

export type SupplierLineItem = {
  id: string;
  supplierVariantId: string;
  quantity: number;
};

export interface SupplierAdapter {
  getStock(supplierVariantId: string): Promise<{ quantity: number; raw: unknown }>;
  getPrice(supplierProductId: string): Promise<number>;
  createOrder(input: { orderNumber: string; address: SupplierAddress; items: SupplierLineItem[] }): Promise<{ supplierOrderId: string; raw: unknown }>;
  getTracking(supplierOrderId: string): Promise<{ status: string; trackingNumber: string | null; carrier: string | null; raw: unknown }>;
}
