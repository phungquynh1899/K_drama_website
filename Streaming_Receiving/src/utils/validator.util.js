const {BadRequestError} = require(`../response/error.response`)
const validator = require(`validator`)

const validateDataForRegister = (req) => {
    const {email, password} = req.body
    if(!email || typeof email != `string` || email.trim() == ''){
        throw new BadRequestError('Email is required')
    }
    if(!validator.isEmail(email)){
        throw new BadRequestError('Invalid email address')
    }
    if(!password || typeof password != `string` || password.trim() == ''){
        throw new BadRequestError(`Password is required`)
    }
    if(!validator.isLength(password, {min: 6})){
        throw new BadRequestError(` Password must be at least 6 characters long`)
    }
    return true;
}

const validateDataForLogin = (req) => {
    const { email, password } = req.body;
  
    // Validate email
    if (!email || typeof email !== 'string' || email.trim() === '') {
      throw new BadRequestError('Email is required');
    }
    if (!validator.isEmail(email)) {
      throw new BadRequestError('Invalid email address');
    }
  
    // Validate password
    if (!password || typeof password !== 'string' || password.trim() === '') {
      throw new BadRequestError('Password is required');
    }
  
    return true;
  };
  


//kiểm tra xem dữ liệu gửi tới có đầy đủ các trường không
//nếu dư hoặc thiếu đều bị mời về :>
const validateDataForProfile = (req) => {
    const ALLOW_EDIT_DATA = [`firstName`, `lastName`, `profilePhoto`]
    const isAllowedToEdit = Object.keys(req.body).every(field => {
        return ALLOW_EDIT_DATA.includes(field)
    })
    return isAllowedToEdit
    
}

const validateDataForUpdateEmail = (req) => {
    const {email} = req.body
    if(!email || typeof email != `string` || email.trim() == ''){
        throw new BadRequestError('Email is required')
    }
    if(!validator.isEmail(email)){
        throw new BadRequestError('Invalid email address')
    }
    return true
}


module.exports = { validateDataForRegister, validateDataForLogin, validateDataForProfile, validateDataForUpdateEmail }