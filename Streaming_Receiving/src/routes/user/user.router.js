const express = require('express')
const userRouter = express.Router()
const UserController = require('../../controllers/user/user.controller')
const asyncHandler = require(`../../utils/asyncHandler.util`)
const authUser = require(`../../middlewares/authUser.middleware`)

userRouter.use(authUser)

userRouter.get(`/profile`, asyncHandler(UserController.getProfile))
userRouter.get(`/dashboard-stats`, asyncHandler(UserController.getDashboardStats))
userRouter.get(`/videos`, asyncHandler(UserController.getUserVideos))
userRouter.delete(`/videos/:id`, asyncHandler(UserController.deleteUserVideo))
userRouter.get(`/:id`, asyncHandler(UserController.userProfile))
userRouter.put(`/updatePassword`, asyncHandler(UserController.updatePassword))
userRouter.delete(`/deleteAccount`, asyncHandler(UserController.deleteAccount))

module.exports = userRouter