const { default: mongoose } = require('mongoose');

const bannerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: [true, 'image is required'],
        trim: true
    },
    url: {
        type: String,
        trim: true,
        default: ""
    },
    uploadResultId: {
        type: String,
    },
    // Headline copy, stored per language so the slide reads naturally in both.
    title: { type: String, trim: true, default: "" },
    titleBn: { type: String, trim: true, default: "" },
    subtitle: { type: String, trim: true, default: "" },
    subtitleBn: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    descriptionBn: { type: String, trim: true, default: "" },
    buttonLabel: { type: String, trim: true, default: "" },
    buttonLabelBn: { type: String, trim: true, default: "" },
}, {
    timestamps: true,
});

module.exports = mongoose.model("Banner", bannerSchema);
