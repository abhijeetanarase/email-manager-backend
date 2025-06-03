import { Router, RequestHandler } from 'express';
import {
  createCredential,
  getAllCredentials,
  getCredentialById,
  updateCredential,
  deleteCredential,
} from '../controller/emailcred';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/',authenticate as RequestHandler, createCredential as RequestHandler);
router.get('/', authenticate as RequestHandler ,getAllCredentials as RequestHandler);
router.get('/:id',authenticate as RequestHandler , getCredentialById as RequestHandler);
router.put('/:id', authenticate as RequestHandler ,updateCredential as RequestHandler);
router.delete('/:id',authenticate as RequestHandler , deleteCredential as RequestHandler);

export default router;
