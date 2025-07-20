
const {StatusCodes, ReasonPhrases} = require('http-status-codes')

class ErrorResponse extends Error{
    constructor(message, status){
        super(message)
        this.status = status
    }
    send(res, header = {}){
        return res.status(this.status).json(this)
    }
}

class BadRequestError extends ErrorResponse{
    constructor(message = ReasonPhrases.BAD_REQUEST, status = StatusCodes.BAD_REQUEST){
        super(message, status)
    }
}

class ForbiddenError extends ErrorResponse{
    constructor(message = ReasonPhrases.FORBIDDEN, status = StatusCodes.FORBIDDEN){
        super(message, status)
    }
}

class UnauthorizeError extends ErrorResponse{
    constructor(message = ReasonPhrases.UNAUTHORIZED, status = StatusCodes.UNAUTHORIZED){
        super(message, status)
    }
}

class UnauthenticatedError extends ErrorResponse{
    constructor(message = ReasonPhrases.UNAUTHORIZED, status = StatusCodes.UNAUTHORIZED){
        super(message, status)
    }
}

class NotFoundError extends ErrorResponse{
    constructor(message = ReasonPhrases.NOT_FOUND, status = StatusCodes.NOT_FOUND){
        super(message, status)
    }
}

class InternalServerError extends ErrorResponse{
    constructor(message = ReasonPhrases.INTERNAL_SERVER_ERROR, status = StatusCodes.INTERNAL_SERVER_ERROR){
        super(message, status)
    }
}

class ConflictError extends ErrorResponse{
    constructor(message = ReasonPhrases.CONFLICT, status = StatusCodes.CONFLICT){
        super(message, status)
    }
}

module.exports = { BadRequestError, ForbiddenError, UnauthorizeError, UnauthenticatedError, NotFoundError, InternalServerError, ConflictError }