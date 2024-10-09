const express=require('express');
const router=express.Router();
const Admin=require('../Models/AdminSchema');
const bcrypt=require('bcrypt');
const errorHandler = require('../Middleware/errorMiddleware');
const jwt=require('jsonwebtoken');
const adminTokenHandler=require('../Middleware/checkAdminToken')
const nodemailer=require('nodemailer');


function createResponse(ok,message,data){
    return{
        ok,
        message,
        data,
    };
}

router.post('/register',async(req,res,next)=>{
    try{
        const {name,email,password}=req.body;
        const existingAdmin=await Admin.findOne({email:email});
        if(existingAdmin){
            return res.status(409).json(createResponse(false,'Admin with this Email already exists'));
        }
        const newAdmin=new Admin({
            name,
            password,
            email,
        });


        await newAdmin.save(); //wait the save operation
        res.status(201).json(createResponse(true,'Admin registered successfully'));
    }
    catch(err){
        next(err)
    }
})

router.post('/login',async(req,res,next)=>{
    try{
        const {email,password}=req.body;
        const admin=await Admin.findOne({email});
        if(!admin){
            return res.status(400).json(createResponse(false,'Invalid admin Credentials'));
        }
        const isMatch=await bcrypt.compare(password,admin.password)
        if(!isMatch){
            return res.status(400).json(createResponse(false,'Invalid admin Credentials'));
        }
        const adminAuthToken=jwt.sign({adminId:admin._id},process.env.JWT_ADMIN_SECRET_KEY,{expiresIn:'40m'});
        res.cookie('adminAuthToken',adminAuthToken,{httpOnly:true});

        res.status(200).json(createResponse(true,'Admin Login Successful',{
            adminAuthToken,
        }))
} catch(err){
    next(err);
}
});

router.get('/checklogin',adminTokenHandler,async(req,res)=>{
    res.json({
        adminId:req.adminId,
        ok:true,
        message:'Admin authenticated successfully',
    })
})

router.use(errorHandler)

module.exports=router;