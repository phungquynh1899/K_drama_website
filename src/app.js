// 4 nhiệm vụ của file app.js 
// middleware
// route
// database 
// error handling 
// set up view engine (nếu cần ejs)

//This line reads the .env file and puts each variable into process.env.
//process.env là 1 object để lưu environment variable
//sau khi load .env file, mình có thể truy cập biến bằng process.env.TÊN_BIẾN
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const { NotFoundError } = require('./response/error.response.js');
const morgan = require('morgan');
const compression = require('compression');

// router
const authRouter = require('./routes/auth/auth.router.js')
const userRouter = require('./routes/user/user.router.js')
const adminRouter = require('./routes/admin/admin.router.js')
// const uploadRouter = require('./routes/upload/upload.router.js')
const seriesRouter = require('./routes/series/series.router.js')
const thumbnailRouter = require('./routes/thumbnail/thumbnail.router.js')
const frontendRouter = require('./routes/frontend/frontend.router.js')
const transferRouter = require('./routes/transfer/transfer.router.js')
const videometadataRouter = require('./routes/videometadata/videometadata.router.js')
// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//middleware
app.use(express.json({ limit: '20kb'}));
app.use(express.urlencoded({ limit: '20kb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'))
app.use(compression())
//middle này để truyền các biến môi trường vào ejs để sử dụng 
app.use((req, res, next) => {
    res.locals.NGINX_URL = process.env.NGINX_URL;
    res.locals.UPLOAD_API_BASE_URL = process.env.UPLOAD_API_BASE_URL;
    next();
  });
// //database
require('./db/BetterSqliteDatabase.js')

//route
app.use('/api/v1/auth/', authRouter)
app.use('/api/v1/user/', userRouter)
app.use('/api/v1/admin/', adminRouter)
//nhận file từ user tải lên máy server A tạm thời 
// app.use('/api/v1/upload/', uploadRouter)
app.use('/api/v1/seriesInfo/', seriesRouter)
app.use('/api/v1/thumbnail/', thumbnailRouter)
//gửi file từ server A sang cho server B
// app.use('/api/v1/transfer/', transferRouter)
app.use('/api/v1/metadata/', videometadataRouter)
//thumbnail management
app.use('/', frontendRouter) 

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