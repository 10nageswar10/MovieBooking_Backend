const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const UserOTPVerificationSchema=new Schema({
    userId:String,
    otp:Number,
    createdAt:Date,
    expiredAt:Date
})

const UserOTPVerification=mongoose.model(
    "userOTPVerification",
    UserOTPVerificationSchema
);

module.exports=UserOTPVerification;