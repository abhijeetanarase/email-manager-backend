import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import User from "../model/user";
import { log } from "console";

export const redirectToGoogle = (req: Request, res: Response) => {
  const redirectUri =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });

  res.redirect(redirectUri);
};

export const googleAuthCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string;

  try {
    const { data: tokenResponse } = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const idToken = tokenResponse.id_token;
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString()
    );
    const existing = await User.findOne({ email: payload.email });
    let userId = null;
    const user = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture, 
    };
    if (existing) {
      userId = existing._id;
      await User.updateOne({ _id: userId }, user, {
        upsert: true,
      });
    } else {
      const createdUser = await User.create(user);
      userId = createdUser._id;
    }

    const jwtToken = jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });

  
    res.redirect(
      `${process.env.FRONTEND_URL}/success?token=${jwtToken}&email=${payload.email}&name=${encodeURIComponent(payload.name)}&picture=${encodeURIComponent(payload.picture)}`
    );
  } catch (err) {
    console.error("OAuth Error:", err);
    res.status(500).send("Authentication failed");
  }
};

export const getUserProfile = async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};


export const checkAuth = async (req: any, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(403).json({ message: "Not Authenticated, Please Login" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

    res.status(200).json({ isAuthenticated: true,  });
  }
  catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }   
}
