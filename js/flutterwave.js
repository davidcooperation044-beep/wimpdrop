// ===== FLUTTERWAVE PAYMENT INTEGRATION MODULE =====
// Handles Flutterwave payment gateway integration and callbacks

class FlutterwaveService {
  constructor() {
    this.isInitialized = false;
    this.publicKey = null;
    this.currentTransaction = null;
  }

  // Initialize Flutterwave service
  async initialize(publicKey) {
    try {
      if (!publicKey) {
        console.warn('Flutterwave public key not configured.');
        return false;
      }

      this.publicKey = publicKey;

      // Load Flutterwave library from CDN
      if (typeof FlutterWaveCheckout === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.flutterwave.com/v3.js';
        script.async = true;
        document.head.appendChild(script);

        // Wait for library to load
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      this.isInitialized = true;
      console.log('✓ Flutterwave initialized successfully');
      return true;

    } catch (error) {
      console.error('Flutterwave initialization error:', error);
      return false;
    }
  }

  // Initialize payment
  async initiatePayment(paymentData) {
    try {
      if (!this.isInitialized) {
        throw new Error('Flutterwave not initialized');
      }

      // Validate required fields
      const required = ['amount', 'email', 'phone', 'customer_name', 'tx_ref'];
      for (const field of required) {
        if (!paymentData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Store transaction details
      this.currentTransaction = {
        ...paymentData,
        timestamp: new Date(),
        status: 'initiated'
      };

      // Build checkout configuration
      const checkoutConfig = {
        public_key: this.publicKey,
        tx_ref: paymentData.tx_ref,
        amount: paymentData.amount,
        currency: paymentData.currency || 'NGN',
        payment_options: paymentData.payment_options || 'card,ussd,bank_account,banktransfer',
        customer: {
          email: paymentData.email,
          phone_number: paymentData.phone,
          name: paymentData.customer_name
        },
        customizations: {
          title: 'Wimp-Drop Store',
          description: paymentData.description || 'Purchase from Wimp-Drop',
          logo: 'https://wimpyco.ng/logo.png' // Update with actual logo URL
        },
        callback: this.handlePaymentCallback.bind(this),
        onclose: this.handlePaymentClosed.bind(this),
        meta: {
          order_id: paymentData.order_id || null,
          user_id: paymentData.user_id || null
        }
      };

      // Add redirect URL if provided
      if (paymentData.redirect_url) {
        checkoutConfig.redirect_url = paymentData.redirect_url;
      }

      // Open Flutterwave checkout modal
      FlutterWaveCheckout(checkoutConfig);

      return { success: true };

    } catch (error) {
      console.error('Payment initiation error:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle payment callback (called by Flutterwave after payment)
  handlePaymentCallback(response) {
    console.log('Flutterwave callback response:', response);

    if (!response) {
      this.handlePaymentFailed('No response from Flutterwave');
      return;
    }

    // Check payment status
    if (response.status === 'successful') {
      this.handlePaymentSuccess(response);
    } else if (response.status === 'failed') {
      this.handlePaymentFailed(response.message || 'Payment failed');
    } else {
      this.handlePaymentPending(response);
    }
  }

  // Handle successful payment
  async handlePaymentSuccess(response) {
    try {
      console.log('✓ Payment successful:', response);

      // Update transaction status
      if (this.currentTransaction) {
        this.currentTransaction.status = 'completed';
        this.currentTransaction.response = response;
      }

      // Call the success handler if provided
      if (window.onFlutterwaveSuccess) {
        window.onFlutterwaveSuccess(response);
      }

      // Dispatch custom event for other parts of the app
      window.dispatchEvent(new CustomEvent('payment-success', { detail: response }));

    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  }

  // Handle failed payment
  async handlePaymentFailed(message) {
    try {
      console.error('✗ Payment failed:', message);

      // Update transaction status
      if (this.currentTransaction) {
        this.currentTransaction.status = 'failed';
        this.currentTransaction.error = message;
      }

      // Call the failure handler if provided
      if (window.onFlutterwaveFailure) {
        window.onFlutterwaveFailure(message);
      }

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('payment-failure', { 
        detail: { error: message }
      }));

    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  // Handle pending payment
  async handlePaymentPending(response) {
    try {
      console.log('⏳ Payment pending:', response);

      // Update transaction status
      if (this.currentTransaction) {
        this.currentTransaction.status = 'pending';
        this.currentTransaction.response = response;
      }

      // Call the pending handler if provided
      if (window.onFlutterwavePending) {
        window.onFlutterwavePending(response);
      }

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('payment-pending', { detail: response }));

    } catch (error) {
      console.error('Error handling payment pending:', error);
    }
  }

  // Handle when user closes payment modal without action
  handlePaymentClosed() {
    console.log('Payment modal closed');
    
    if (window.onFlutterwaveClosed) {
      window.onFlutterwaveClosed();
    }

    window.dispatchEvent(new CustomEvent('payment-closed'));
  }

  // Verify payment with backend
  async verifyPayment(transactionId) {
    try {
      if (!transactionId) {
        throw new Error('Transaction ID required');
      }

      // Call backend endpoint to verify payment
      const response = await fetch('/api/flutterwave/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      return { success: true, data: data.transaction };

    } catch (error) {
      console.error('Payment verification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current transaction details
  getCurrentTransaction() {
    return this.currentTransaction;
  }

  // Clear transaction history
  clearTransaction() {
    this.currentTransaction = null;
  }

  // Helper: Generate unique transaction reference
  generateTransactionRef(prefix = 'txn') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  // Helper: Validate NGN amount
  validateAmount(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    // Minimum transaction amount (typically ₦100 for Flutterwave)
    if (amount < 100) {
      throw new Error('Minimum amount is ₦100');
    }
    return true;
  }

  // Helper: Format amount for Flutterwave (in kobo/cents)
  formatAmountForPayment(nairaAmount) {
    // Flutterwave accepts amounts in the base currency unit
    // For NGN, keep as is (whole Naira)
    return Math.round(nairaAmount);
  }
}

// Create global Flutterwave service instance
const flutterwaveService = new FlutterwaveService();

// Initialize when available
if (typeof CONFIG !== 'undefined' && CONFIG.flutterwaveKey) {
  flutterwaveService.initialize(CONFIG.flutterwaveKey);
}

// Helper function to create payment object for cart checkout
function createFlutterwavePayment(cart, customerInfo, orderTotal) {
  const txRef = flutterwaveService.generateTransactionRef();
  
  return {
    tx_ref: txRef,
    amount: orderTotal,
    currency: 'NGN',
    email: customerInfo.email,
    phone: customerInfo.phone,
    customer_name: customerInfo.firstName + ' ' + customerInfo.lastName,
    description: `Purchase of ${cart.length} item(s) from Wimp-Drop`,
    payment_options: 'card,ussd,bank_account,banktransfer',
    redirect_url: window.location.origin + '/pages/order-success.html',
    user_id: customerInfo.userId || null,
    order_id: customerInfo.orderId || null
  };
}
