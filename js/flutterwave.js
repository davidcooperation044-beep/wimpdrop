


class FlutterwaveService {
  constructor() {
    this.isInitialized = false;
    this.publicKey = null;
    this.currentTransaction = null;
  }


  async initialize(publicKey) {
    try {
      if (!publicKey) {
        console.warn('Flutterwave public key not configured.');
        return false;
      }

      this.publicKey = publicKey;


      if (typeof FlutterWaveCheckout === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.flutterwave.com/v3.js';
        script.async = true;
        document.head.appendChild(script);


        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('Flutterwave initialization error:', error);
      return false;
    }
  }


  async initiatePayment(paymentData) {
    try {
      if (!this.isInitialized) {
        throw new Error('Flutterwave not initialized');
      }


      const required = ['amount', 'email', 'phone', 'customer_name', 'tx_ref'];
      for (const field of required) {
        if (!paymentData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }


      this.currentTransaction = {
        ...paymentData,
        timestamp: new Date(),
        status: 'initiated'
      };


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
          logo: 'https://wimpyco.ng/logo.png'
        },
        callback: this.handlePaymentCallback.bind(this),
        onclose: this.handlePaymentClosed.bind(this),
        meta: {
          order_id: paymentData.order_id || null,
          user_id: paymentData.user_id || null,
          ...(paymentData.meta || {})
        }
      };


      if (paymentData.redirect_url) {
        checkoutConfig.redirect_url = paymentData.redirect_url;
      }


      FlutterWaveCheckout(checkoutConfig);

      return { success: true };

    } catch (error) {
      console.error('Payment initiation error:', error);
      return { success: false, error: error.message };
    }
  }


  handlePaymentCallback(response) {
    if (!response) {
      this.handlePaymentFailed('No response from Flutterwave');
      return;
    }


    if (response.status === 'successful') {
      this.handlePaymentSuccess(response);
    } else if (response.status === 'failed') {
      this.handlePaymentFailed(response.message || 'Payment failed');
    } else {
      this.handlePaymentPending(response);
    }
  }


  async handlePaymentSuccess(response) {
    try {

      if (this.currentTransaction) {
        this.currentTransaction.status = 'completed';
        this.currentTransaction.response = response;
      }


      if (window.onFlutterwaveSuccess) {
        window.onFlutterwaveSuccess(response);
      }


      window.dispatchEvent(new CustomEvent('payment-success', { detail: response }));

    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  }


  async handlePaymentFailed(message) {
    try {
      console.error('✗ Payment failed:', message);


      if (this.currentTransaction) {
        this.currentTransaction.status = 'failed';
        this.currentTransaction.error = message;
      }


      if (window.onFlutterwaveFailure) {
        window.onFlutterwaveFailure(message);
      }


      window.dispatchEvent(new CustomEvent('payment-failure', {
        detail: { error: message }
      }));

    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }


  async handlePaymentPending(response) {
    try {

      if (this.currentTransaction) {
        this.currentTransaction.status = 'pending';
        this.currentTransaction.response = response;
      }


      if (window.onFlutterwavePending) {
        window.onFlutterwavePending(response);
      }


      window.dispatchEvent(new CustomEvent('payment-pending', { detail: response }));

    } catch (error) {
      console.error('Error handling payment pending:', error);
    }
  }


  handlePaymentClosed() {
    if (window.onFlutterwaveClosed) {
      window.onFlutterwaveClosed();
    }

    window.dispatchEvent(new CustomEvent('payment-closed'));
  }


  async verifyPayment(transactionId) {
    try {
      if (!transactionId) {
        throw new Error('Transaction ID required');
      }


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


  getCurrentTransaction() {
    return this.currentTransaction;
  }


  clearTransaction() {
    this.currentTransaction = null;
  }


  generateTransactionRef(prefix = 'txn') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }


  validateAmount(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    if (amount < 100) {
      throw new Error('Minimum amount is ₦100');
    }
    return true;
  }


  formatAmountForPayment(nairaAmount) {


    return Math.round(nairaAmount);
  }
}


const flutterwaveService = new FlutterwaveService();


if (typeof CONFIG !== 'undefined' && CONFIG.flutterwaveKey) {
  flutterwaveService.initialize(CONFIG.flutterwaveKey);
}


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
