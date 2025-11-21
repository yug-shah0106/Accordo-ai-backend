import multer from "multer";
import path from "path";

const uploadPath = path.resolve(process.cwd(), "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".svg"];

const fileFilter = (_req, file, cb) => {
  if (!imageExtensions.includes(path.extname(file.originalname).toLowerCase())) {
    cb(new Error("You can upload only image!"), false);
  } else {
    cb(null, true);
  }
};

export const upload = multer({ storage, fileFilter });
