const mongoose=require('mongoose')


const CancelledPaymentsSchema=new mongoose.Schema({
    paymentId:String,
    userId:String,
    cancelledAt:Date,
    bookedMovieId:String,
    bookedId:String,
    bookingDate:Date,
    totalAmount:Number,
    status:String,
    deletedAt: { type: Date, index: { expires: '2d' } },
})

const CancelledPayments=mongoose.model('CancelledPayments',CancelledPaymentsSchema)
module.exports=CancelledPayments;