import bcrypt from "bcrypt";

export const hashPassword = async (password) => bcrypt.hash(password, 10);

export const findOrCreateBulk = async (Model, items, uniqueKey, options = {}) => {
  for (const item of items) {
    const where =
      typeof uniqueKey === "function" ? uniqueKey(item) : { [uniqueKey]: item[uniqueKey] };
    await Model.findOrCreate({
      where,
      defaults: item,
      ...options,
    });
  }
};
