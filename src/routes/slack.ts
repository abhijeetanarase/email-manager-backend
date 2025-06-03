import { RequestHandler, Router } from 'express';
import {
  installSlackApp,
  handleOAuthCallback,
  sendTestNotification
} from '../controller/slack';

const router = Router();

router.get('/install', installSlackApp);
router.get('/notify', sendTestNotification as RequestHandler); 
router.get('/oauth/callback', handleOAuthCallback as RequestHandler);
// pass ?team_id=T123

export default router;
