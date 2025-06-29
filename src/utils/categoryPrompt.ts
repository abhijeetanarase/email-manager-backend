
const makeCategoryPrompt = (body : string): string => {
const prompt:string  = `Classify the following email body into the following categories:
1. Purpose: [Personal, Work, Transactional, Promotional, Newsletter, Notification, Spam]
2. Sender Type: [Human, Automated, Company]
3. Content Type: [Text-only, Media-rich, Interactive]
4. Priority: [Urgent, High, Normal, Low]
5. Action Required: [Immediate Action, Follow-up Needed, Read Later, Informational Only]
6. Topic/Department: [HR, IT, Finance, Support, Marketing, Project Update, etc.]
7. Time Sensitivity: [Time-sensitive, Evergreen]

Email Body :${body}

Please classify the email body above into the categories listed above. Provide your response in JSON format with the following structure:

{
  "purpose": "Your classification here",
  "senderType": "Your classification here",
  "contentType": "Your classification here",
  "priority": "Your classification here",
  "actionRequired": "Your classification here",
  "topicDepartment": "Your classification here",
  "timeSensitivity": "Your classification here"
}
Make sure to provide a clear and concise classification for each category based on the content of the email body. If a category does not apply, you can leave it blank or indicate 'Not Applicable , Don't give any reasoning I want't only categories in json object , I don,t wan't any single text with response'.
`
return prompt;
}

export default makeCategoryPrompt;