const { default: mongoose } = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    image: {
        type: String,
        required: [true, 'Image is required'],
    },
    slug:{
        type: String,
         required: [true, 'Name is required'],
        trim: true
    },
    uploadResultId: {
      type: String,

    },


    discount: {
        type: Number,
        default: 0,
    },
    subcategories: [{
        type: mongoose.Types.ObjectId,
        ref: 'Subcategory',
    }],


}, {
    timestamps: true,
});
module.exports = mongoose.model("categoryModle", categorySchema);