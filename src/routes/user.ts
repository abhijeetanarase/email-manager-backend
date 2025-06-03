import express, { RequestHandler } from 'express';
import { redirectToGoogle, googleAuthCallback, getUserProfile , checkAuth} from '../controller/user';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// Route to initiate Google OAuth
router.get('/google', redirectToGoogle);

// Route to handle the callback from Google OAuth
router.get('/google/callback', googleAuthCallback);

// Route to get the authenticated user's profile
router.get('/profile', authenticate as RequestHandler, getUserProfile as RequestHandler);
router.get('/check-auth', checkAuth as RequestHandler);

export default router;
