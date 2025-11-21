import models from "../../models/index.js";
import { Op } from "sequelize";

const getModelList = () =>
  Object.keys(models).filter(
    (key) => models[key] && typeof models[key] === "function" && models[key].rawAttributes
  );

const util = {
  logUserAction: async (userId, moduleName, action) => {
    if (!userId) return;
    await models.UserAction.create({ userId, moduleName, action });
  },
  getModelList,
  getTableName: (modelName) => models[modelName]?.getTableName(),
  getColumns: (modelName) => Object.keys(models[modelName]?.rawAttributes ?? {}),
  isDateValid: (dateStr) => !Number.isNaN(new Date(dateStr).getTime()),
  filterUtil: (dataList = []) => {
    let filterList = {};
    const moduleList = getModelList();
    for (const data of dataList) {
      const filter = util.filterService(data, moduleList);
      filterList = { ...filterList, ...filter };
    }
    return filterList;
  },
  filterService: (data, moduleList) => {
    if (!data || moduleList.indexOf(data.moduleName) === -1) {
      return {};
    }
    const fieldList = util.getColumns(data.moduleName);
    if (fieldList.indexOf(data.filterBy) === -1) {
      return {};
    }
    switch (data.controlType) {
      case "inputText":
        if (typeof data.value === "string" && data.value.length !== 0) {
          return {
            [data.filterBy]: {
              [Op.like]: `%${data.value}%`,
            },
          };
        }
        return {};
      case "rangeNumeric":
        if (
          Array.isArray(data.value) &&
          data.value.length === 2 &&
          Number.isInteger(data.value[0]) &&
          Number.isInteger(data.value[1])
        ) {
          return { [data.filterBy]: { [Op.between]: data.value } };
        }
        return {};
      case "rangeDate":
        if (
          Array.isArray(data.value) &&
          data.value.length === 2 &&
          util.isDateValid(data.value[0]) &&
          util.isDateValid(data.value[1])
        ) {
          const to = new Date(data.value[0]);
          const from = new Date(data.value[1]);
          if (from > to) {
            return { [data.filterBy]: { [Op.between]: data.value } };
          }
        }
        return {};
      case "checkbox":
        if (Array.isArray(data.value) && data.value.length <= 10) {
          const hasInvalid = data.value.some((val) => /[^a-zA-Z0-9_]/.test(val));
          if (hasInvalid) {
            return {};
          }
          return { [data.filterBy]: data.value };
        }
        return {};
      default:
        return {};
    }
  },
};

export default util;
