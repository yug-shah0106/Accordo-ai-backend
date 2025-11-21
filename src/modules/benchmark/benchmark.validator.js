import Joi from "joi";

const options = {
  errors: {
    wrap: {
      label: "",
    },
  },
};

export const validateCreateBenchmark = (benchmarkData) => {
  const schema = Joi.object({
    requisitionId: Joi.number().integer().required(),
  });

  return schema.validate(benchmarkData, options);
};
