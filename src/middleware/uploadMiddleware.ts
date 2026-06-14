import multer from 'multer';
import { Request } from 'express';
const storage = multer.memoryStorage();
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg','image/png','image/webp','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  cb(null, allowed.includes(file.mimetype));
};
export const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
