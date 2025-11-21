import {
  createProductService,
  getProductService,
  getProductsService,
  deleteProductService,
  updateProductService,
  getAllProductService,
} from "./product.service.js";

export const createProduct = async (req, res, next) => {
  try {
    const data = await createProductService(req.body, req.context.userId);
    res.status(201).json({ message: "Product created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getAllProduct = async (req, res, next) => {
  try {
    const data = await getAllProductService(req.context.userId);
    res.status(200).json({ message: "Products", data });
  } catch (error) {
    next(error);
  }
};

export const getAllProducts = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const data = await getProductsService(search, page, limit, req.context.userId);
    res.status(201).json({ message: "Products", ...data });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req, res, next) => {
  try {
    const data = await getProductService({ id: req.params.productid });
    res.status(201).json({ message: "Product", data });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const data = await updateProductService(req.params.productid, req.body);
    res.status(201).json({ message: "Product updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const data = await deleteProductService({ id: req.params.productid });
    res.status(201).json({ message: "Product deleted successfully", data });
  } catch (error) {
    next(error);
  }
};
