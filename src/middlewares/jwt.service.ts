import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';

export interface TokenPayload extends JwtPayload {
  userId: number;
  userType: string;
  companyId?: number;
  email?: string;
}

export const generateJWT = async (
  payload: object,
  secretKey: string,
  options: SignOptions = {}
): Promise<string> => {
  try {
    const token = jwt.sign(payload, secretKey, options);
    return `Bearer ${token}`;
  } catch (error) {
    throw new Error((error as Error).message);
  }
};

export const verifyJWT = async (
  token: string,
  secretKey: string,
  options: VerifyOptions = {}
): Promise<TokenPayload> => {
  try {
    const cleanedToken = token.replace(/^Bearer\s+/i, '');
    const data = jwt.verify(cleanedToken, secretKey, options);
    if (typeof data === 'string') {
      throw new Error('Invalid token payload');
    }
    return data as TokenPayload;
  } catch (error) {
    throw new Error((error as Error).message);
  }
};
