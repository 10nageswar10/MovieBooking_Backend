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

require('dotenv').config();
require('./db');

app.use(bodyParser.json());
const allowedOrigins=['http://localhost:3000','http://localhost:3001','https://movie-booking-frontend-njyy2k316-10nageswar10s-projects.vercel.app'] //this frontend can use our backend

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

app.get('/',(req,res)=>{
    res.json({message:"The api is working"})
})

app.listen(PORT,()=>{
    console.log(`server running on port ${PORT}`);
})