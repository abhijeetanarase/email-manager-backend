import EmailCredential from "../model/emailcred";
import Imap from "imap";
import Email from "../model/email";
import { ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
export const saveInboxEmailsLast30Days = async (credentialId: string): Promise<void> => {
  try {
    const credential = await EmailCredential.findById(credentialId).select('+password').lean();
    if (!credential) throw new Error('Credential not found');

    const imap = new Imap({
      user: credential.email,
      password: credential.password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    function openInbox(cb: (err: Error | null, box?: Imap.Box) => void) {
      imap.openBox('INBOX', false, cb);
    }

    imap.once('ready', () => {
      openInbox((err, box) => {
        if (err || !box) {
          imap.end();
          console.error("Failed to open inbox:", err?.message);
          return;
        }

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 30);

        imap.search([['SINCE', sinceDate.toDateString()]], (err, results) => {
          if (err || !results || results.length === 0) {
            imap.end();
            return;
          }

          const fetch = imap.fetch(results, { bodies: '', struct: true });
          const emailsToInsert: any[] = [];
          const messageIds: string[] = [];
          const fallbackKeys: string[] = [];
          const fallbackMap: Record<string, any> = {};

          fetch.on('message', (msg, seqno) => {
            let raw = '';
            let attributes: Imap.ImapMessageAttributes;

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
                const parsed: ParsedMail = await simpleParser(raw);

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

                const attachments = (parsed.attachments || []).map((att: any) => ({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  contentDisposition: att.contentDisposition,
                  checksum: att.checksum,
                  contentId: att.cid,
                }));

                const flags = attributes && attributes.flags ? attributes.flags : [];
                const read = flags.includes('\\Seen');
                const starred = flags.includes('\\Flagged');
                const folder = 'inbox';
                const snippet = parsed.text ? parsed.text.substring(0, 100) : '';
                const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

                const messageId = parsed.messageId || '';
                const emailDoc = {
                  from,
                  to,
                  subject: parsed.subject || '',
                  body: parsed.html || parsed.textAsHtml || parsed.text || '',
                  receivedAt: date,
                  credential: credential._id,
                  category: 'Interested',
                  folder,
                  snippet,
                  read,
                  starred,
                  hasAttachments: attachments.length > 0,
                  attachments,
                  messageId: messageId || undefined,
                };

                if (messageId) {
                  messageIds.push(messageId);
                  emailsToInsert.push({ ...emailDoc, messageId });
                } else {
                  const key = `${emailDoc.subject}|${emailDoc.receivedAt}|${emailDoc.from.email}`;
                  fallbackKeys.push(key);
                  fallbackMap[key] = emailDoc;
                }
              } catch (err) {
                console.error("Error parsing email:", err);
              }
            });
          });

          fetch.once('end', async () => {
            // Bulk check for existing messageIds
            let existingIds: string[] = [];
            if (messageIds.length > 0) {
              const existing = await Email.find({ messageId: { $in: messageIds }, credential: credential._id }).select('messageId');
              existingIds = existing.map(e => e.messageId).filter((id): id is string => typeof id === 'string');
            }
            // Bulk check for fallback keys
            let fallbackToInsert: any[] = [];
            if (fallbackKeys.length > 0) {
              const fallbackConditions = fallbackKeys.map(key => {
                const [subject, receivedAt, fromEmail] = key.split('|');
                return { subject, receivedAt, 'from.email': fromEmail, credential: credential._id };
              });
              const existingFallbacks = await Email.find({ $or: fallbackConditions }).select('subject receivedAt from credential');
              const existingFallbackKeys = new Set(existingFallbacks.map(e => `${e.subject}|${e.receivedAt}|${e.from.email}`));
              fallbackToInsert = fallbackKeys.filter(key => !existingFallbackKeys.has(key)).map(key => fallbackMap[key]);
            }
            // Filter out duplicates and insert
            const toInsert = emailsToInsert.filter(e => !existingIds.includes(e.messageId)).concat(fallbackToInsert);
            if (toInsert.length > 0) {
              await Email.insertMany(toInsert);
            }
            imap.end();
            console.log(`Fetched ${emailsToInsert.length + fallbackToInsert.length} emails, saved ${toInsert.length} new.`);
          });
        });
      });
    });

    imap.once('error', (err : any) => {
      console.error('IMAP error:', err);
    });

    imap.once('end', () => {
      console.log('IMAP connection closed.');
    });

    imap.connect();
  } catch (error) {
    console.error("Unexpected error:", error);
  }
};

