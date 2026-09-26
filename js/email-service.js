


class EmailService {
  constructor() {
    this.adminEmail = 'wimpycooperation@gmail.com';
    this.baseUrl = window.location.origin;
  }







  async sendOrderConfirmation(orderData, userEmail) {
    try {

      const emailPayload = {
        orderId: orderData.id,
        userEmail: userEmail,
        adminEmail: this.adminEmail,
        orderItems: orderData.items,
        totalAmount: orderData.total_amount,
        shippingAddress: orderData.shipping_address,
        status: orderData.status,
        createdAt: orderData.created_at,
        paymentRef: orderData.payment_ref
      };



      const result = await this._sendEmail(emailPayload);

      if (result.success) {
        return { success: true, message: 'Confirmation emails sent' };
      } else {
        return { success: true, message: 'Order created (email pending)' };
      }
    } catch (error) {
      console.error('Email sending error:', error);

      return { success: true, message: 'Order created (email retry pending)' };
    }
  }





  async _sendEmail(emailPayload) {
    try {

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });

      if (response.ok) {
        return { success: true };
      } else {

        console.warn('Email endpoint not configured');
        return { success: false };
      }
    } catch (error) {

      console.warn('Email service unavailable:', error.message);
      return { success: false };
    }
  }





  _formatAdminEmail(orderData) {
    return `
      <h2>New Order Received</h2>
      <p><strong>Order ID:</strong> ${orderData.orderId}</p>
      <p><strong>Customer Email:</strong> ${orderData.userEmail}</p>
      <p><strong>Total Amount:</strong> ₦${(orderData.totalAmount / 100).toLocaleString()}</p>
      <p><strong>Shipping Address:</strong> ${this._formatAddress(orderData.shippingAddress)}</p>
      <p><strong>Items:</strong></p>
      <ul>
        ${orderData.orderItems?.map(item => `<li>${item.name} x ${item.quantity}</li>`).join('') || 'N/A'}
      </ul>
      <p><strong>Payment Reference:</strong> ${orderData.paymentRef || 'Pending'}</p>
      <p><strong>Status:</strong> ${orderData.status}</p>
      <p>Created: ${new Date(orderData.createdAt).toLocaleString()}</p>
    `;
  }





  _formatUserEmail(orderData) {
    return `
      <h2>Your Order Confirmation</h2>
      <p>Thank you for your order!</p>
      <p><strong>Order ID:</strong> ${orderData.orderId}</p>
      <p><strong>Total Amount:</strong> ₦${(orderData.totalAmount / 100).toLocaleString()}</p>
      <p><strong>Items Ordered:</strong></p>
      <ul>
        ${orderData.orderItems?.map(item => `<li>${item.name} x ${item.quantity}</li>`).join('') || 'N/A'}
      </ul>
      <p><strong>Shipping to:</strong></p>
      <p>${this._formatAddress(orderData.shippingAddress)}</p>
      <p>We'll send you a tracking number as soon as your order ships.</p>
      <p>For support, contact: ${this.adminEmail}</p>
    `;
  }





  _formatAddress(address) {
    if (!address) return 'Not provided';
    return `
      ${address.fullName || ''}<br/>
      ${address.street || ''}<br/>
      ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}<br/>
      ${address.country || 'Nigeria'}
    `;
  }
}


const emailService = new EmailService();
