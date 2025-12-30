import sequelize from "../config/database.js";

import * as authTokenModule from "./authToken.js";
import * as companyModule from "./company.js";
import * as contractModule from "./contract.js";
import * as moduleModule from "./module.js";
import * as otpModule from "./otp.js";
import * as poModule from "./po.js";
import * as productModule from "./product.js";
import * as projectModule from "./project.js";
import * as projectPocModule from "./projectPoc.js";
import * as requisitionModule from "./requisition.js";
import * as requisitionAttachmentModule from "./requisitionAttachment.js";
import * as requisitionProductModule from "./requisitionProduct.js";
import * as roleModule from "./role.js";
import * as rolePermissionModule from "./rolePermission.js";
import * as userModule from "./user.js";
import * as userActionModule from "./userAction.js";
import * as vendorCompanyModule from "./vendorCompany.js";
import * as negotiationModule from "./negotiation.js";
import * as negotiationRoundModule from "./negotiationRound.js";
import * as preferenceModule from "./preference.js";
import * as chatSessionModule from "./chatSession.js";
import * as emailLogModule from "./emailLog.js";

const resolveModelFactory = (module) => module.default || module;

const models = {};

models.User = resolveModelFactory(userModule)(sequelize);
models.Otp = resolveModelFactory(otpModule)(sequelize);
models.Po = resolveModelFactory(poModule)(sequelize);
models.Role = resolveModelFactory(roleModule)(sequelize);
models.UserAction = resolveModelFactory(userActionModule)(sequelize);
models.RolePermission = resolveModelFactory(rolePermissionModule)(sequelize);
models.Module = resolveModelFactory(moduleModule)(sequelize);
models.AuthToken = resolveModelFactory(authTokenModule)(sequelize);
models.Product = resolveModelFactory(productModule)(sequelize);
models.Company = resolveModelFactory(companyModule)(sequelize);
models.Project = resolveModelFactory(projectModule)(sequelize);
models.ProjectPoc = resolveModelFactory(projectPocModule)(sequelize);
models.Requisition = resolveModelFactory(requisitionModule)(sequelize);
models.RequisitionProduct = resolveModelFactory(requisitionProductModule)(sequelize);
models.RequisitionAttachment = resolveModelFactory(requisitionAttachmentModule)(sequelize);
models.Contract = resolveModelFactory(contractModule)(sequelize);
models.VendorCompany = resolveModelFactory(vendorCompanyModule)(sequelize);
models.Negotiation = resolveModelFactory(negotiationModule)(sequelize);
models.NegotiationRound = resolveModelFactory(negotiationRoundModule)(sequelize);
models.Preference = resolveModelFactory(preferenceModule)(sequelize);
models.ChatSession = resolveModelFactory(chatSessionModule)(sequelize);
models.EmailLog = resolveModelFactory(emailLogModule)(sequelize);

// Maintain legacy aliases
models.Vendor = models.User;
models.vendorCompany = models.VendorCompany;

const uniqueModels = new Set(Object.values(models));
uniqueModels.forEach((model) => {
  if (model && typeof model.associate === "function") {
    model.associate(models);
  }
});

export { sequelize };
export default models;

