`use strict`
const { CREATED, OK } = require("../../response/success.response")
const { validateDataForRegister, validateDataForLogin, validateDataForUpdateEmail } = require('../../utils/validator.util')
const AuthService = require('../../services/auth/auth.service')


class AuthController {
    static register = async (req, res, next) => {
        //kiểm tra các trường dữ liệu
        if (validateDataForRegister(req)) {
            return new CREATED({
                "message": "Register successfully, please login",
                "metadata": await AuthService.register(req.body)
            }).
                send(res)
        }
        // If validation fails, the error will be thrown by validateDataForRegister
    }

    static login = async (req, res, next) => {
        if(validateDataForLogin(req)){
            return new OK({
                "message": `Login successfully`,
                "metadata": await AuthService.login(req.body)
            })
            .send(res)
            //kiểm tra email, password có trong database
            //đúng thì cấp lại rt,at
        }
        // If validation fails, the error will be thrown by validateDataForLogin
    }

    static logout = async (req, res, next) => {
        console.log('in logout')
            return new OK({
                "message": `Logout successfully`,
                "metadata": await AuthService.logout(req)
            })
            .send(res)
    }
    
    static refreshAccessToken = async (req, res, next ) => {
        return new CREATED({
            "message" : `New access token created`,
            "metadata": await AuthService.refreshAccessToken(req.body)
        }).send(res)
    }

    static validateUserForExternalService = async (req, res)=>{
        return new OK({
            "message": `User authenticated successfully`,
            "metadata": await AuthService.validateUserForExternalService(req)
        }).send(res)
    }




}

module.exports = AuthController