const {default: mongoose} = require('mongoose');

const subcategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    //  slug:{
    //     type: String,
    //      required: [true, 'Name is required'],
    //     trim: true
    // },
    category: {
        type: mongoose.Types.ObjectId,
        ref: 'Category',
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model("Subcategory", subcategorySchema);