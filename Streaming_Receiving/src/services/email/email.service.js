const nodemailer = require('nodemailer');
require('dotenv').config();

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

exports.sendEmail = async ({ to, subject, text }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
      },
    });
    await transporter.sendMail({
      from: GMAIL_USER,
      to,
      subject,
      text,
    });
    return { status: 200, message: 'Email sent', to };
  } catch (err) {
    return { status: 500, message: 'Failed to send email', error: err.message };
  }
}; 