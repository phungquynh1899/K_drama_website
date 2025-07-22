// 4 nhiệm vụ của file app.js 
// middleware
// route
// database 
// error handling 
// set up view engine (nếu cần ejs)
require('dotenv').config();
const express = require('express');
const transferRouter = require('./routes/transfer/transfer.router.js')

const uploadRouter = require('./routes/upload/upload.router.js')
const seriesRouter = require('./routes/series/series.router.js')
const thumbnailRouter = require('./routes/thumbnail/thumbnail.router.js')
const app = express();
const path = require('path');

const { NotFoundError } = require('./response/error.response.js');
const morgan = require('morgan');
const compression = require('compression');

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//middleware
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONT_END_SERVER_HOST
}));
app.use(express.json({ limit: '20kb'}));
app.use(express.urlencoded({ limit: '20kb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'))
app.use(compression())

//database
require('./db/BetterSqliteDatabase.js')

//route
app.use('/api/v1/transfer', transferRouter)
app.use('/api/v1/upload-temp/', uploadRouter) // xong 
app.use('/api/v1/series/', seriesRouter)
// app.use('/api/v1/thumbnail/', thumbnailRouter)

//error handling
//not found url error (không rớt vào cái link nào nên mới rớt vô cái middleware này)
app.use((req, res, next) => {
    const NotFound = new NotFoundError()
    next(NotFound) //thảy cho error handling kế tiếp
})
//giới hạn size cho cả req tới (giới hạn size của chunk luôn )

//error occurs in the execution of some url  
app.use((error, req, res, next) => {
    //cái dòng này quá là hữu ích 
    console.log(error)
    const statusCode = error.status || 500
    res.status(statusCode).json({
        "error": error.message || "Internal server error",
    }
    )
})

module.exports = app;