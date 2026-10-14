import express from 'express';
import { getTags } from '../controllers/tagsController';

const router = express.Router();

router.get('/', getTags);

export default router;