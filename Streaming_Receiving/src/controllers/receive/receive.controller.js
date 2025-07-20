const receiveService = require('../../services/receive/receive.service');

exports.receiveChunk = (req, res, next) => {
    receiveService.receiveChunk(req, res, next);
}; 