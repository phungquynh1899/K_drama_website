// 4 nhiệm vụ của file app.js 
// middleware
// route
// database 
// error handling 
// set up view engine (nếu cần ejs)

const express = require('express');
const app = express();
const path = require('path');
const { NotFoundError } = require('./response/error.response.js');
const morgan = require('morgan');
const compression = require('compression');

// router
// const authRouter = require('./routes/auth/auth.router.js')
// const userRouter = require('./routes/user/user.router.js')
// const adminRouter = require('./routes/admin/admin.router.js')
// const frontendRouter = require('./routes/frontend/frontend.router.js')

//receive video chunks from old pc router 
//
const uploadRouter = require('./routes/upload/upload.router.js')
// const transferRouter = require('./routes/transfer');
const emailRouter = require('./routes/email');
const videometadataRouter = require('./routes/videometadata');
const streamRouter = require('./routes/videostreaming/stream.router.js')
const hlsRouter = require('./routes/videostreaming/hls.router.js')
const backupRouter = require('./routes/backup/backup.router.js')


// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//middleware
app.use(express.json({ limit: '1mb'}));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'))
app.use(compression())

// //database
require('./db/BetterSqliteDatabase.js')

//route
// app.use('/api/v1/auth/', authRouter)
// app.use('/api/v1/user/', userRouter)
// app.use('/api/v1/admin/', adminRouter)
app.use('/api/v1/upload/', uploadRouter)
// app.use('/', frontendRouter) // Frontend routes
// app.use('/api/v1/transfer/', transferRouter);
app.use('/api/v1/email/', emailRouter);
app.use('/api/v1/videometadata', videometadataRouter);
// app.use('/api/v1/stream/', streamRouter)
app.use('/api/v1/stream/hls/', hlsRouter)
app.use('/api/v1/backup/', backupRouter)


//error handling
//not found url error (không rớt vào cái link nào nên mới rớt vô cái middleware này)
app.use((req, res, next) => {
    const NotFound = new NotFoundError()
    next(NotFound) //thảy cho error handling kế tiếp
})
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