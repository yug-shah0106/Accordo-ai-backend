import {
  getUserProfileService,
  createUserService,
  assignRoleService,
  getUserService,
  updateUserService,
  getAllUsersService,
} from "./user.service.js";

export const updateProfile = async (req, res, next) => {
  try {
    const userData = {
      ...req.body,
      userId: req.body.userId ?? req.context.userId,
    };

    if (req.files?.length) {
      userData.profilePic = req.files[0].filename;
    }

    const data = await updateUserService(userData.userId, userData);
    res.status(201).json({ message: "Profile updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getUserProfileController = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const accessToken = authorization.split(" ")[1];
    const data = await getUserProfileService(accessToken);
    data.password = undefined;
    res.status(200).json({ message: "User data fetched", data });
  } catch (error) {
    next(error);
  }
};

export const assignRole = async (req, res, next) => {
  try {
    const { userId, roleId } = req.body;
    const data = await assignRoleService(userId, roleId);
    res.status(200).json({ message: "Role assigned successfully", data });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const userData = { ...req.body };
    if (req.files?.length) {
      userData.profilePic = req.files[0].filename;
    }
    const data = await createUserService(userData, req.context.userId);
    res.status(201).json({ message: "User created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10, filters } = req.query;
    const data = await getAllUsersService(search, page, limit, req.context.userId, filters);
    res.status(200).json({ message: "User", ...data });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const data = await getUserService(req.params.userid);
    res.status(201).json({ message: "User", data });
  } catch (error) {
    next(error);
  }
};

export const getUserRolePermission = async (req, res, next) => {
  try {
    const data = await getUserService(req.params.userid);
    res.status(201).json({ message: "User Role Permission", data });
  } catch (error) {
    next(error);
  }
};
