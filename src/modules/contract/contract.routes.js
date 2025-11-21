import { Router } from "express";
import {
  createContract,
  getAllContract,
  getContract,
  updateContract,
  deleteContract,
  getContractDetails,
  completeContract,
  approveContract,
  updateContractStatus,
} from "./contract.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const contractRouter = Router();

contractRouter.get("/get-contract-details", getContractDetails);
contractRouter.post("/create", authMiddleware, createContract);
contractRouter.get("/get-all", authMiddleware, getAllContract);
contractRouter.get("/get/:contractid", authMiddleware, getContract);
contractRouter.put("/update/:contractid", updateContract);
contractRouter.put("/approve/:contractid", authMiddleware, approveContract);
contractRouter.post("/complete-contract", completeContract);
contractRouter.post("/update-status", updateContractStatus);
contractRouter.delete("/delete/:contractid", authMiddleware, deleteContract);

export default contractRouter;
