import express from 'express';
import { fetchEpicById, fetchEpics } from '../controllers/epicController.js';

const router = express.Router();

router.get('/get_epics', fetchEpics);
router.get('/get_epics/:epic_id', fetchEpicById);

export default router;
