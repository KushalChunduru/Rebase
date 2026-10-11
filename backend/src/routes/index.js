import { Router } from 'express';
import dependenciesRouter from './dependencies.js';
import pipelineRouter from './pipeline.js';
import observationsRouter from './observations.js';

const router = Router();

router.use('/dependencies', dependenciesRouter);
router.use('/pipeline', pipelineRouter);
router.use('/observations', observationsRouter);

export default router;
