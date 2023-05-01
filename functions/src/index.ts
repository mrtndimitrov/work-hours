import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { environment } from '../../src/environments/environment';

admin.initializeApp({
  projectId: 'workhours-2b75b',
  databaseURL: 'http://localhost:9000?ns=workhours-2b75b-default-rtdb',
});

export const reportEvents = functions.https.onCall(async (data, context) => {
  //functions.logger.info("Hello logs!", {structuredData: true});
  const response = await checkUserAdmin(data, context);
  if (response.error) {
    return response;
  }
  return {keyyyy: 'something'}
});

export const authorizeSheet = functions.https.onCall(async (data, context) => {
  const response = await checkUserAdmin(data, context);
  if (response.error) {
    return response;
  }

  const jwtClient = new google.auth.JWT({
    email: environment.serviceEmail,
    key: environment.serviceKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  await jwtClient.authorize();

  try {
    const sheets = google.sheets('v4');
    await sheets.spreadsheets.get({
      spreadsheetId: data.sheetId,
      auth: jwtClient,
    });
    return {success: true}
  } catch (e) {
    return {error: 'not_authorized'};
  }
});

export const exportEventToExcel =
functions.database.ref('/events/{organization}/{user}/{eventId}').onWrite((change, context) => {
  // new event is created
  if (!change.before.exists()) {
    console.log('Created: ', change.before.val());
    return null;
  }
  // new event is deleted
  if (!change.after.exists()) {
    console.log('Deleted: ', change.before.val());
    return null;
  }
  // Grab the current value of what was written to the Realtime Database.
  const before = change.before.val();
  const after = change.after.val();
  console.log('Organization: ', context.params.organization);
  console.log('User: ', context.params.user);
  console.log('EventId: ', context.params.eventId);
  console.log('Before: ', before);
  console.log('After: ', after);
  // You must return a Promise when performing asynchronous tasks inside a Functions such as
  // writing to the Firebase Realtime Database.
  // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
  //return change.after.ref.parent.child('uppercase').set(uppercase);
  return {success: true};
});

async function checkUserAdmin(data: any, context: any) {
  const organization: string = data.organization;
  if (!organization) {
    return {error: 'no_params'};
  }
  const uid: string = context.auth!.uid;
  const obj = admin.database().ref(`/users_organizations/${uid}_${organization}`);
  const snapshot = await obj.get();
  if (!snapshot.exists()) {
    return {error: 'wrong_user'};
  }
  const val = snapshot.val();
  if (val.role !== 'admin') {
    return {error: 'not_admin'};
  }
  return {uid: uid, organization_key: organization};
}
