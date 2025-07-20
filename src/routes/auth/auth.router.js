const express = require('express')
const authRouter = express.Router()
const AuthController = require('../../controllers/auth/auth.controller')
const asyncHandler = require(`../../utils/asyncHandler.util`)
const authUser = require(`../../middlewares/authUser.middleware`)
const authenticationService = require('../../middlewares/authenticationService.middleware')

//server-server authentication
authRouter.post('/validateUserForExtenalService', authenticationService, authUser, asyncHandler(AuthController.validateUserForExternalService))

authRouter.post('/register', asyncHandler(AuthController.register))
authRouter.post(`/login`, asyncHandler(AuthController.login))
authRouter.post(`/refreshToken`, asyncHandler(AuthController.refreshAccessToken))

authRouter.use(authUser)
//logout bắt buộc phải là chính chủ + đúng thiết bị
authRouter.post(`/logout`, asyncHandler(AuthController.logout))

module.exports = authRouter