import { Request, Response } from 'express';
import axios from 'axios';
import SlackToken from '../model/slack';



interface AuthenticatedRequest extends Request {
  userId?: string;
}

const {
  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
  SLACK_REDIRECT_URI
} = process.env;

console.log( "slack config" , SLACK_CLIENT_ID , SLACK_CLIENT_SECRET , SLACK_REDIRECT_URI);


export const installSlackApp = (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId as string;
  const scopes = ['chat:write']; // only notification scope
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes.join(',')}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI || '')}&userId=${encodeURIComponent(userId)}`;
  res.redirect(authUrl);
};

export const handleOAuthCallback = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const code = req.query.code as string;
  const userId = req.query.userId; // 👈 Injected by auth middleware

  if (!code) {
    res.status(400).send('Missing authorization code.');
    return;
  }

  if (!userId) {
    res.status(401).send('Unauthorized. Missing user ID.');
    return;
  }

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_REDIRECT_URI
      }
    });

    const data = response.data;

    if (!data.ok) {
      res.status(400).send(`Slack error: ${data.error}`);
      return;
    }

    await SlackToken.findOneAndUpdate(
      { team_id: data.team.id, createdBy: userId },
      {
        team_id: data.team.id,
        team_name: data.team.name,
        access_token: data.access_token,
        bot_user_id: data.bot_user_id,
        authed_user_id: data.authed_user.id,
        scope: data.scope,
        createdBy: userId
      },
      { upsert: true, new: true }
    );

    res.send('✅ Slack App installed successfully!');
  } catch (err: any) {
    console.error('Slack OAuth Error:', err.message);
    res.status(500).send('Failed to complete Slack OAuth process.');
  }
};


export const sendTestNotification = async (req: Request, res: Response) => {
  try {
    const teamId = req.query.team_id as string;
    if (!teamId) return res.status(400).send('Missing team_id');

    const tokenDoc = await SlackToken.findOne({ team_id: teamId });
    if (!tokenDoc) return res.status(404).send('Slack app not installed for this team');

    const result = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: '#general', // or a dynamic value
      text: '🚀 This is a test notification from your Slack App!'
    }, {
      headers: {
        Authorization: `Bearer ${tokenDoc.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!result.data.ok) {
      return res.status(400).send(`Slack API error: ${result.data.error}`);
    }

    res.send('✅ Notification sent!');
  } catch (err: any) {
    console.error('Notification Error:', err.message);
    res.status(500).send('Failed to send notification');
  }
};
