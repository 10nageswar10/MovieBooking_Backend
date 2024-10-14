const express=require('express');
const bodyParser=require('body-parser');
const cors=require('cors');
const cookieParser = require('cookie-parser');

const PORT=8000;
const app=express();

const authRoutes=require('./Routes/Auth');
const adminRoutes=require('./Routes/Admin');
const movieRoutes=require('./Routes/Movie')
const imageuploadRoutes=require('./Routes/imageUploadRoutes')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Ensure you've set your Stripe secret key
const CancelledPayments = require('./Models/CancelledPayments'); // Adjust the path to your model as needed

require('dotenv').config();
require('./db');

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    if(endpointSecret){
        try {
        console.log('Stripe Webhook Secret:', endpointSecret);
        const rawBody = req.body; // Get the raw body from the request
        console.log("Raw body:", rawBody.toString('utf8')); // Correct way to log the raw body 

        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    }catch (err) {
        console.log(`⚠️  Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    }
    else{
        console.log('No Stripe Webhook Secret provided.');
        return res.status(400).send('No Stripe Webhook Secret provided.');
    }
     

    // Handle the event
    switch (event.type) {
        case 'charge.refunded':
            const refund = event.data.object;
            console.log(`Charge was refunded!`);
            
            // Find the corresponding CancelledPayments document and update its status
            await CancelledPayments.findOneAndUpdate(
                { paymentId: refund.id },
                { status: 'success' },
                { new: true }
            );
            
            // Optionally, log the updated document
            console.log(`Updated payment status to success for payment ID: ${refund.id}`);
            
            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
});

app.use(bodyParser.json());
const allowedOrigins=['http://localhost:3000','http://localhost:3001',process.env.NEXT_VERSAL_URL] //this frontend can use our backend

app.use(cors({
    origin: function(origin,callback){
        if(!origin||allowedOrigins.includes(origin)){
            callback(null,true);
        }else{
            callback(new Error('Not allowed by CORS'));
        }
        },
    credentials: true,
}));
app.use(cookieParser());

app.use('/auth',authRoutes);
app.use('/admin',adminRoutes);
app.use('/movie',movieRoutes)
app.use('/image',imageuploadRoutes)


const endpointSecret=process.env.STRIPE_WEBHOOK_SECRET;


app.get('/',(req,res)=>{
    res.json({message:"The api is working"})
})

app.listen(PORT,()=>{
    console.log(`server running on port ${PORT}`);
})