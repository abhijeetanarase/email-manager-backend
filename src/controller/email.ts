import { Request, Response } from "express";
import Email from "../model/email";
import EmailCredential from "../model/emailcred";
import nodemailer from "nodemailer";
import User from "../model/user";
import mongoose from "mongoose";


// Extend Request to include userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}
interface EmailQuery {
  search?: string;
  n?: number; // Number of items per page
  p?: number; // Page number
  folder?: string; // यहाँ ? जोड़ें
}

// GET /api/email/:credentialId
export const getEmailsByCredentialId = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const credentialId = req.params.id;
    const { search = "", n = 20, p = 1 , folder = "inbox" }: EmailQuery = req.query;

    // Ensure the credential belongs to the user
    const cred = await EmailCredential.findOne({
      _id: credentialId,
      createdBy: userId,
    });
    if (!cred) {
      return res
        .status(404)
        .json({ message: "Credential not found or not authorized" });
    }

    const filters = { credential: credentialId, subject: { $regex: search, $options: 'i' } , folder }

    const emails = await Email.find(filters)
      .skip((p - 1) * n)
      .limit(n)
      .sort({ receivedAt: -1 });
    const totalCount = await Email.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / n);
    res.json({ emails, totalCount, totalPages, currentPage: p });
  } catch (error) {
    res.status(500).json({ message: "Error fetching emails", error });
  }
};

export const sendMail = async (req: AuthenticatedRequest, res: Response) => {
  const { to, subject, text, id } = req.body;
  const userId = req.userId;
  if (!to || !subject || !text) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!id) {
    return res.status(400).json({ message: "Credential ID is required" });
  }
  try {
    const emailCred = await EmailCredential.findOne({
      createdBy: userId,
      _id: id,
    }).select("+password");
    if (!emailCred) {
      return res.status(404).json({ message: "Email credential not found" });
    }

    // Setup nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      service: "gmail",
      auth: {
        user: emailCred.email,
        pass: emailCred.password,
      },
    });

    // Send the email
    const mailOptions = {
      from: emailCred.email,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    const user = await User.findById(userId).select("name email");

    // Save the sent email in the Email collection
    const email = new Email({
      from: { name: user?.name, email: emailCred.email },
      to: Array.isArray(to)
        ? to.map((e: string) => ({ name: "", email: e }))
        : [{ name: "", email: to }],
      subject,
      body: text,
      credential: emailCred._id,
      receivedAt: new Date().toISOString(),
      messageId: info.messageId,
      folder: "sent",
    });
    await email.save();

    res.status(201).json({ message: "Email sent successfully", email });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Error sending email", error });
  }
};

export const starTrashArchiveEmail = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  const emailId = req.params.emailId;
  const { type } = req.body;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    let email = null;

    if (type === 'starred') {
      email = await Email.findOneAndUpdate(
        { _id: emailId },
        { $set: { starred: true } },
        { new: true }
      );
    } else if (type === 'unstarred') {
      email = await Email.findOneAndUpdate(
        { _id: emailId },
        { $set: { starred: false } },
        { new: true }
      );
    } else if (type === 'trash') {
      email = await Email.findOneAndUpdate(
        { _id: emailId },
        { $set: { folder: 'trash' } },
        { new: true }
      );
    } else if (type === 'archive') {
      email = await Email.findOneAndUpdate(
        { _id: emailId },
        { $set: { folder: 'archive' } },
        { new: true }
      );
    } else if (type === 'removetrash' || type === 'removearchive') {
      email = await Email.findOneAndUpdate(
        { _id: emailId },
        { $set: { folder: 'inbox' } },
        { new: true }
      );
    } else if (type === 'delete') {
      email = await Email.findOneAndDelete(
        { _id: emailId }
      );
    } else if (type === 'read') {
      email = await Email.findOneAndUpdate(
        { _id: emailId },
        { $set: { read: true } },
        { new: true }
      );
    }

    if (!email) {
      return res.status(404).json({ message: "Email not found" });
    }
    res.status(200).json({ success : true, email });

  } catch (error) {
    res.status(500).json({ message: "Error to Updating status", error });
  }
};

export const bulkUpdateEmails = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  const { emailIds, action } = req.body; // emailIds: string[], action: 'archive' | 'trash'

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!Array.isArray(emailIds) || !emailIds.length) {
    return res.status(400).json({ message: "emailIds array required" });
  }
  if (!['archive', 'trash','inbox'].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  try {
    const update = { folder: action };
    const result = await Email.updateMany(
      { _id: { $in: emailIds } },
      { $set: update }
    );
    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Bulk update failed", error });
  }
};

export const getEmailCounts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const credentialId = req.params.id;
    const folder = req.query.folder as string; // frontend से भेजा गया folder

    // Credential check
    const cred = await EmailCredential.findOne({
      _id: credentialId,
      createdBy: userId,
    });
    if (!cred) {
      return res.status(404).json({ message: "Credential not found or not authorized" });
    }

    // Aggregation filter
    const matchFilter: any = { credential: cred._id };
    if (folder) {
      matchFilter.folder = folder;
    }

    // Folders count (optional: अगर सभी folders के counters चाहिए)
    const folderCounts = await Email.aggregate([
      { $match: { credential: cred._id } },
      { $group: { _id: "$folder", count: { $sum: 1 } } }
    ]);

    // Categories count (selected folder के लिए)
    const categories = [
      'contentType',
      'purpose',
      'priority',
      'actionRequired',
      'timeSensitivity',
      'senderType'
    ];
    const categoryCounts: Record<string, Record<string, number>> = {};
    for (const category of categories) {
      const counts = await Email.aggregate([
        { $match: matchFilter },
        { $group: { _id: { $ifNull: [ `$${category}`, 'unknown' ] }, count: { $sum: 1 } } }
      ]);
      categoryCounts[category] = {};
      counts.forEach(item => {
        const key = item._id || 'unknown';
        categoryCounts[category][key] = item.count;
      });
    }

    res.json({
      folderCounts: Object.fromEntries(folderCounts.map(f => [f._id, f.count])),
      categoryCounts
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching counts", error });
  }
};