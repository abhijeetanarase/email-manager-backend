import Imap from 'imap';
import EmailCredential from '../model/emailcred';
import Email from '../model/email';
import { simpleParser } from 'mailparser';
require('dotenv').config(); // Ensure you have dotenv installed and configured
import cloudinary from 'cloudinary';
import makeCategoryPrompt from './categoryPrompt';
import { callOpenRouter } from './replyGeneration';


interface EmailConfig {
  email: string;
  password: string;
  credId?: string; // Optional, if you want to associate with a specific credential
}

// Configure cloudinary (make sure to set your env variables)
console.log('Configuring Cloudinary with environment variables...');
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  throw new Error('Missing Cloudinary environment variables');
}
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

async function uploadAttachmentToCloudinary(buffer: Buffer, filename: string, contentType: string) {
  // Determine resource_type based on contentType
  let resourceType: 'image' | 'video' | 'raw' = 'raw';
  if (contentType.startsWith('image/')) {
    resourceType = 'image';
  } else if (contentType.startsWith('video/')) {
    resourceType = 'video';
  }

  // Ensure filename has correct extension only if not already present
  let finalFilename = filename;
  if (contentType === 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
    finalFilename = filename + '.pdf';
  }
  // You can add more contentType/extension checks here if needed

  return new Promise<string>((resolve, reject) => {
    cloudinary.v2.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: finalFilename,
        folder: 'email_attachments',
        overwrite: true,
        format: undefined, // Let Cloudinary infer from filename
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result?.secure_url || '');
      }
    ).end(buffer);
  });
}

 function connectAndWatchEmails({ email, password , credId }: EmailConfig): void {
  const imap = new Imap({
    user: email,
    password: password,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });

  let lastTotal = 0;

  function openInbox(cb: (err: Error | null, box?: Imap.Box) => void) {
    imap.openBox('INBOX', false, cb);
  }

  imap.once('ready', () => {
    openInbox((err, box) => {
      if (err) throw err;
      if (!box) throw new Error('Inbox box is undefined');

      lastTotal = box.messages.total;
      console.log(`Connected to INBOX with ${lastTotal} messages.`);

      imap.on('mail', (numNewMsgs: any) => {
        console.log(`📬 New mail arrived: ${numNewMsgs} new message(s).`);

        const fetchFrom = lastTotal + 1;
        const fetchTo = lastTotal + numNewMsgs;
        lastTotal = fetchTo;

        if (fetchFrom > fetchTo) {
          console.warn('Fetch range invalid, no new messages to fetch.');
          return;
        }

        const fetchRange = `${fetchFrom}:${fetchTo}`;
        const fetch = imap.seq.fetch(fetchRange, { bodies: '', struct: true });

        fetch.on('message', (msg, seqno) => {
          let raw = '';
          let attributes: any = {};

          msg.on('body', (stream) => {
            stream.on('data', (chunk) => {
              raw += chunk.toString('utf8');
            });
          });

          msg.once('attributes', (attrs) => {
            attributes = attrs;
          });

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(raw);

              // Format "from" and "to"
              // parsed.from and parsed.to are AddressObject | undefined
              // AddressObject: { value: Array<{ name: string; address: string }>, ... }
              function getAddressArray(addr: any): Array<{ name: string; address: string }> {
                if (!addr) return [];
                if (Array.isArray(addr)) return addr;
                if ('value' in addr && Array.isArray(addr.value)) return addr.value;
                return [];
              }

              const fromArr = getAddressArray(parsed.from);
              const from = fromArr.length > 0
                ? { name: fromArr[0].name || '', email: fromArr[0].address || '' }
                : { name: '', email: '' };

              const toArr = getAddressArray(parsed.to);
              const to = toArr.map((t: any) => ({
                name: t.name || '',
                email: t.address || '',
              }));

              // Attachments: upload each to Cloudinary and store the URL
              let attachments: any = [];
              if (parsed.attachments && parsed.attachments.length > 0) {
                attachments = await Promise.all(parsed.attachments.map(async (att: any) => {
                  let url = '';
                  try {
                    url = await uploadAttachmentToCloudinary(att.content, att.filename || 'attachment', att.contentType || 'application/octet-stream');
                  } catch (e) {
                    console.error('Cloudinary upload failed:', e);
                  }
                  return {
                    filename: att.filename,
                    contentType: att.contentType,
                    size: att.size,
                    contentDisposition: att.contentDisposition,
                    checksum: att.checksum,
                    contentId: att.cid,
                    url, // Cloudinary URL
                  };
                }));
              }

              // Flags
              const flags = attributes.flags || [];
              const read = flags.includes('\\Seen');
              const starred = flags.includes('\\Flagged');

              // Folder
              const folder = 'inbox';

              // Snippet
              const snippet = parsed.text ? parsed.text.substring(0, 100) : '';

              // Date
              const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

              // Store in DB
               const prompt:string = makeCategoryPrompt(parsed.text || parsed.html || parsed.textAsHtml || '');
               const res = await callOpenRouter(prompt);
               const startIndex = res.indexOf('{');
               const endIndex = res.lastIndexOf('}');
               console.log(`📄 Category response: ${res}`);
               

               const  categories = JSON.parse(res.slice(startIndex,endIndex + 1));
         
               await Email.create({
                from, 
                to,   
                subject: parsed.subject || '',
                body: parsed.html || parsed.textAsHtml || parsed.text || '',
                receivedAt: date,
                credential: credId, 
                contentType:categories.contentType || 'Text-only',
                purpose: categories.purpose || 'Personal',
                senderType: categories.senderType || 'Human',
                priority: categories.priority || 'Normal',
                actionRequired: categories.actionRequired || 'Informational Only',
                topicDepartment: categories.topicDepartment || '',
                timeSensitivity: categories.timeSensitivity || 'Evergreen',
                folder,
                snippet,
                read,
                starred,
                hasAttachments: attachments.length > 0,
                attachments,
                // Add other fields as needed
              });

              console.log(`🔤 New message #${seqno}:\n`, parsed.subject);
            } catch (err) {
              console.error('Failed to parse/store email:', err);
            }
          });
        });

        fetch.once('end', () => {
          console.log('✅ Done fetching new messages.');
        });
      });
    });
  });

  imap.once('error', (err: any) => {
    console.error('❌ IMAP error:', err);
  });

  imap.once('end', () => {
    console.log('Connection ended.');
  });

  imap.connect();
}


export async function startWatchingAllEmails() {
  const credentials = await EmailCredential.find().select('+password').lean();
  console.log(credentials);
  

  for (const cred of credentials) {
    connectAndWatchEmails({
      email: cred.email,
      password: cred.password,
      credId: cred._id.toString(), // Pass the credential ID if needed
    });
  }
}

// Add this at the top of your file or in a separate .d.ts file if you want to avoid TypeScript errors:


