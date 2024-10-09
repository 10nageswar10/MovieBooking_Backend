const express=require('express');
const router=express.Router();

const User=require('../Models/UserSchema');
const Movie=require('../Models/MovieSchema');
const Booking=require('../Models/BookingSchema');
const Screen=require('../Models/ScreenSchema');
const Celeb=require('../Models/CelebSchema');
const errorHandler = require('../Middleware/errorMiddleware');
const authTokenHandler=require('../Middleware/checkAuthToken')
const adminTokenHandler=require('../Middleware/checkAdminToken')
const {generateTicketPDF}=require('../utils/generatePDF')
const nodemailer=require('nodemailer')

const cloudinary = require('cloudinary').v2;
//qrcode
const QRCode=require('qrcode')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const transporter=nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_MAILID,
        pass: process.env.APP_PASS
    }
})


function createResponse(ok,message,data){
    return {
        ok,
        message,
        data
    }
}

router.get('/test',async(req,res)=>{
    res.json({messgae:'Movie API is working'})
})


// admin access
router.post('/createmovie',adminTokenHandler,async(req,res,next)=>{
    try{
        const  {title,description,portraitImgUrl,landscapeImgUrl,rating,genre,duration}=req.body;
        const newMovie=new Movie({title,description,portraitImgUrl,landscapeImgUrl,rating,genre,duration})
        await newMovie.save();
        res.status(201).json(createResponse(true,'Movie created successfully',newMovie));
    }
    catch(err){
        next(err);
    }
})
router.post('/addcelebtomovie',adminTokenHandler,async(req,res,next)=>{
    try{
        const {movieId,celebId,celebName,celebType,celebRole,celebImage}=req.body;
        const movie=await Movie.findById(movieId);
        if(!movie){
            return res.status(404).json(createResponse(false,'Movie not found'));
        }
        const existingCelebName = celebType === "cast"
        ? movie.cast.some(member => member.celebName === celebName)
        : movie.crew.some(member => member.celebName === celebName);

        if (existingCelebName) {
            return res.status(400).json(createResponse(false, `The celebrity name "${celebName}" is already added to the ${celebType}.`));
        }
        const newCeleb={
            celebId,
            celebType,
            celebName,
            celebRole,
            celebImage
        };
        if(celebType==="cast"){
            movie.cast.push(newCeleb);
        }else{
            movie.crew.push(newCeleb);
        }
        await movie.save();
        res.status(200).json(createResponse(true,'Celebrity added to movie successfully',movie));
    } 
    catch(err){
        next(err);
    }
})
router.post('/createscreen',adminTokenHandler,async(req,res,next)=>{
    try{
        let {name,location,seats,city,screenType}=req.body;
        city=city.replace(/\s+/g, '').toLowerCase();
        const newScreen=new Screen({
            name,
            location,
            seats,
            city,
            screenType,
            movieSchedules:[]
        });

        await newScreen.save();
        res.status(201).json(createResponse(true,'Screen added successfully',newScreen));
    }
    catch(err){
        next(err);
    }
})
router.post('/addmovieschedulescreen',adminTokenHandler,async(req,res,next)=>{
    try{
        const {screenId,movieId,showTime,showDate}=req.body;
        const screen=await Screen.findById(screenId);
        if(!screen){
            return res.status(404).json(createResponse(false,'Screen not found'));
        }
        const movie=await Movie.findById(movieId);
        if(!movie){
            return res.status(404).json(createResponse(false,'Movie not found'));
        }

        screen.movieSchedules.push({
            movieId,
            showTime,
            notavailableseats:[],
            showDate,
        })

        await screen.save();
        res.status(200).json(createResponse(true,'Movie schedule added to screen successfully'));
    }
    catch(err){
        next(err);
    }
})



// user access
router.post('/bookticket',authTokenHandler,async(req,res,next)=>{
    try{
        const {showTime, showDate, movieId, screenId, seats, totalPrice, paymentId, paymentType}=req.body;
        //crate a  function to verify payment id

        const screen=await Screen.findById(screenId);
        const movie = await Movie.findById(movieId);
        if(!screen){
            return res.status(404).json(createResponse(false,'Screen not found'));
        }

        if (!movie){ 
            return res.status(404).json(createResponse(false, 'Movie not found'));
        }

        const movieSchedule=screen.movieSchedules.find(schedule=>{
            let showDate1=new Date(schedule.showDate)
            let showDate2=new Date(showDate) 
            if(showDate1.getDay()===showDate2.getDay()&&
            showDate1.getMonth()===showDate2.getMonth()&&
            showDate1.getFullYear()===showDate2.getFullYear()&&
            schedule.showTime===showTime&& 
            schedule.movieId==movieId){
                return true;
            }
            return false;
        });
        if(!movieSchedule){
            return res.status(404).json(createResponse(false,'No movie schedule found for this movie, show time and date'));
        }

        const user =await User.findById(req.userId);
        if(!user){
            return res.status(404).json(createResponse(false,'User not found'));
        }

        const newBooking=new Booking({ userId: req.userId, showTime, showDate, movieId, screenId, seats, totalPrice, paymentId, paymentType})
        const qrCodeData = `Booking ID: ${newBooking._id}, Movie: ${movieId}, Date: ${showDate}, Time: ${showTime}, Seats: ${JSON.stringify(seats)}`;
        const qrCodeImageUrl = await QRCode.toDataURL(qrCodeData); // Generate QR code image URL
        newBooking.qrCode = qrCodeImageUrl; // Store the QR code in the booking document

        await newBooking.save();

        const pdfBuffer = await generateTicketPDF(newBooking, movie, screen);
        
        movieSchedule.notavailableseats.push(...seats);
        await screen.save();

        user.bookings.push(newBooking._id);
        await user.save();
        res.status(201).json(createResponse(true,'Ticket booked successfully'));

        // Send the PDF via email


        const mailOptions = {
            from: process.env.GMAIL_MAILID,
            to: user.email,
            subject: 'CineSpot Movie Ticket',
            text: `Hello ${user.name}👋,\n\nYour movie ticket for ${movie.title} has been booked successfully🎉.\n\nYour Ticket🎫 is attached\n\nEnjoy the show! 🍿🎬`,
            attachments: [
                {
                filename: 'MovieTicket.pdf',
                content: pdfBuffer,
                contentType: 'application/pdf',
                },
            ],
            };
    
        await transporter.sendMail(mailOptions);

    }
    catch(err){
        next(err);
    }
})

router.post('/downloadticket/:bookingId',async(req,res,next)=>{
    try{
        const bookingId=req.params.bookingId;
        const booking=await Booking.findById(bookingId);
        if(!booking){
            return res.status(404).json(createResponse(false,'Booking not found'));
        }
        const movie=await Movie.findById(booking.movieId);
        if(!movie){
            return res.status(404).json(createResponse(false,'Movie not found'));
        }
        const screen=await Screen.findById(booking.screenId);
        if(!screen){
            return res.status(404).json(createResponse(false,'Screen not found'));
        }
        const pdfBuffer = await generateTicketPDF(booking, movie, screen);
        if (!pdfBuffer) {
            return res.status(500).json(createResponse(false, 'Failed to generate PDF'));
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ticket_${bookingId}.pdf`);
        res.write(pdfBuffer)
        res.end();
    }catch(error){
        console.error('Error generating PDF:', error);
        next(error);
}})

router.get('/movies',async(req,res,next)=>{
    try{
        const movies=await Movie.find({});
        res.json(createResponse(true,'Movies retrieved successfully',movies ));
    }
    catch(err){
        next(err);
    }
})

router.get('/movies/:id',async(req,res,next)=>{
    try{
        const movieId=req.params.id;
        const movie=await Movie.findById(movieId);
        if(!movie){
            return res.status(404).json(createResponse(false,'Movie not found'));
        }
        res.json(createResponse(true,'Movie retrieved successfully',movie));
    }
    catch(err){
        next(err);
    }
})

router.get('/screenbycity/:city',async(req,res,next)=>{
    try{
        const city=req.params.city;
        const screens=await Screen.find({city});
        if(!screens||screens.length===0){
            return res.status(404).json(createResponse(false,'No screens found in this city'));
        }
        res.json(createResponse(true,'Screens retrieved successfully',screens));
    }
    catch(err){
        next(err);
    }
})

router.get('/screensbymovieschedule/:city/:date/:movie_id',async(req,res,next)=>{
    try{
        const city=req.params.city.toLowerCase();
        const date=req.params.date;
        const movie_id=req.params.movie_id;

        const screens=await Screen.find({city});
        if(!screens||screens.length===0){
            return res.status(404).json(createResponse(false,'No screens found in the selected city'));
        }
        let uniqueScreen=new Set();
        const filledScreens=screens.forEach(screen=>{
            screen.movieSchedules.forEach(schedule=>{
                let showDate=new Date(schedule.showDate);
                let bodyDate=new Date(date);       
                if(showDate.getDay()===bodyDate.getDay()&&
                showDate.getMonth()===bodyDate.getMonth()&&
                showDate.getFullYear()===bodyDate.getFullYear()&&
                schedule.movieId==movie_id){
                    uniqueScreen.add(screen._id)
                }

            })
        })
        const filteredScreens=screens.filter(screen=>uniqueScreen.has(screen._id));
        res.status(200).json(createResponse(true,'screens retrieved successfully',filteredScreens))
    }
    catch(err){
        next(err);
    }
})

router.get('/schedulebymovie/:screenid/:date/:movieid',async(req,res,next)=>{
    const screenId=req.params.screenid;
    const date=req.params.date;
    const movieId=req.params.movieid;

    const screen=await Screen.findById(screenId);
    if(!screen){
        return res.status(404).json(createResponse(false,'Screen not found',null));
    }

    const movieSchedules=screen.movieSchedules.filter(schedule=>{
        let showDate=new Date(schedule.showDate);
        let bodyDate=new Date(date);
        if(showDate.getDay()===bodyDate.getDay()&&
        showDate.getMonth()===bodyDate.getMonth()&&
        showDate.getFullYear()===bodyDate.getFullYear()&&
        schedule.movieId==movieId){
            return true;
        }
        return false;
    })
    if(!movieSchedules){
        return res.status(404).json(createResponse(false,'Movie Schedule not found',null));
    }
    res.status(200).json(createResponse(true,'Movie Schedule retrieved Successfully',{
        screen,
        movieSchedulesforDate:movieSchedules
    }))
})

router.get('/getuserbookings',authTokenHandler,async(req,res,next)=>{
    try{
        const user=await User.findById(req.userId).populate('bookings');
        if(!user){
            return res.status(404).json(createResponse(false,'User not found',null));
        }
        let bookings=[]
        for(let i=0;i<user.bookings.length;i++){
            let bookingobj=await Booking.findById(user.bookings[i]._id);
            bookings.push(bookingobj);
        }

        res.status(200).json(createResponse(true,'User Bookings Retrieved Successfully',bookings));
    }
    catch(err){
        next(err);
    }
})

router.get('/getuserbooking/:bookingId', authTokenHandler, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json(createResponse(false, 'User not found', null));
        }

        const bookingId = req.params.bookingId;
        if (!user.bookings.includes(bookingId)) {
            return res.status(404).json(createResponse(false, 'Booking not found for this user', null));
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json(createResponse(false, 'Booking not found', null));
        }

        res.status(200).json(createResponse(true, 'Booking Retrieved Successfully', booking));
    } catch (err) {
        next(err);
    }
});


router.post('/addceleb',adminTokenHandler,async(req,res,next)=>{
    try{
        const {name,imageUrl}=req.body;
        const newCeleb=new Celeb({name,imageUrl});
        await newCeleb.save();
        res.status(201).json(createResponse(true,'Celebrity added successfully',newCeleb));
    }
    catch(err){
        if (err.name === 'DuplicateError') {
            return res.status(400).json({ success: false, message: err.message }); // Send the error message to frontend
        }
        next(err);
    }
})

router.get('/getceleb',async(req,res,next)=>{
    try{
        const celebs=await Celeb.find({});
        res.json(createResponse(true,'Celebrities retrieved successfully',celebs));
    }
    catch(err){
        next(err);
    }
})

router.get('/getscreen/:id',async(req,res,next)=>{
    try{
        const screenId=req.params.id;
        const screen=await Screen.findById(screenId);
        if(!screen){
            return res.status(404).json(createResponse(false,'Screen not found',null));
        }
        res.json(createResponse(true,'Screen retrieved successfully',screen));
    }
    catch(err){
        next(err);
    }
})


// put Requests

router.put('/movies/:id/clear-cast', async (req, res) => {
    try {
        const movieId = req.params.id;

        // Find the movie document
        const movie = await Movie.findById(movieId);
        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        if (movie.cast.length===0){
            return res.status(400).json({ error: 'Cast array is already empty' });
        }
        // Clear the cast
        movie.cast = [];

        // Save the updated movie
        const updatedMovie = await movie.save();

        res.status(200).json({ message: 'Cast cleared successfully', data: updatedMovie });
    } catch (error) {
        console.error('Error clearing cast:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/movies/:id/clear-crew', async (req, res) => {
    try {
        const movieId = req.params.id;

        // Find the movie document
        const movie = await Movie.findById(movieId);
        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        if (movie.crew.length === 0) {
            return res.status(400).json({ error: 'Crew array is already empty' });
        }
        // Clear the cast
        movie.crew = [];

        // Save the updated movie
        const updatedMovie = await movie.save();

        res.status(200).json({ message: 'Crew cleared successfully', data: updatedMovie });
    } catch (error) {
        console.error('Error clearing crew:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// delete Routes

router.delete('/movies/deleteceleb/:id',async(req,res,next)=>{
    try{
        const celebId=req.params.id;
        const celeb=await Celeb.findById(celebId);
        if(!celeb){
            return res.status(404).json(createResponse(false,'Celebrity not found'));
        }
        const imageUrl=celeb.imageUrl;

        if(imageUrl){
            const publicId=imageUrl.split('/').pop().split('.')[0]; // Extract public ID from URL
            await cloudinary.uploader.destroy(publicId); // Destroy image from Cloudinary
        }
        const response=await celeb.deleteOne();
        const updateResult = await Movie.updateMany(
            { $or: [{ 'cast.celebId': celebId }, { 'crew.celebId': celebId }] }, // Check for celebId in cast or crew
            {
                $pull: {
                    cast: { celebId: celebId }, // Remove celeb from cast array if exists
                    crew: { celebId: celebId }  // Remove celeb from crew array if exists
                }
            }
        );
        // Log the number of modified documents (if any)
        console.log(`Movies updated: ${updateResult.nModified}`);
        if(!response){
            return res.status(500).json(createResponse(false,'Failed to delete celebrity'));
        }
        res.json(createResponse(true,'Celebrity deleted successfully'));
    }
    catch(err){
        next(err);
    }
})

router.delete('/movies/deletemovie/:id',async(req,res,next)=>{
    try{
        const movieId=req.params.id;
        const movie=await Movie.findById(movieId);
        if(!movie){
            return res.status(404).json(createResponse(false,'Movie not found'));
        }
        const portraitImgUrl=await movie.portraitImgUrl;
        const landscapeImgUrl=await movie.landscapeImgUrl;
        const response=await movie.deleteOne();
        if(!response){
            return res.status(500).json(createResponse(false,'Failed to delete movie'));
        }
        if(portraitImgUrl){
            const publicId=portraitImgUrl.split('/').pop().split('.')[0]; // Extract public ID from URL
            await cloudinary.uploader.destroy(publicId); // Destroy image from Cloudinary
        }
        if(landscapeImgUrl){
            const publicId=landscapeImgUrl.split('/').pop().split('.')[0]; // Extract public ID from URL
            await cloudinary.uploader.destroy(publicId); // Destroy image from Cloudinary
        }
        res.json(createResponse(true,'Movie deleted successfully'));
    }
    catch(err){
        next(err);
    }
})

router.delete('/screens/deletescreen/:id', async (req, res, next) => {
    try {
      const screenId = req.params.id;
  
      // Find the screen by ID
      const screen = await Screen.findById(screenId);
      if (!screen) {
        return res.status(404).json(createResponse(false, 'Screen not found'));
      }
  
      // Find and delete all bookings associated with this screenId
      const deletedBookings = await Booking.find({ screenId });
      const bookingIds = deletedBookings.map((booking) => booking._id);
  
      // Delete all bookings related to the screen
      await Booking.deleteMany({ screenId });
  
      // Update users to remove the deleted booking references
      await User.updateMany(
        { bookings: { $in: bookingIds } },
        { $pull: { bookings: { $in: bookingIds } } }
      );
  
      // Delete the screen itself
      const response = await screen.deleteOne();
  
      if (!response) {
        return res.status(500).json(createResponse(false, 'Failed to delete screen'));
      }
  
      res.json(createResponse(true, 'Screen and associated schedules,bookings deleted successfully'));
    } catch (err) {
      next(err);
    }
  });


router.use(errorHandler)
module.exports=router;