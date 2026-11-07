const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance with fallback test keys
let razorpay;
const key_id = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID.trim() !== '')
  ? process.env.RAZORPAY_KEY_ID
  : 'rzp_test_placeholder';
const key_secret = (process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET.trim() !== '')
  ? process.env.RAZORPAY_KEY_SECRET
  : 'rzp_secret_placeholder';

try {
  razorpay = new Razorpay({ key_id, key_secret });
} catch (error) {
  console.warn('[Razorpay] Initialization warning:', error.message);
  razorpay = {
    orders: { create: async () => ({ id: 'mock_order_id' }) },
    payments: { fetch: async () => ({ status: 'captured' }), refund: async () => ({}) }
  };
}

/**
 * Create a Razorpay order
 * @param {Number} amount - Amount in smallest currency unit (paise for INR)
 * @param {String} currency - Currency code (default: INR)
 * @param {Object} options - Additional options like receipt, notes, etc.
 * @returns {Promise<Object>} Razorpay order object
 */
const createOrder = async (amount, currency = 'INR', options = {}) => {
  try {
    const orderOptions = {
      amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
      currency: currency,
      receipt: options.receipt || `receipt_${Date.now()}`,
      notes: options.notes || {}
    };

    const order = await razorpay.orders.create(orderOptions);
    return order;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
};

/**
 * Verify Razorpay payment signature
 * @param {String} razorpay_order_id - Razorpay order ID
 * @param {String} razorpay_payment_id - Razorpay payment ID
 * @param {String} razorpay_signature - Razorpay signature
 * @returns {Boolean} True if signature is valid
 */
const verifyPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  try {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;
    return isAuthentic;
  } catch (error) {
    console.error('Razorpay payment verification error:', error);
    return false;
  }
};

/**
 * Fetch payment details from Razorpay
 * @param {String} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
const fetchPayment = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Razorpay fetch payment error:', error);
    throw error;
  }
};

/**
 * Refund a payment
 * @param {String} paymentId - Razorpay payment ID
 * @param {Number} amount - Amount to refund (in paise, optional - full refund if not provided)
 * @returns {Promise<Object>} Refund details
 */
const refundPayment = async (paymentId, amount = null) => {
  try {
    const refundOptions = {};
    if (amount) {
      refundOptions.amount = Math.round(amount * 100); // Convert to paise
    }

    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    return refund;
  } catch (error) {
    console.error('Razorpay refund error:', error);
    throw error;
  }
};

module.exports = {
  razorpay,
  createOrder,
  verifyPayment,
  fetchPayment,
  refundPayment
};

