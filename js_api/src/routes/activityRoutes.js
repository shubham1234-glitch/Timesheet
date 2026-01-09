import { Router } from 'express';
import { fetchActivity, fetchOutdoorActivities } from '../controllers/activityController.js';

const router = Router();

// GET /api/v1/timesheet/get_activity?parent_type=EPIC|TASK&parent_code=ID&limit=&offset=
router.get('/get_activity', fetchActivity);

// GET /api/v1/timesheet/get_outdoor_activities?product_code=&is_billable=&created_by=&created_at_from=&created_at_to=&limit=&offset=
router.get('/get_outdoor_activities', fetchOutdoorActivities);

export default router;


