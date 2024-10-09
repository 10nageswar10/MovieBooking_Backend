const jwt=require('jsonwebtoken');
require('dotenv').config();

function checkAuthToken(req,res,next){
    const authToken=req.cookies.authToken;
    const refreshToken=req.cookies.refreshToken;

    //check authtoken
    //check refresh
    //authtoken is not expired->user logged in

    //user not logged in
    // auth token is exp but refresh token is not ->regenerated authtoken and refresh token
    //authtoken is exp and refresh toke is exp->user not logged in
    if(!authToken || !refreshToken){
        return res.status(401).json({
            ok:false,
            message:"Authentication failed: No authToken or refreshToken provided"
        })
    }

    jwt.verify(authToken,process.env.JWT_SECRET_KEY,(err,decoded)=>{
        if(err){
            jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET_KEY,(refreshErr,refreshDecoded)=>{
                if(refreshErr){
                    return res.status(401).json({
                        ok:false,
                        message:"Authentication failed: both tokens are inavlid"
                    })
                }
                else{
                    const newAuthToken=jwt.sign({userId:refreshDecoded.userId},process.env.JWT_SECRET_KEY,{expiresIn:'50m'})
                    const newRefreshToken=jwt.sign({userId:refreshDecoded.userId},process.env.JWT_REFRESH_SECRET_KEY,{expiresIn:'60m'})
                    res.cookie('authToken',newAuthToken,{httpOnly:true});
                    res.cookie('refreshToken',newRefreshToken,{httpOnly:true});

                    req.userId=refreshDecoded.userId;
                    req.ok=true;
                    next();
                }
            })
        }
        else{
            req.userId=decoded.userId;
            next();
        }
    })
}

module.exports=checkAuthToken;