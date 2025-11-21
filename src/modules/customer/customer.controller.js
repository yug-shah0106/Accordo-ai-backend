import {
  getCustomersService,
  getAllCustomerService,
} from "./customer.service.js";
import { createUserService, updateUserService } from "../user/user.service.js";

export const getAllCustomers = async (req, res, next) => {
  try {
    const data = await getCustomersService(req.context.userId);
    res.status(200).json({ message: "Customers", data });
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const customers = await getAllCustomerService(search, page, limit);
    res.status(201).json({ message: "Customers", customers });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req, res, next) => {
  try {
    const customerData = { ...req.body, userType: "customer" };
    const data = await createUserService(customerData, req.context.userId);
    res.status(201).json({ message: "Customer created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const data = await updateUserService(req.params.customerid, req.body);
    res.status(201).json({ message: "Customer updated successfully", data });
  } catch (error) {
    next(error);
  }
};
