//nhiệm vụ chính của file server.js là khởi chạy server 
const app = require('./src/app.js')

const PORT = 3003;
app.listen(PORT, ()=> {
    console.log(`Server is running on port ${PORT}`)
})