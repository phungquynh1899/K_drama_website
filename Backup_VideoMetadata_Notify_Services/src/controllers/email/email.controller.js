const emailService = require('../../services/email/email.service');

exports.sendEmail = async (req, res, next) => {
  try {
    const { to, subject, text } = req.body;
    const result = await emailService.sendEmail({ to, subject, text });
    res.status(result.status || 200).json(result);
  } catch (error) {
    next(error);
  }
}; 