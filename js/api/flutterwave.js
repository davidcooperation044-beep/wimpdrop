// ===== FLUTTERWAVE PAYMENT INTEGRATION =====
// This module handles all Flutterwave payment processing

class FlutterwavePayment {
  constructor(publicKey) {
    this.publicKey = publicKey;
    this.baseUrl = 'https://api.flutterwave.com/v3';
  }

  // Initialize payment modal
  initiatePayment(paymentConfig) {
    try {
      // Ensure Flutterwave script is loaded
      if (!window.FlutterwaveCheckout) {
        this.loadFlutterwaveScript(() => {
          this._openCheckout(paymentConfig);
        });
      } else {
        this._openCheckout(paymentConfig);
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      throw error;
    }
  }

  _openCheckout(config) {
    const flutterwaveConfig = {
      public_key: this.publicKey,
      tx_ref: `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount: config.amount,
      currency: config.currency || 'NGN',
      payment_options: 'card,ussd,account,qr,bank_transfer,barter,crypto',
      customer: {
        email: config.email,
        phone_number: config.phone,
        name: config.customerName
      },
      customizations: {
        title: 'Wimp-Drop Store',
        description: config.description || 'Order Payment',
        logo: config.logo || ''
      },
      callback: (response) => {
        this.handlePaymentCallback(response, config.onSuccess, config.onError);
      }
    };

    FlutterwaveCheckout(flutterwaveConfig);
  }

  // Handle payment callback
  handlePaymentCallback(response, successCallback, errorCallback) {
    try {
      if (response.status === 'successful') {
        // Verify payment on backend
        this.verifyPayment(response.transaction_id)
          .then(verified => {
            if (verified) {
              if (successCallback) successCallback(response);
            } else {
              if (errorCallback) errorCallback('Payment verification failed');
            }
          })
          .catch(error => {
            if (errorCallback) errorCallback(error);
          });
      } else if (response.status === 'cancelled') {
        if (errorCallback) errorCallback('Payment cancelled by user');
      } else {
        if (errorCallback) errorCallback('Payment failed');
      }
    } catch (error) {
      console.error('Callback handling error:', error);
      if (errorCallback) errorCallback(error);
    }
  }

  // Verify payment (server-side recommended)
  async verifyPayment(transactionId) {
    try {
      // This should be called from your backend API
      const response = await fetch('/api/flutterwave/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId })
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const data = await response.json();
      return data.verified === true;
    } catch (error) {
      console.error('Payment verification error:', error);
      return false;
    }
  }

  // Load Flutterwave script
  loadFlutterwaveScript(callback) {
    if (document.querySelector('script[src*="flutterwave"]')) {
      callback();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.onload = callback;
    document.head.appendChild(script);
  }

  // Process refund (server-side)
  async processRefund(transactionId, amount) {
    try {
      const response = await fetch('/api/flutterwave/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, amount })
      });

      if (!response.ok) {
        throw new Error('Refund failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Refund error:', error);
      throw error;
    }
  }

  // Get transaction details
  async getTransactionDetails(transactionId) {
    try {
      const response = await fetch(`/api/flutterwave/transaction/${transactionId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transaction details');
      }

      return await response.json();
    } catch (error) {
      console.error('Transaction details error:', error);
      throw error;
    }
  }

  // Create subscription
  async createSubscription(subscriptionData) {
    try {
      const response = await fetch('/api/flutterwave/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        throw new Error('Subscription creation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Subscription error:', error);
      throw error;
    }
  }

  // Get available banks
  async getAvailableBanks(country = 'NG') {
    try {
      const response = await fetch(`/api/flutterwave/banks?country=${country}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch banks');
      }

      return await response.json();
    } catch (error) {
      console.error('Banks fetch error:', error);
      throw error;
    }
  }
}

// Initialize Flutterwave
const flutterwavePayment = new FlutterwavePayment(CONFIG.flutterwaveKey);

// Helper function for easy payment initiation
function initiateFlutterwavePayment(amount, email, phone, customerName, description = '') {
  flutterwavePayment.initiatePayment({
    amount: amount,
    email: email,
    phone: phone,
    customerName: customerName,
    description: description,
    currency: 'NGN', // Change based on customer location
    onSuccess: (response) => {
      console.log('Payment successful:', response);
      handlePaymentSuccess(response);
    },
    onError: (error) => {
      console.error('Payment error:', error);
      showNotification(`Payment failed: ${error}`, 'error');
    }
  });
}

function handlePaymentSuccess(response) {
  // Store payment record in database
  if (AppState.user) {
    // Save payment details and update order status
    showNotification('Payment successful! Your order is being processed.', 'success');
    clearCart();
    window.location.href = 'order-success.html';
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FlutterwavePayment, flutterwavePayment };
}
