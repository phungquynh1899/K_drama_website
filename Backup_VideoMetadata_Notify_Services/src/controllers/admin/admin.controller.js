const AdminService = require('../../services/admin/admin.service')
const { OK } = require("../../response/success.response")

class AdminController {
    static adminBlocking = async (req, res, next) => {
        return new OK({
            "message" : `Admin blocking successfully`,
            "metadata": await AdminService.adminBlocking(req) 
        }).send(res)
    }

    static adminUnblocking = async (req, res, next) => {
        return new OK({
            "message" : `Admin unblocking successfully`,
            "metadata": await AdminService.adminUnblocking(req) 
        }).send(res)
    }

    static getAllUsersForAdmin = async (req, res, next) => {
        return new OK({
            "message" : `Fetched users for admin successfully`,
            "metadata": await AdminService.getAllUsersForAdmin(req) 
        }).send(res)
    }
}

module.exports = AdminController