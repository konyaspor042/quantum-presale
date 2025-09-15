// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB bağlantısı
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log("MongoDB connected"))
  .catch(err=> console.error("MongoDB connection error:", err));

// Schemas
const paymentSchema = new mongoose.Schema({
  wallet: String,
  usd: Number,
  tokens: Number,
  status: String, // pending, finished, failed
  date: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', paymentSchema);

// Kullanıcı token bilgisi endpoint
app.get('/api/user-tokens/:wallet', async (req,res)=>{
  const wallet = req.params.wallet;
  const payments = await Payment.find({wallet});
  const totalTokens = payments.reduce((sum,p)=>sum+(p.tokens||0),0);
  res.json({ wallet, totalTokens, history: payments });
});

// Presale durumu
app.get('/api/presale-status', async (req,res)=>{
  const TOTAL = 2625000000;
  const sold = await Payment.aggregate([{ $group: {_id:null, total:{$sum:"$tokens"}}}]);
  const soldTokens = sold[0] ? sold[0].total : 0;
  const remaining = TOTAL - soldTokens;
  const percent = Math.round((soldTokens/TOTAL)*100);
  res.json({ remaining, percent });
});

// NOWPayments webhook
app.post('/api/payment-webhook', async (req,res)=>{
  const data = req.body;
  console.log("Webhook received:", data);

  // Example: data includes order_id=wallet, price_amount, price_currency
  const wallet = data.order_id;
  const usd = parseFloat(data.price_amount || 0);
  const tokens = Math.round(usd/0.02 * 1.25); // 25% bonus

  const statusMap = {
    'waiting': 'pending',
    'confirmed': 'finished',
    'failed': 'failed'
  };
  const status = statusMap[data.payment_status] || 'pending';

  await Payment.create({ wallet, usd, tokens, status });
  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
