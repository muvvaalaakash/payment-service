const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const { initKeycloak } = require('./keycloak');
const keycloak = initKeycloak(app);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/paymentdb';
mongoose.connect(MONGO_URI).then(() => console.log('Payment Service: MongoDB connected')).catch(err => console.error(err));

const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || 'http://order-service:3008';

const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'], default: 'credit_card' },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  transactionId: String,
  cardLast4: String,
  createdAt: { type: Date, default: Date.now }
});
const Payment = mongoose.model('Payment', paymentSchema);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'payment-service' }));

// Process payment
app.post('/payments/process', keycloak.protect(), async (req, res) => {
  try {
    const { orderId, userId, amount, method, cardNumber } = req.body;
    const transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    const cardLast4 = cardNumber ? cardNumber.slice(-4) : '****';

    // Simulate payment processing (90% success rate)
    const success = Math.random() > 0.1;
    const payment = await Payment.create({
      orderId, userId, amount, method,
      status: success ? 'completed' : 'failed',
      transactionId, cardLast4
    });

    // Notify order service
    if (success) {
      try {
        await axios.put(`${ORDER_SERVICE}/orders/${orderId}/status`, {
          paymentStatus: 'paid', paymentId: payment._id, status: 'confirmed'
        });
      } catch (e) { console.error('Failed to notify order service:', e.message); }
    }

    res.json({ success, payment, message: success ? 'Payment successful' : 'Payment failed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get payment by order
app.get('/payments/:orderId', keycloak.protect(), async (req, res) => {
  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all payments (admin)
app.get('/payments', keycloak.protect(), async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Refund
app.post('/payments/:paymentId/refund', keycloak.protect(), async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.paymentId, { status: 'refunded' }, { new: true });
    res.json({ message: 'Refund processed', payment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
