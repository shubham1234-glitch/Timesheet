import { Router } from 'express';
import { fetchComments } from '../controllers/commentsController.js';

const router = Router();

// GET /api/v1/timesheet/get_comments?parent_type=TASK&parent_code=123
router.get('/get_comments', fetchComments);

export default router;


