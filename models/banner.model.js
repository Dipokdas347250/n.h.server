const {default: mongoose} = require('mongoose');

const bannerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: [true, 'image is required'],
        trim: true
    },
    url:{
        type: String,
        trim: true

    },
    uploadResultId: {
      type: String,

    },
   
}, {
    timestamps: true,
});

module.exports = mongoose.model("Banner", bannerSchema);