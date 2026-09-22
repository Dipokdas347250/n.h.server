const multer  = require('multer')
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
 
    let ext = file.originalname.split('.');
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix  + '.' + ext[ext.length - 1])
  }
});
// function checkFileType(file, cb) {
//   const filetypes = /jpeg|jpg|png|gif/;
//   const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//   const mimetype = filetypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb('Error: Images only! (jpeg, jpg, png, gif)');
//   }
// }
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only PNG and JPEG is allowed!'), false);
  }
};

const videoFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only video files are allowed!'), false);
  }
};


// const upload = multer({ storage: storage, limits:{fileSize: 1024 * 1024 * 5}, fileFilter: function (req, file, cb) {
//     checkFileType(file, cb);
//   }});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 5 }, fileFilter: imageFileFilter });
const videoUpload = multer({ storage, limits: { fileSize: 1024 * 1024 * 100 }, fileFilter: videoFileFilter });
module.exports = upload;
module.exports.videoUpload = videoUpload;