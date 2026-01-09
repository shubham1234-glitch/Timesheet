import { Router } from 'express';
import { fetchChallenges } from '../controllers/challengesController.js';

const router = Router();

// GET /api/v1/timesheet/get_challenges?parent_type=TASK&parent_code=123
router.get('/get_challenges', fetchChallenges);

export default router;



