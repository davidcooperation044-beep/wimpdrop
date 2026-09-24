import { cjRequest } from './cj.ts';
import type { SupplierAdapter, SupplierAddress, SupplierLineItem } from './supplier.ts';

export class CjSupplierAdapter implements SupplierAdapter {
  async getStock(supplierVariantId: string) {
    const result = await cjRequest(`/product/stock/queryByVid?vid=${encodeURIComponent(supplierVariantId)}`);
    const inventories = Array.isArray(result.data) ? result.data : [];
    return { quantity: inventories.reduce((sum: number, item: any) => sum + Number(item.totalInventoryNum || 0), 0), raw: result };
  }

  async getPrice(supplierProductId: string) {
    const result = await cjRequest(`/product/query?pid=${encodeURIComponent(supplierProductId)}`);
    return Number(result.data?.sellPrice || 0);
  }

  async createOrder(input: { orderNumber: string; address: SupplierAddress; items: SupplierLineItem[] }) {
    const result = await cjRequest('/shopping/order/createOrderV3', {
      method: 'POST',
      body: JSON.stringify({
        orderNumber: input.orderNumber,
        shippingCountryCode: input.address.country || 'NG',
        shippingProvince: input.address.state || '',
        shippingCity: input.address.city || '',
        shippingPhone: input.address.phone || '',
        shippingCustomerName: input.address.name || '',
        shippingAddress: input.address.street || '',
        shippingZip: input.address.postal || '',
        email: input.address.email || '',
        products: input.items.map((item) => ({ vid: item.supplierVariantId, quantity: item.quantity, storeLineItemId: item.id }))
      })
    });
    const supplierOrderId = result.data?.orderCode || result.data?.orderId || result.data?.orderNum;
    if (!supplierOrderId) throw new Error('CJ order response did not include an order identifier');
    return { supplierOrderId, raw: result };
  }

  async getTracking(supplierOrderId: string) {
    const result = await cjRequest(`/shopping/order/getOrderLogisticsInfo?orderCode=${encodeURIComponent(supplierOrderId)}`);
    const logistics = Array.isArray(result.data) ? result.data[0] : result.data;
    return {
      status: logistics?.orderStatus || logistics?.status || 'submitted',
      trackingNumber: logistics?.trackingNumber || logistics?.trackingNo || logistics?.trackNumber || null,
      carrier: logistics?.logisticsName || logistics?.carrier || null,
      raw: result
    };
  }
}

export function getSupplierAdapter(name = 'cj'): SupplierAdapter {
  if (name === 'cj') return new CjSupplierAdapter();
  throw new Error(`Unsupported supplier adapter: ${name}`);
}
