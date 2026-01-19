import models from "../../models/index.js";
import { Op } from "sequelize";

/**
 * Filter data structure for filtering operations
 */
interface FilterData {
  moduleName: string;
  filterBy: string;
  controlType: "inputText" | "rangeNumeric" | "rangeDate" | "checkbox";
  value: string | number[] | string[];
}

/**
 * Filter result for Sequelize queries
 */
interface FilterResult {
  [key: string]: unknown;
}

/**
 * Get list of valid Sequelize models from models object
 * @returns Array of model names
 */
const getModelList = (): string[] =>
  Object.keys(models).filter(
    (key) => (models as any)[key] && typeof (models as any)[key] === "function" && (models as any)[key].rawAttributes
  );

const util = {
  /**
   * Log user action to the database
   * @param userId - The user ID performing the action
   * @param moduleName - The module name where action occurred
   * @param action - The action description
   */
  logUserAction: async (userId: number | undefined, moduleName: string, action: string): Promise<void> => {
    if (!userId) return;
    await models.UserAction.create({ userId, moduleName, action });
  },

  getModelList,

  /**
   * Get table name for a given model
   * @param modelName - The model name
   * @returns Table name or undefined
   */
  getTableName: (modelName: string): string | undefined => (models as any)[modelName]?.getTableName(),

  /**
   * Get column names for a given model
   * @param modelName - The model name
   * @returns Array of column names
   */
  getColumns: (modelName: string): string[] => Object.keys((models as any)[modelName]?.rawAttributes ?? {}),

  /**
   * Check if a date string is valid
   * @param dateStr - Date string to validate
   * @returns True if valid date
   */
  isDateValid: (dateStr: string): boolean => !Number.isNaN(new Date(dateStr).getTime()),

  /**
   * Build filter object from array of filter data
   * @param dataList - Array of filter data objects
   * @returns Sequelize filter object
   */
  filterUtil: (dataList: FilterData[] = []): FilterResult => {
    let filterList: FilterResult = {};
    const moduleList = getModelList();
    for (const data of dataList) {
      const filter = util.filterService(data, moduleList);
      filterList = { ...filterList, ...filter };
    }
    return filterList;
  },

  /**
   * Build individual filter condition based on control type
   * @param data - Filter data object
   * @param moduleList - List of valid module names
   * @returns Sequelize filter condition
   */
  filterService: (data: FilterData, moduleList: string[]): FilterResult => {
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
          util.isDateValid(data.value[0] as string) &&
          util.isDateValid(data.value[1] as string)
        ) {
          const to = new Date(data.value[0] as string);
          const from = new Date(data.value[1] as string);
          if (from > to) {
            return { [data.filterBy]: { [Op.between]: data.value } };
          }
        }
        return {};
      case "checkbox":
        if (Array.isArray(data.value) && data.value.length <= 10) {
          const hasInvalid = data.value.some((val) => /[^a-zA-Z0-9_]/.test(val as string));
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
