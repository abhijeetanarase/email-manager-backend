import express, { RequestHandler } from 'express';
import { getEmailsByCredentialId, sendMail, starTrashArchiveEmail, getEmailCounts, bulkUpdateEmails } from '../controller/email';
import { authenticate } from '../middlewares/auth';
import { fetch30DaysLast } from '../controller/emailcred';

const router = express.Router();

// GET /api/email/:id
router.get('/counts/:id', authenticate as RequestHandler, getEmailCounts as RequestHandler);
router.get('/:id', authenticate as RequestHandler, getEmailsByCredentialId as RequestHandler);
router.post('/', authenticate as RequestHandler, sendMail as RequestHandler);
router.patch('/status/:emailId', authenticate as RequestHandler, starTrashArchiveEmail as RequestHandler);
router.post('/fetch/:id' , authenticate as RequestHandler , fetch30DaysLast as RequestHandler );
router.post('/bulk-update', authenticate as RequestHandler, bulkUpdateEmails as RequestHandler);


export default router;
