import express from 'express';
import { fetchPredefinedEpics, fetchPredefinedEpicById } from '../controllers/predefinedEpicController.js';

const router = express.Router();

router.get('/get_predefined_epics', fetchPredefinedEpics);
router.get('/get_predefined_epics/:predefined_epic_id', fetchPredefinedEpicById);

export default router;

