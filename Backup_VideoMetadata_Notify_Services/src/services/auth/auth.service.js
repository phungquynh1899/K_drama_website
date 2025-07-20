const { ConflictError, InternalServerError, BadRequestError, NotFoundError, ForbiddenError } = require(`../../response/error.response`)
const bcrypt = require(`bcrypt`)
const crypto = require(`crypto`)
const jwt = require(`jsonwebtoken`)
const BetterSqliteDatabase = require(`../../db/BetterSqliteDatabase`)

class AuthService {
    static register = async ({ email, password }) => {
        const db = BetterSqliteDatabase.getInstance();
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            throw new ConflictError('This email has been used, please try again');
        }
        const hashPassword = await bcrypt.hash(password, 10);
        const newUser = await db.createUser({
            email,
            password_hash: hashPassword,
            is_active: 1
        });
        return {
            user: { id: newUser.id, email: newUser.email }
        };
    }

    static login = async ({ email, password }) => {
        const db = BetterSqliteDatabase.getInstance();
        const user = await db.getUserByEmail(email);
        if (!user) throw new BadRequestError('Invalid credentials');
        await db.deleteRefreshTokenByUserId(user.id);
        await db.deleteKeyPairByUserId(user.id);
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) throw new BadRequestError('Invalid credentials');
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
        });
        await db.createKeyPair({
            user_id: user.id,
            public_key: publicKey,
            private_key: privateKey,
            is_active: 1
        });
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email },
            privateKey,
            { algorithm: 'RS256', expiresIn: '3d' }
        );
        const refreshToken = jwt.sign(
            { userId: user.id, email: user.email },
            privateKey,
            { algorithm: 'RS256', expiresIn: '7d' }
        );
        await db.createRefreshToken({
            user_id: user.id,
            refresh_token: refreshToken,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
        return {
            user: { id: user.id, email: user.email },
            accessToken,
            refreshToken
        };
    }

    static logout = async ({ userId }) => {
        const db = BetterSqliteDatabase.getInstance();
        await db.deleteRefreshTokenByUserId(userId);
        await db.deleteKeyPairByUserId(userId);
        return 'OK';
    }

    static refreshAccessToken = async ({ refreshToken }) => {
        const db = BetterSqliteDatabase.getInstance();
        if (!refreshToken) throw new BadRequestError('Refresh token is required');
        // lưu ý: gửi rt khi ac hết hạn, không qua nổi ải của authUser 
        //tại sao cần check rt có tồn tại trong db không? 
        // trường hợp đăng nhập lần 1, có ai đó đánh cắp rt11 của user ở lần 1
        // sau đó user logout , rồi user đăng nhập lại , user giữ rt2, hacker giữ rt1
        // nếu mình không check rt1 có trong db không, mình sẽ mù quáng cấp at cho hacker 
        //nếu mình có check , mình thấy, à, rt trong db hiện tại là rt2 
        //mà cái mình nhận là rt1 ==> hacker 
        //check rt tồn tại trong db không để xác nhận rt này là của lần đăng nhập mới nhấtnhất
        //tại sao cần lưu rt trong db?
        // trường hợp đăng nhập lần 1, có ai đó đánh cắp rt của user ở lần 1
        // sau đó user logout , hacker dùng rt bị đánh cắp để xin at mới 
        // nên mình lưu rt trong db + trạng thái (đã vô hiệuhiệu, khả dụng)
        // mình check thì thấy rt đã bị vô hiệu do user đã logout
        // mà có đứa nào còn gửi rt cũ tới ==> chỉ có hacker thôi 
        // lưu rt trong db để theo dõi trạng thái của rt 

        const storedToken = await db.getRefreshTokenByToken(refreshToken);
        if (!storedToken) throw new BadRequestError('Invalid refresh token');
        if (new Date(storedToken.expires_at) < new Date()) {
            await db.deleteRefreshTokenByToken(refreshToken);
            throw new BadRequestError('Refresh token has expired');
        }
        const keyPair = await db.getKeyPairByUserId(storedToken.user_id);
        if (!keyPair) throw new BadRequestError('Key pair not found for this user');
        const decoded = jwt.verify(refreshToken, keyPair.public_key, { algorithms: ['RS256'] });
        const newAccessToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email },
            keyPair.private_key,
            { algorithm: 'RS256', expiresIn: '3d' }
        );
        return { accessToken: newAccessToken };
    }
}

module.exports = AuthService