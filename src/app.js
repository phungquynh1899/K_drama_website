// 4 nhiệm vụ của file app.js 
// middleware
// route
// database 
// error handling 

const express = require('express');
const app = express();

//middleware
app.use(express.json());

//route
app.use('/', (req, res, next)=> {
    res.status(200).json({message: 'Hello World'})
})

//database
const db =require('./db/BetterSQLiteDatabase.js')
db

//error handling
app.use((err, req, res, next)=> {
    res.status(500).json({message: 'Internal server error'})})

module.exports = app;