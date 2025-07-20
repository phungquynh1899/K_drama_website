const express = require('express')
const adminRouter = express.Router()
const AdminController = require(`../../controllers/admin/admin.controller`)
const asyncHandler = require(`../../utils/asyncHandler.util`)
const authUser = require(`../../middlewares/authUser.middleware`)
const authAdmin = require(`../../middlewares/authAdmin.middleware`)

adminRouter.use(authUser)
adminRouter.use(authAdmin)
adminRouter.put(`/adminBlocking/:id`, asyncHandler(AdminController.adminBlocking))
adminRouter.put(`/adminUnblocking/:id`, asyncHandler(AdminController.adminUnblocking))
adminRouter.get('/getAllUsersForAdmin', asyncHandler(AdminController.getAllUsersForAdmin))

module.exports = adminRouter