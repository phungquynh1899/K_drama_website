//nhiệm vụ chính của file server.js là khởi chạy server 
const app = require('./src/app.js')

const PORT = 3000;;
app.listen(PORT, ()=> {
    console.log(`Server A is running on port ${PORT}`)
})