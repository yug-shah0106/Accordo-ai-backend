import jwt from "jsonwebtoken";

export const generateJWT = async (payload, secretKey, options = {}) => {
  try {
    const token = jwt.sign(payload, secretKey, options);
    return `Bearer ${token}`;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const verifyJWT = async (token, secretKey, options = {}) => {
  try {
    const cleanedToken = token.replace(/^Bearer\s+/i, "");
    const data = jwt.verify(cleanedToken, secretKey, options);
    if (typeof data === "string") {
      throw new Error("Invalid token payload");
    }
    return data;
  } catch (error) {
    throw new Error(error.message);
  }
};
