//nhiệm vụ chính của file server.js là khởi chạy server 
const app = require('./src/app.js')

const PORT = 3002;;
app.listen(PORT, ()=> {
    console.log(`Server B is running on port ${PORT}`)
})