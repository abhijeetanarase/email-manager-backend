import { Request, Response } from "express";
import Email from "../model/email";
import EmailCredential from "../model/emailcred";
import nodemailer from "nodemailer";
import User from "../model/user";



// Extend Request to include userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}
interface EmailQuery {
  search?: string;
  n?: number; // Number of items per page
  p?: number; // Page number
}

// GET /api/email/:credentialId
export const getEmailsByCredentialId = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const credentialId = req.params.id;
    const { search = "", n = 20, p = 1 }: EmailQuery = req.query;

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

    const filters = { credential: credentialId, subject: { $regex: search, $options: 'i' } }

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