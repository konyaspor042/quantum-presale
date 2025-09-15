require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

const TOKEN_PRICE = 0.02;
const BONUS = 0.25;
const TOTAL_SUPPLY = 2625000000;

// MongoDB bağlantısı
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true });
const db = mongoose.connection;
db.on('error', console.error.bind(console,'MongoDB connection error:'));
db.once('open',()=> console.log('MongoDB connected'));

const paymentSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  usd: Number,
  tokens: Number
});

const userSchema = new mongoose.Schema({
  wallet: { type: String, required:true, unique:true },
  payments: [paymentSchema]
});

const User = mongoose.model('User', userSchema);

app.use(cors());
app.use(bodyParser.json());

// NOWPayments webhook
app.post('/webhook/nowpayments', async (req,res)=>{
    const data = req.body;
    if(data.status === 'finished'){
        const wallet = data.order_id;
        const usd = parseFloat(data.price_amount);
        const tokens = Math.round(usd / TOKEN_PRICE);
        const totalWithBonus = Math.round(tokens * (1+BONUS));

        let user = await User.findOne({wallet});
        if(!user) user = new User({wallet,payments:[]});
        user.payments.push({usd,tokens:totalWithBonus});
        await user.save();
    }
    res.sendStatus(200);
});

// Kullanıcı token sorgusu
app.get('/api/user-tokens/:wallet', async (req,res)=>{
    const wallet = req.params.wallet;
    const user = await User.findOne({wallet});
    let totalTokens = 0;
    if(user) totalTokens = user.payments.reduce((sum,p)=> sum + p.tokens,0);
    res.json({ totalTokens });
});

// Presale durumu
app.get('/api/presale-status', async (req,res)=>{
    const users = await User.find();
    let totalSold = 0;
    users.forEach(u=> totalSold += u.payments.reduce((sum,p)=> sum + p.tokens,0));
    const remaining = Math.max(0,TOTAL_SUPPLY - totalSold);
    const percent = Math.round(totalSold/TOTAL_SUPPLY*100);
    res.json({ totalSold, remaining, percent, totalSupply: TOTAL_SUPPLY });
});

app.listen(PORT, ()=> console.log(`Server running on port ${PORT}`));
