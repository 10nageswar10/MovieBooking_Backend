const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true
    },
    portraitImgUrl: {
        type: String,
        required: true
    },
    landscapeImgUrl: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    genre: {
        type: [String], // You can store multiple genres as an array of strings
        required: true
    },
    duration: {
        type: Number, // Duration in minutes
        required: true
    },
    cast: [
        {
            celebId:String,
            celebType : String,
            celebName : {
                type: String,
            },
            celebRole : String,
            celebImage : String
        }
    ],
    crew: [
        {
            celebId:String,
            celebType : String,
            celebName : {
                type: String,
            },
            celebRole : String,
            celebImage : String
        }
    ]
});


// Pre-save hook to check for duplicates in cast and crew arrays
movieSchema.pre('save', function (next) {
    // Filter out members with null or empty celebName
    const filteredCast = this.cast.filter(member => member.celebName && member.celebName.trim() !== '');
    const filteredCrew = this.crew.filter(member => member.celebName && member.celebName.trim() !== '');

    // Check for duplicates in cast
    const castNames = filteredCast.map((member) => member.celebName);
    const castImages = filteredCast.map((member) => member.celebImage);
    const hasDuplicateCastName = new Set(castNames).size !== castNames.length;
    const hasDuplicateCastImage = new Set(castImages).size !== castImages.length;

    if (hasDuplicateCastName) {
        return next(new Error('Duplicate names found in the cast'));
    }
    if (hasDuplicateCastImage) {
        return next(new Error('Duplicate images found in the cast'));
    }

    // Check for duplicates in crew
    const crewNames = filteredCrew.map((member) => member.celebName);
    const crewImages = filteredCrew.map((member) => member.celebImage);
    const hasDuplicateCrewName = new Set(crewNames).size !== crewNames.length;
    const hasDuplicateCrewImage = new Set(crewImages).size !== crewImages.length;

    if (hasDuplicateCrewName) {
        return next(new Error('Duplicate names found in the crew'));
    }
    if (hasDuplicateCrewImage) {
        return next(new Error('Duplicate images found in the crew'));
    }

    // All checks passed
    next();
});

const Movie = mongoose.model('Movie', movieSchema);

module.exports = Movie;