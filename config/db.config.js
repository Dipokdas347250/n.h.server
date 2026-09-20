const { default: mongoose } = require("mongoose")

exports.dbconfig=()=>{
    mongoose.connect(process.env.DB_DATA_URL).then(()=>{
        console.log("DataBase Connected Successfully");
    }).catch((err)=>{
        console.log("Database Connection Failed", err);
    })
    
}