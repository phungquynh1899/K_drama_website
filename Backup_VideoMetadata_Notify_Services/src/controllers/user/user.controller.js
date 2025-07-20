`use strict`
const UserService = require('../../services/user/user.service')
const { OK } = require("../../response/success.response")

class UserController {
    static getProfile = async (req, res, next) => {
        return new OK({
            "message" : `Profile retrieved successfully`,
            "metadata": await UserService.getProfile(req) 
        }).send(res)
    }

    static getDashboardStats = async (req, res, next) => {
        return new OK({
            "message" : `Dashboard stats retrieved successfully`,
            "metadata": await UserService.getDashboardStats(req) 
        }).send(res)
    }

    static userProfile = async (req, res, next) => {
        return new OK({
            "message" : `OK`,
            "metadata": await UserService.userProfile(req) 
        }).send(res)
    }

    static updatePassword = async (req, res, next) => {
        return new OK({
            "message" : `Password changed successfully`,
            "metadata": await UserService.updatePassword(req) 
        }).send(res)
    }
    static getUserVideos = async (req, res, next) => {
        return new OK({
            "message" : `User videos retrieved successfully`,
            "metadata": await UserService.getUserVideos(req) 
        }).send(res)
    }

    static deleteUserVideo = async (req, res, next) => {
        return new OK({
            "message" : `Video deleted successfully`,
            "metadata": await UserService.deleteUserVideo(req) 
        }).send(res)
    }

    static deleteAccount = async (req, res, next) => {
        return new OK({
            "message" : `Account deleted successfully`,
            "metadata": await UserService.deleteAccount(req) 
        }).send(res)
    }
}

module.exports = UserController