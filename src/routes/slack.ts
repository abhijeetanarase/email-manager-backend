import { RequestHandler, Router } from 'express';
import {
  installSlackApp,
  handleOAuthCallback,
  sendTestNotification
} from '../controller/slack';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/install' ,authenticate as RequestHandler, installSlackApp);
router.get('/notify', sendTestNotification as RequestHandler); 
router.get('/oauth/callback', handleOAuthCallback as RequestHandler);
// pass ?team_id=T123

export default router;
