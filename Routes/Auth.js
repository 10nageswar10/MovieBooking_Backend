const express=require('express');
const router=express.Router();
const User=require('../Models/UserSchema');
const UserOTPVerification=require('../Models/UserOTPVerification')
const City=require('../Models/CitySchema');
const errorHandler=require('../Middleware/errorMiddleware');
const authTokenHandler=require('../Middleware/checkAuthToken');
const jwt=require('jsonwebtoken');
const bcrypt=require('bcryptjs');
const nodemailer=require('nodemailer');
const crypto=require('crypto')


require('dotenv').config();

const generateOtpEmailTemplate = (otp) => `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      .email-container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #191919;
        padding: 20px;
        border: 1px solid #dddddd;
        border-radius: 8px;
      }
      .header {
        text-align: center;
        padding: 20px 0;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        color: #f4f4f4;
      }
      .otp-code {
        text-align: center;
        font-size: 28px;
        color: #ff5722;
        font-weight: bold;
        padding: 10px 0;
        background-color: #f9f9f9;
        border-radius: 8px;
        margin: 20px 0;
      }
      .content {
        text-align: center;
        font-size: 16px;
        line-height: 1.6;
        color: #ffffff;
      }
      .footer {
        text-align: center;
        font-size: 12px;
        color: #aaaaaa;
        padding: 10px 0;
        border-top: 1px solid #dddddd;
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center">
                <img src="https://res.cloudinary.com/dfg5wmtrh/image/upload/v1727941007/logowithsolgan_jpdyxx.png" alt="logo" height="75" width="80" style="display: block;color: #f4f4f4;">
              </td>
            </tr>
        </table>
      <div class="header">
        <h1>Your OTP Code</h1>
      </div>
      <div class="content">
        <p style="color:#ffffff;">Use the following OTP to complete your login. The OTP is valid for 10 minutes.</p>
        <div class="otp-code">${otp}</div>
        <p style="color:#ffffff;>If you didn't request this code, please ignore this email.</p>
      </div>
      <div class="footer">
        <p style="color:#dddddd;">Thank you for using our service!❤️</p>
        <p style="color:#dddddd;">&copy; 2024 CineSpot. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
`;



router.get('/test',async(req,res)=>{
    res.json({
        message:"Auth API is working"
    })
})

function createResponse(ok,message,data){
    return {
        ok,
        message,
        data
    }
}


const transporter=nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_MAILID,
        pass: process.env.APP_PASS
    }
})

const sendVerificationEmail=async({_id,email})=>{
    try{
        const otp=Math.floor(100000 + Math.random() * 900000);
        const mailOptions={
            from: process.env.GMAIL_MAILID,
            to: email,
            subject: 'OTP for Verification of CineSpot',
            html:generateOtpEmailTemplate(otp),
        }
        const newOTPVerification=new UserOTPVerification({
            userId:_id,
            otp:otp,
            createdAt :Date.now(),
            expiresAt: Date.now() + 600000, // 10 minutes
        })
        await newOTPVerification.save();
        await transporter.sendMail(mailOptions);
        return {
            status:"PENDING",
            message:"Verification OTP Email sent",
            data:{
                userId:_id,
                email
            },
        }
    }
    catch(err){
        return {
            status:"FAILED",
            message:err.message,
        }
    }
}



router.post('/register',async(req,res,next)=>{
    try{
        const {name,email,password,city}=req.body;
        const existingUser=await User.findOne({email:email});
        if(existingUser){
            return res.status(409).json(createResponse(false,'Email already exists'));
        }
        const newUser=new User({
            name,
            password,
            email,
            city,
            verified:false,
        });


        const result=await newUser.save()
        const response=await sendVerificationEmail(result)
        .catch((err)=>{
            console.log(err);
            res.json({
                status:"FAILED",
                message:"An error Occurred while Saving User Account",
            })
        })//wait the save operation
        res.status(201).json(createResponse(true,'User registered successfully',response));
    }
    catch(err){
        next(err)
    }
})


router.post('/verifyotp',async(req,res,next)=>{
    try{
        let {userId,otp}=req.body;
        if(!userId||!otp){
            throw Error("Empty OTP details are not allowed");
        }
        else{
            const userOTPVerificationRecords=await UserOTPVerification.find({
                userId,
            });
            if(userOTPVerificationRecords.length<=0){
                throw new ErrorEvent(
                    "Account record doesn't exist or has been verified already,please signup or login"
                )
            }else{
                const {expiresAt}=userOTPVerificationRecords[0];
                const dbOTP=userOTPVerificationRecords[0].otp;

                if(expiresAt<Date.now()){
                    //otp expired
                    await UserOTPVerification.deleteMany({userId});
                    throw new Error("Code has expired,Please Request Again")
                }
                else{
                    const validOTP= otp==dbOTP
                    if(!validOTP){
                        //given otp is wrong
                        throw new Error("Invalid Code Passed,check your inbox")
                    }
                    else{
                        //success
                        await User.updateOne({_id:userId},{verified:true})
                        await UserOTPVerification.deleteMany({userId});
                        res.json({
                            status:"VERIFIED",
                            message:"Account EMAIL verified successfully",
                        })
                    }
                }
            }
        }
    }catch(err){
        res.json({
            status:"FAILED",
            message:err.message,
        })
    }
})

router.post('/sendotp',async(req,res,next)=>{
    try{
        let {email,userId}=req.body;
        if(!email){
            throw Error("Empty Email is not allowed");
        }
        else{
            const existingUser=await User.findOne({email:email});
            console.log(existingUser);
            if(existingUser){
                const response=await sendVerificationEmail({userId,email});
                if(response.ok){
                    res.json(createResponse(true,'OTP sent successfully',response));
                }
                else{
                    res.json(createResponse(false,response.message));
                }
            }
            else{
                throw new Error("Account with this email doesn't exist")
            }
        }
    }
    catch(err){
        res.json({
            status:"FAILED",
            message:err.message,
        })
    }
})

router.post('/resendotpverificationcode',async(req,res)=>{
    try{
        let {userId,email}=req.body;
        if(!userId||!email){
            throw Error("Empty User details are not allowed");
        }
        else{
            await UserOTPVerification.deleteMany({userId});
            sendVerificationEmail({_id:userId,email,},res)
        }
    }
    catch(err){
        res.json({
            status:"FAILED",
            message:err.message,
        })
    }
})

router.post('/login',async(req,res,next)=>{
    const {email,password}=req.body;
    const user=await User.findOne({email});
    if(!user){
        return res.status(400).json(createResponse(false,'Invalid Credentials'));
    }
    const isMatch=await bcrypt.compare(password,user.password)
    if(!isMatch){
        return res.status(400).json(createResponse(false,'Invalid Credentials'));
    }
    const authToken=jwt.sign({userId:user._id},process.env.JWT_SECRET_KEY,{expiresIn:'50m'});
    const refreshToken=jwt.sign({userId:user._id},process.env.JWT_REFRESH_SECRET_KEY,{expiresIn:'60m'})
    res.cookie('authToken',authToken,{
        httpOnly: true, // Prevents JavaScript access
        secure: true, // Use this in production with HTTPS
        sameSite: 'None',
    });
    res.cookie('refreshToken',refreshToken,{
        httpOnly: true, // Prevents JavaScript access
        secure: true, // Use this in production with HTTPS
        sameSite: 'None',
    });

    res.status(200).json(createResponse(true,'Login Successful',{
        authToken,
        refreshToken
    }));
})

router.post('/addcity',async(req,res,next)=>{
    const {cityname}=req.body;
    const existingCity=await City.findOne({cityname:cityname});
    if(existingCity){
        return res.status(400).json(createResponse(false,'City already exists'));
    }
    else{
        const newCity=new City({
            cityname,
        });
        await newCity.save();
        res.status(200).json(createResponse(true,'City added successfully'));
    }
})

router.get('/getcities', async (req, res) => {
    const cities = await City.find({});
    res.status(200).json(createResponse(true, 'Cities fetched successfully', cities));
})


router.post('/changeCity', authTokenHandler, async (req, res, next) => {
    const { city } = req.body;
    const user = await User.findOne({ _id: req.userId });

    if (!user) {
        return res.status(400).json(createResponse(false, 'Invalid credentials'));
    }
    else{
        user.city = city;
        await user.save();
        return res.status(200).json(createResponse(true, 'City changed successfully'));
    }
})


router.get('/logout', authTokenHandler, async (req, res) => {
    res.clearCookie('authToken');
    res.clearCookie('refreshToken');
    res.json({
        ok: true,
        message: 'User logged out successfully'
    })
})

router.get('/getuser', authTokenHandler, async (req, res) => {
    const user = await User.findOne({ _id: req.userId });

    if (!user) {
        return res.status(400).json(createResponse(false, 'Invalid credentials'));
    }
    else{
        return res.status(200).json(createResponse(true, 'User found', user));
    }
})

router.get('/checklogin',authTokenHandler,async(req,res)=>{
    res.json({
        userId:req.userId,
        ok:true,
        message:'User authenticated successfully',
    })
})

// delete routes

router.delete('/deletecity/:id', async (req, res, next) => {
    const { id } = req.params; // Get the city ID from the request parameters
    try {
        const deletedCity = await City.findByIdAndDelete(id);
        if (!deletedCity) {
            return res.status(404).json(createResponse(false, 'City not found'));
        }
        res.status(200).json(createResponse(true, 'City deleted successfully'));
    } catch (error) {
        res.status(500).json(createResponse(false, 'Failed to delete city'));
        next(error); // Pass the error to the next middleware
    }
});


router.post('/forgot-password', async (req, res, next) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json(createResponse(false, 'User not found'));
        }

        // Generate a unique reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Set the token and expiry time on the user record
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
        await user.save();

        // Send the email with the reset link
        const resetUrl = `${process.env.FRONTEND_URL}/auth/resetpassword/${resetToken}`;
        const mailOptions = {
            from: process.env.GMAIL_MAILID,
            to: user.email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Click the link to reset your password: ${resetUrl}`,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json(createResponse(true, 'Reset link sent to your email'));
    } catch (error) {
        next(error);
    }
});

router.post('/reset-password/:token', async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;


    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }, // Token is still valid
        });
        if (!user) {
            return res.status(400).json(createResponse(false, 'Invalid or expired token'));
        }

        if (!password) {
            return res.status(400).json(createResponse(false, 'New password is required'));
        }

        // Hash the new password
        user.password = password;
        user.resetPasswordToken = undefined; // Clear the reset token
        user.resetPasswordExpires = undefined; // Clear the expiry
        await user.save();

        res.status(200).json(createResponse(true, 'Password has been reset successfully'));
    } catch (error) {
        next(error);
    }
});

router.use(errorHandler);

module.exports=router;