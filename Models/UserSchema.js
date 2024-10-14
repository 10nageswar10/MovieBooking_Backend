const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');

const UserSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    bookings:{
        type:Array,
        default:[],
    },
    city:{
        type: String,
        required:true
    },
    verified:Boolean,

},{
    timestamps:true
})

UserSchema.pre('save',async function (next) {
    const user=this;
    if(user.isModified('password')){
        user.password=await bcrypt.hash(user.password,8);
    }
    next();
});

const User=mongoose.model('User',UserSchema);
module.exports=User;