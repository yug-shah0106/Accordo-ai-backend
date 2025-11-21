import { createBenchmarkService } from "./benchmark.service.js";

export const createBenchmark = async (req, res, next) => {
  try {
    const data = await createBenchmarkService({
      userId: req.context.userId,
      requisitionId: req.body.requisitionId,
    });
    res.status(201).json({ message: "Benchmark created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const createFinalBenchmarkResult = async (req, res, next) => {
  try {
    const data = await createBenchmarkService(
      {
        userId: req.context.userId,
        requisitionId: req.body.requisitionId,
      },
      "finalBenchmark"
    );
    res
      .status(201)
      .json({ message: "Final benchmark created successfully", data });
  } catch (error) {
    next(error);
  }
};
