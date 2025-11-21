export const cleanJson = (req, _res, next) => {
  const clean = (obj) => {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (
        value === null ||
        value === "" ||
        value === "null" ||
        value === "undefined"
      ) {
        delete obj[key];
      } else if (typeof value === "object") {
        clean(value);
      }
    });
  };

  if (req.body && typeof req.body === "object") {
    clean(req.body);
  }

  next();
};

export default cleanJson;
