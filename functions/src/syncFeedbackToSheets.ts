import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { google } from 'googleapis';

// Placeholder: The user should replace this with their actual Spreadsheet ID
const SPREADSHEET_ID = '1oIwXAT0ZUatXFEXWERG4dZAMIYQSmVq6foRPHhLN8uU';

/**
 * Triggers when a new feedback document is created in Firestore.
 * Appends the feedback data to a Google Sheet.
 */
export const syncFeedbackToSheets = onDocumentCreated('feedback/{docId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const authClient = await auth.getClient();
      
      // Log the service account being used (helpful for sharing the sheet)
      const project = await auth.getProjectId();
      console.log(`Syncing to sheets using project: ${project}`);

      const sheets = google.sheets({ version: 'v4', auth: authClient as any });

      const row = [
        data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        data.userEmail || 'Anonymous',
        data.userId || 'N/A',
        data.text || '',
        data.platform || 'mobile',
        data.type || 'general'
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A2',
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });

      console.log(`Feedback ${event.params.docId} synced to Google Sheets successfully.`);
    } catch (error: any) {
      console.error('Error syncing feedback to Google Sheets:', error);
      console.error('Error Details:', error.message);
      if (error.code === 403) {
        console.error('PRO TIP: Make sure your Google Sheet is shared with your Firebase Service Account as an Editor!');
      }
    }
});
