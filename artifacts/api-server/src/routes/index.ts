import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fixoraRouter from "./fixora";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fixoraRouter);

export default router;
