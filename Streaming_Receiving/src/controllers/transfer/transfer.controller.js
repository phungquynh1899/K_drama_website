const transferService = require('../../services/transfer/transfer.service');

exports.notifyChunksReady = async (req, res, next) => {
  try {
    const result = await transferService.handleTransferWorkflow(req.body);
    res.status(result.status || 200).json(result);
  } catch (error) {
    next(error);
  }
}; 