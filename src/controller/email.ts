import { Request, Response } from "express";
import Email from "../model/email";
import EmailCredential from "../model/emailcred";
import nodemailer from "nodemailer";
import User from "../model/user";



// Extend Request to include userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}

// GET /api/email/:credentialId
export const getEmailsByCredentialId = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const credentialId = req.params.id;

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

    const emails = await Email.find({ credential: credentialId })
      .skip(0)
      .limit(50)
      .sort({ receivedAt: -1 });
    res.json({ emails });
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
      port:465 ,
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
      from: { name:user?.name, email: emailCred.email },
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

export const starEmail = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  const emailId = req.params.emailId;
  const { starred } = req.body;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (typeof starred !== "boolean") {
    return res.status(400).json({ message: "Missing or invalid 'starred' value" });
  }
  try {
    // Find the email and ensure it belongs to a credential owned by the user
    const email = await Email.findOneAndUpdate(
      { _id: emailId },
      { $set: { starred } },
      { new: true }
    );

    if (!email || !email.credential) {
      return res.status(404).json({ message: "Email not found or not authorized" });
    }

    res.json({ message: `Email ${starred ? "starred" : "unstarred"}`, email });
  } catch (error) {
    res.status(500).json({ message: "Error updating starred status", error });
  }
};