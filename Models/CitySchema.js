const mongoose=require('mongoose')


const CitySchema=new mongoose.Schema({
    cityname:{
        type:String,
    }
})

module.exports=mongoose.model('City',CitySchema)