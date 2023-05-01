import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

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
    email: 'google-sheets-updater@workhours-2b75b.iam.gserviceaccount.com',
    key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDS+oMSwlnQVcZT\nA+JGa3IfNoVoSjCqVfqP0brXL2hN6ezi3wMJk/PbIQ1knoNaQjOw11si4FpYT6ef\nav/8eOXwfqa9y/jlRbpD1wQGYQYBbb6oCENVPdbr3uDxG/fx7ObPNP/sGSR7zZSI\nYu/+41+7D+ksl9wO+cuz85p6WhSOLdyEDG5s8QGYXGbQSJ4+2Hi9/tiJIgmnFJh1\n9mPElMuJYB6UqqP7Olap8dU8EhhBajJaq9PgVABIAMRiM9BG80qe6n1252uOtoly\nhThJooLdhmWhVwhdokyf414slr9NyBAh27xblKluVfaundo43acyfjpxEl8iEJCW\n6Jubxg93AgMBAAECggEAXkepZCwqo5F5F2bgapSgQneERVcGCVBzsGpKQtgCFfNH\nsxhyjIirzAwopoK5cw+rdsa+CMdWSCmMYA6aR1IlewO18pHgb2Bp/N/sggdAfknz\nDbbnlAOW8/+86LIVamxxtj3accDIj3SOgCYqVm54PKk/C3jvU1foYkmlijCQB/qB\nyDZSCUvwNM3/eaGL57UE22EM8xRzSAEaF4Y6YHbw5zHJaMYN7BJoQF1Jqa+t0N74\nCjJ8cxOz0UN1WIIh5C1BKbHy4ejshtrApksmvnyfzX+OGUYcnb8jwxIzV077+wfE\nmPnLGr62lfOrSaCfgi4h6q2SIvoUlhfTSH19IhqiKQKBgQDvXp1myAfYvpRihyuG\ntA1erzEcjgAwqRxRy7YWNwKGKIxWpTM0vci9mVAT1XMLtTH1Ba/yO01xOiPd5oHU\nr2IfkMRbPHmPKKIeoQh5mc0TySBvISa+oRm7kdEe+QbMVj2qVTiWQ/0dIBF7+5fn\nUypxKN1uQz0CmTJaRwhpuZzPeQKBgQDhovB7HWMRsE6Idwf37WLn4TOTUwsrcs97\n98vTsbjpqx8mvgSJwWPENrMWzqkogZDl9SLYG36BwlB9L8ciEFoigttDr8BRR5ef\ngXMwvKCus577KCz8HHh4Neao1a/5c+v4cuaaqjOTfDaqguCYqusdYVixWy06TW7M\nKzwJseBqbwKBgAXK8mA0Yww5wHmJ7+G4pcIu1y9ruFF1JjxMg8GR3zvD63GFWfHi\nzeLYvPld5wTXg7f8RT/Fc6BT2d5a37V38RX2eOoEUqTGRPYcy4m10SKzcVd/I+Ll\nHyxM4RSwzhtP0vo2ScJJLuzvg7zOX+S3PIW0iXdLpURU1MUehvOYDFVxAoGBAMqY\nwC77YwH1+X3kyv3dY4prFiE5VnUrwItCIv0wvaTqJq1lvrNmNstuhf17kD2zoMQq\nCKBch4nBTP4q0TWP0y7bqj8rZpZUnxr0Y9al9+0FkUFYgJPaiHz/gN2mCT0FziIm\nIVNMccUCqh8OJtZN2ZBm4PlWsdSAxHSEeYMG+Ub3AoGAW9LPUqAOMtFN0DwXI4pQ\nEn5DrQSVv0CZHxuT5O9UbDtxiq4HCGdqqrgWFFTkI2OcjVb1qZijwcvvIOpVG4o4\nogN07T0Sknldxjy7yPuFdHoZ+KfZ/Kbnpn+X+7n/py0HXy/5hwPF/lZ9Pb95oSmY\nQl3CL6cSmGf2nOK/s2Ry0X0=\n-----END PRIVATE KEY-----\n",
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
