
const { StatusCodes, ReasonPhrases } = require('http-status-codes')

class SuccessResponse {
    constructor({message, status = StatusCodes.OK, reason = ReasonPhrases.OK, metadata = {}}){
        this.message = message || reason
        this.status = status
        this.metadata = metadata
    }

    send(res, header = {}){
        return res.status(this.status).json(this)
    }
}

class OK extends SuccessResponse {
    constructor({message, status = StatusCodes.OK, reason = ReasonPhrases.OK, metadata = {}}){
        super({message, status, reason, metadata})
    }
}

class CREATED extends SuccessResponse {
    constructor({message, status = StatusCodes.CREATED, reason = ReasonPhrases.CREATED, metadata = {}}){
        super({message, status, reason, metadata})
    }
}

module.exports = {OK, CREATED}