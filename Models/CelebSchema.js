const mongoose=require('mongoose')

const celebSchema=new mongoose.Schema({
    name : {
        type:String,
        required:true,
        unique:true,
    },
    imageUrl : {
        type:String,
        required:true,
    }
})

celebSchema.pre('save', async function (next) {
    try {
        const existingCeleb = await Celeb.findOne({ name: this.name });
        if (existingCeleb) {
            // Create a custom error to pass to the error handler
            const error = new Error(`Duplicate name found: ${this.name}`);
            error.name = 'DuplicateError'; // Custom error name for identification
            return next(error);
        }
        next();
    } catch (err) {
        next(err);
    }
});


const Celeb=mongoose.model('Celeb',celebSchema);
module.exports=Celeb;