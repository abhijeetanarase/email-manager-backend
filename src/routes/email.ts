import express, { RequestHandler } from 'express';
import { getEmailsByCredentialId, sendMail, starEmail } from '../controller/email';
import { authenticate } from '../middlewares/auth';
import { fetch30DaysLast } from '../controller/emailcred';

const router = express.Router();

// GET /api/email/:id
router.get('/:id', authenticate as RequestHandler, getEmailsByCredentialId as RequestHandler);
router.post('/', authenticate as RequestHandler, sendMail as RequestHandler);
router.patch('/star/:emailId', authenticate as RequestHandler, starEmail as RequestHandler);
router.post('/fetch/:id' , authenticate as RequestHandler , fetch30DaysLast as RequestHandler );

export default router;
