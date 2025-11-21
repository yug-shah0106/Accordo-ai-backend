import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import companyRoutes from "../modules/company/company.routes.js";
import requisitionRoutes from "../modules/requisition/requisition.routes.js";
import contractRoutes from "../modules/contract/contract.routes.js";
import poRoutes from "../modules/po/po.routes.js";
import vendorRoutes from "../modules/vendor/vendor.routes.js";
import productRoutes from "../modules/product/product.routes.js";
import projectRoutes from "../modules/project/project.routes.js";
import roleRoutes from "../modules/role/role.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import customerRoutes from "../modules/customer/customer.routes.js";
import benchmarkRoutes from "../modules/benchmark/benchmark.routes.js";
import permissionRoutes from "../modules/permission/permission.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/company", companyRoutes);
router.use("/requisition", requisitionRoutes);
router.use("/contract", contractRoutes);
router.use("/po", poRoutes);
router.use("/vendor", vendorRoutes);
router.use("/product", productRoutes);
router.use("/project", projectRoutes);
router.use("/role", roleRoutes);
router.use("/user", userRoutes);
router.use("/customer", customerRoutes);
router.use("/benchmark", benchmarkRoutes);
router.use("/permission", permissionRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
