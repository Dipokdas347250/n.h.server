require('dotenv').config()
const express = require('express');
const app = express();
const { dbconfig } = require('./config/db.config');
const _ = require('./route');
const { globalerrorhandler } = require('./utils/globalerror');
dbconfig()
const session = require('express-session')
const cors = require('cors'); 
const {MongoStore} = require('connect-mongo');

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], 
    credentials: true, 
}));

app.use(express.static('uploads'));
const port = process.env.PORT ;

// const dns = require('dbs')
// dns.setServer(["1.1.1.1"])

app.use(express.json())
app.use(session({
    name: 'ecommerce-session',
    secret: process.env.SESSION_SECRET,
    resave: false,
    rolling: true,
    saveUninitialized: true,
    cookie: { secure: false},
    store: MongoStore.create({
        mongoUrl: process.env.DB_DATA_URL,
        collectionName: 'sessions'
    })
}));
// localhost:8080/api/v1


app.get('/session', (req, res) => {
  console.log(req.session.user);
  
  return res.send('API is running....');
});



app.use(process.env.BASE_ROUTE, _); 

app.use(globalerrorhandler)



app.listen(port, () => {
  console.log(`Server is running`);
});