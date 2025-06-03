import { Request, Response } from "express";
import EmailCredential from "../model/emailcred";
import { startWatchingAllEmails } from "../utils/connectIMap";
import sendSlackNotification from "../utils/slackNotifier";
import { saveInboxEmailsLast30Days } from "../utils/saveEmail";

// Extend Request to include userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const createCredential = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const { email, password } = req.body;
    const existing = await EmailCredential.findOne({
      email,
      createdBy: userId,
    });
    if (existing)
      return res
        .status(400)
        .json({ message: "Email already exists for this user" });

    const cred = await EmailCredential.create({
      email,
      password,
      createdBy: userId,
    });
    res.status(201).json(cred);
    await startWatchingAllEmails();
    await saveInboxEmailsLast30Days(cred._id.toString());
  } catch (error) {
    res.status(500).json({ message: "Error creating credential", error });
  }
};

export const getAllCredentials = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const credentials = await EmailCredential.find({ createdBy: userId });

    res.json({ cred: credentials });
  } catch (error) {
    res.status(500).json({ message: "Error fetching credentials", error });
  }
};

export const getCredentialById = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const credential = await EmailCredential.findOne({
      _id: req.params.id,
      createdBy: userId,
    });
    if (!credential) return res.status(404).json({ message: "Not found" });
    res.json(credential);
  } catch (error) {
    res.status(500).json({ message: "Error fetching credential", error });
  }
};

export const updateCredential = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const updated = await EmailCredential.findOneAndUpdate(
      { _id: req.params.id, createdBy: userId },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
    await startWatchingAllEmails();
    await saveInboxEmailsLast30Days(updated._id.toString());
  } catch (error) {
    res.status(500).json({ message: "Error updating credential", error });
  }
};

export const deleteCredential = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.userId;
    const deleted = await EmailCredential.findOneAndDelete({
      _id: req.params.id,
      createdBy: userId,
    });
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted successfully" });
    await startWatchingAllEmails();
  } catch (error) {
    res.status(500).json({ message: "Error deleting credential", error });
  }
};



export const fetch30DaysLast = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { id } = req.params;
  try {
    await saveInboxEmailsLast30Days(id);
    res.json({sucess : true})
  } catch (error) {
    console.log(error);
  }
};
