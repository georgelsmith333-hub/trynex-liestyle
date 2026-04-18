import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const hasObjectStorage = !!(
  process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID &&
  process.env.PRIVATE_OBJECT_DIR
);

if (!hasObjectStorage) {
  router.all("/storage/*path", (_req: Request, res: Response) => {
    res.status(503).json({ error: "Object storage not configured on this host" });
  });
}

export default router;
export { hasObjectStorage };
