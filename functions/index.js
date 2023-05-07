const environment = require('./environment.js');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const functions = require('firebase-functions');
const { getFunctions } = require('firebase-admin/functions');

admin.initializeApp({
  projectId: environment.firebase.projectId,
  databaseURL: environment.firebase.databaseURL,
  serviceAccountId: 'firebase-adminsdk-92z2m@workhours-2b75b.iam.gserviceaccount.com',
});

exports.authorizeSheet = functions.https.onCall(async (data, context) => {
  const response = await checkUserAdmin(data, context);
  if (response.error) {
    return response;
  }
  try {
    const jwtClient = await getJwtClient();
    const sheets = google.sheets({version: 'v4', auth: jwtClient});
    await getSpreadsheet(sheets, data.spreadsheetId);
    return {success: true}
  } catch (e) {
    return {error: 'not_authorized'};
  }
});

exports.exportEventToExcel =
  functions.database.ref('/events/{organization}/{user}/{eventId}').onWrite(async (change, context) => {
    // check if sheet id is associated with the organization
    const jwtClient = await getJwtClient();
    const spreadsheetIdSnapshot = await admin.database().ref(`organizations/${context.params.organization}/spreadsheetId`).once('value');
    const spreadsheetId = spreadsheetIdSnapshot.val();
    if (!spreadsheetId) {
      return;
    }
    // get the user email
    const emailSnapshot = await admin.database().ref(`users/${context.params.user}/email`).once('value');
    const email = emailSnapshot.val();
    try {
      const sheets = google.sheets({version: 'v4', auth: jwtClient});
      // now check if a sheet exists for this specified user
      const spreadsheet = await getSpreadsheet(sheets, spreadsheetId);
      let userSheet = null;
      for (const sheet of spreadsheet.data.sheets) {
        if (sheet.properties.title === email) {
          userSheet = sheet.properties.sheetId;
          break;
        }
      }
      if (!userSheet) {
        const response = await createSheet(sheets ,spreadsheetId, email);
        const headers = [
          ['ID', 'Дата', 'Часове', 'Причина, наложила извънреден труд', 'Извършена работа']
        ];
        userSheet = response.data.replies[0].addSheet.properties.sheetId;
        await appendInRange(sheets, spreadsheetId, headers, `${email}!A1`);
        await beautifyTitleRow(sheets, spreadsheetId, userSheet);
      }
      // new event is created. append to the sheet
      if (!change.before.exists()) {
        const after = change.after.val();
        const rows = [
          [context.params.eventId, after.date, after.hours, after.reason, after.workDone]
        ];
        functions.logger.info(`Adding event row: ${JSON.stringify(after)}`, {structuredData: true});
        await appendInRange(sheets, spreadsheetId, rows, `${email}!A1`);
      }
      // event is deleted
      else if (!change.after.exists()) {
        functions.logger.info(`Deleting event row: ${JSON.stringify(context.params.eventId)}`, {structuredData: true});
        const rowNum = await getEventRowNum(sheets, spreadsheetId, email, context.params.eventId);
        await deleteRow(sheets, spreadsheetId, userSheet, rowNum);
      }
      // event is updated
      else {
        const after = change.after.val();
        const rows = [
          [context.params.eventId, after.date, after.hours, after.reason, after.workDone]
        ];
        // get the first column and find the eventId row
        const rowNum = await getEventRowNum(sheets, spreadsheetId, email, context.params.eventId);
        if (rowNum) {
          functions.logger.info(`Updating event row ${rowNum}: ${JSON.stringify(after)}`, {structuredData: true});
          await updateInRange(sheets, spreadsheetId, rows, `${email}!A${rowNum}`);
        } else {
          functions.logger.info(`Updating event row that is NOT found. Adding: ${JSON.stringify(after)}`, {structuredData: true});
          await appendInRange(sheets, spreadsheetId, rows, `${email}!A1`);
        }
      }
      return {success: true};
    } catch (e) {
      functions.logger.error(`Error in DB trigger: ${e.message}`, {structuredData: true});
      return {error: e};
    }
  });

exports.scheduleEventsReport = functions.https.onCall(async (data, context) => {
  const response = await checkUserAdmin(data, context);
  if (response.error) {
    return response;
  }
  if (data.prod) {
    const queue = getFunctions().taskQueue('locations/europe-west1/functions/reportEvents');
    await queue.enqueue(data, {
      scheduleDelaySeconds: 60,
      dispatchDeadlineSeconds: 60 * 5
    });
  } else {
    await doReport(data.organization, data.date);
  }
  return {success: true}
});

exports.reportEvents = functions.tasks.taskQueue({
  retryConfig: {
    maxAttempts: 5,
    minBackoffSeconds: 60,
  },
  rateLimits: {
    maxConcurrentDispatches: 6,
  },
}).onDispatch(async (data) => {
    await doReport(data.organization, data.date);
});
//////////////////////////////////////////////////////////////////////////////////////////
// PRIVATE FUNCTIONS
async function checkUserAdmin(data, context) {
  const organization = data.organization;
  if (!organization) {
    return {error: 'no_params'};
  }
  const uid = context.auth.uid;
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

async function getJwtClient() {
  const jwtClient = new google.auth.JWT({
    email: environment.serviceEmail,
    key: environment.serviceKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  await jwtClient.authorize();
  return jwtClient;
}

async function getSpreadsheet(sheets, spreadsheetId) {
  return await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId
  });
}

async function createSheet(sheets, spreadsheetId, title) {
  const request = {
    spreadsheetId: spreadsheetId,
    resource: {
      requests: [{
        addSheet: {
          properties: {
            title: title
          }
        }
      }],
    }
  };
  return await sheets.spreadsheets.batchUpdate(request);
}

async function beautifyTitleRow(sheets, spreadsheetId, sheetId) {
  const requests = [];
  requests.push({
    "repeatCell": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 0,
        "endRowIndex": 1
      },
      "cell": {
        "userEnteredFormat": {
          "backgroundColor": {
            "red": 217/255,
            "green": 217/255,
            "blue": 217/255
          },
          "horizontalAlignment": "CENTER",
          "textFormat": {
            "foregroundColor": {
              "red": 67/255,
              "green": 67/255,
              "blue": 67/255
            },
            "fontSize": 12,
            "bold": true
          }
        }
      },
      "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
    }
  });
  requests.push({
    "updateSheetProperties": {
      "properties": {
        "sheetId": sheetId,
        "gridProperties": {
          "frozenRowCount": 1
        }
      },
      "fields": "gridProperties.frozenRowCount"
    }
  });
  requests.push({
    "autoResizeDimensions": {
      "dimensions": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 3,
        "endIndex": 5
      }
    }
  });
  const batchUpdateRequest = {requests};
  return await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    resource: batchUpdateRequest,
  });
}

async function appendInRange(sheets, spreadsheetId, values, range) {
  const resource = {
    values,
  };
  return await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'RAW',
    resource: resource,
  });
}

async function updateInRange(sheets, spreadsheetId, values, range) {
  const resource = {
    values,
  };
  return await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'RAW',
    resource: resource,
  });
}

async function getFromRange(sheets, spreadsheetId, range) {
  return await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: range
  });
}

async function getEventRowNum(sheets, spreadsheetId, email, eventId) {
  const values = await getFromRange(sheets, spreadsheetId, `${email}!A2:A1000000`);
  if (values.data && values.data.values && values.data.values) {
    let i = 2;
    for (const row of values.data.values) {
      if (row[0] === eventId) {
        return i;
      }
      i++;
    }
  }
  return null;
}

async function deleteRow(sheets, spreadsheetId, sheetId, row) {
  const requests = [];
  requests.push({
    "deleteDimension": {
      "range": {
        "sheetId": sheetId,
        "dimension": "ROWS",
        "startIndex": row - 1,
        "endIndex": row
      }
    }
  });
  const batchUpdateRequest = {requests};
  return await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    resource: batchUpdateRequest,
  });
}

//////////////////////////////////////////
// reporting functions
async function doReport(organizationKey, date) {
  let nextDate;
  let [year, month] = date.split('-');
  year = parseInt(year, 10);
  month = parseInt(month, 10);
  if (month === 12) {
    nextDate = `${year + 1}-01`;
  } else if (month > 8) {
    nextDate = `${year}-${month + 1}`;
  } else {
    nextDate = `${year}-0${month + 1}`;
  }
  // check if sheet id is associated with the organization
  const jwtClient = await getJwtClient();
  const organizationSnapshot = await admin.database().ref(`organizations/${organizationKey}`).once('value');
  const organization = organizationSnapshot.val();
  if (!organization.spreadsheetId) {
    return;
  }
  // do we have a sheet with the name of the organization?
  try {
    const reportSheetName = `Отчет за ${organization.name}`;
    const dateString = monthYearToText(date);
    const sheets = google.sheets({version: 'v4', auth: jwtClient});
    // now check if a sheet exists for this specified user
    const spreadsheet = await getSpreadsheet(sheets, organization.spreadsheetId);
    let reportSheetId = null;
    for (const sheet of spreadsheet.data.sheets) {
      if (sheet.properties.title === reportSheetName) {
        reportSheetId = sheet.properties.sheetId;
        break;
      }
    }
    if (!reportSheetId) {
      const response = await createSheet(sheets, organization.spreadsheetId, reportSheetName);
      reportSheetId = response.data.replies[0].addSheet.properties.sheetId;
    } else {
      await clearSheet(sheets, organization.spreadsheetId, reportSheetId, reportSheetName);
    }
    await writeHeader(sheets, reportSheetId, organization, reportSheetName, dateString);
    let writtenRows = 3;
    // let's find out now all the users that have events in the specified month
    const snapshot = await admin.database().ref('users_organizations').orderByChild('organization').equalTo(organizationKey).once('value');
    if (!snapshot.exists()) {
      functions.logger.error(`Error in doReport: organization ${organizationKey} without users`, {structuredData: true});
      return {error: 'no user_organization'};
    }
    for (const [_key, userOrganization] of Object.entries(snapshot.val())) {
      // get the user
      const userSnapshot = await admin.database().ref(`users/${userOrganization.user}`).once('value');
      if (!userSnapshot.exists()) {
        functions.logger.error(`Error in doReport: user ${userOrganization.user} missing`, {structuredData: true});
        return {error: 'no user'};
      }
      const eventsSnapshot = await admin.database().ref(`events/${organizationKey}/${userOrganization.user}`)
        .orderByChild('date').startAt(date).endAt(nextDate).once('value');
      if (!userSnapshot.exists()) {
        continue;
      }
      const user = userSnapshot.val();
      await writeUserHeader(sheets, reportSheetId, organization, reportSheetName, dateString, user, writtenRows);
      console.log(eventsSnapshot.val());
    }
  } catch (e) {
    functions.logger.error(`Error in doReport: ${e.message}`, {structuredData: true});
    return {error: e};
  }
  return {success: true};
}

async function clearSheet(sheets, spreadsheetId, sheetId, sheetName) {
  const requests = [];
  requests.push({
    "updateCells": {
      "range": {
        "sheetId": sheetId
      },
      "fields": "userEnteredFormat"
    }
  });
  requests.push({
    "unmergeCells": {
      "range": {
        "sheetId": sheetId
      },
    }
  });
  const batchUpdateRequest = {requests};
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    resource: batchUpdateRequest,
  });
  await sheets.spreadsheets.values.clear({
    spreadsheetId: spreadsheetId,
    range: sheetName,
  });
}

async function writeHeader(sheets, sheetId, organization, sheetName, dateString) {
  const requests = [];
  requests.push({
    "repeatCell": {
      "range": {
        "sheetId": sheetId
      },
      "cell": {
        "userEnteredFormat": {
          "wrapStrategy": "WRAP",
          "horizontalAlignment": "CENTER",
          "verticalAlignment": "MIDDLE",
          "textFormat": {
            "fontSize": 14,
            "fontFamily": "Arial",
          }
        }
      },
      "fields": "userEnteredFormat(wrapStrategy,horizontalAlignment,verticalAlignment,textFormat)"
    }
  });
  requests.push({
    "repeatCell": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 0,
        "endRowIndex": 1,
        "startColumnIndex": 0,
        "endColumnIndex": 10
      },
      "cell": {
        "userEnteredFormat": {
          "backgroundColor": {
            "red": 11/255,
            "green": 83/255,
            "blue": 148/255
          },
          "textFormat": {
            "foregroundColor": {
              "red": 255/255,
              "green": 255/255,
              "blue": 255/255
            },
            "fontSize": 14,
            "bold": true
          }
        }
      },
      "fields": "userEnteredFormat(backgroundColor,textFormat)"
    }
  });
  requests.push({
    "updateSheetProperties": {
      "properties": {
        "sheetId": sheetId,
        "gridProperties": {
          "frozenRowCount": 2
        }
      },
      "fields": "gridProperties.frozenRowCount"
    }
  });
  requests.push({
    "mergeCells": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 0,
        "endRowIndex": 1,
        "startColumnIndex": 0,
        "endColumnIndex": 10
      },
      "mergeType": "MERGE_ALL"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "ROWS",
        "startIndex": 0,
        "endIndex": 1
      },
      "properties": {
        "pixelSize": 55
      },
      "fields": "pixelSize"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 0,
        "endIndex": 1
      },
      "properties": {
        "pixelSize": 50
      },
      "fields": "pixelSize"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 1,
        "endIndex": 2
      },
      "properties": {
        "pixelSize": 180
      },
      "fields": "pixelSize"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 2,
        "endIndex": 6
      },
      "properties": {
        "pixelSize": 120
      },
      "fields": "pixelSize"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 6,
        "endIndex": 7
      },
      "properties": {
        "pixelSize": 350
      },
      "fields": "pixelSize"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 7,
        "endIndex": 8
      },
      "properties": {
        "pixelSize": 480
      },
      "fields": "pixelSize"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 8,
        "endIndex": 10
      },
      "properties": {
        "pixelSize": 120
      },
      "fields": "pixelSize"
    }
  });
  requests.push({
    "mergeCells": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 1,
        "endRowIndex": 2,
        "startColumnIndex": 2,
        "endColumnIndex": 4
      },
      "mergeType": "MERGE_ALL"
    }
  });
  requests.push({
    "mergeCells": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 1,
        "endRowIndex": 2,
        "startColumnIndex": 4,
        "endColumnIndex": 6
      },
      "mergeType": "MERGE_ALL"
    }
  });
  requests.push({
    "mergeCells": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 1,
        "endRowIndex": 2,
        "startColumnIndex": 8,
        "endColumnIndex": 10
      },
      "mergeType": "MERGE_ALL"
    }
  });
  requests.push({
    "repeatCell": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": 1,
        "endRowIndex": 3,
        "startColumnIndex": 0,
        "endColumnIndex": 10
      },
      "cell": {
        "userEnteredFormat": {
          "textFormat": {
            "fontSize": 14,
            "bold": true
          }
        }
      },
      "fields": "userEnteredFormat(textFormat)"
    }
  });
  const batchUpdateRequest = {requests};
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: organization.spreadsheetId,
    resource: batchUpdateRequest,
  });
  await updateInRange(sheets, organization.spreadsheetId, [[`Извънреден труд на ${organization.name} за ${dateString}`]], `${sheetName}!A1`);
  await updateInRange(sheets, organization.spreadsheetId,
    [['', 'Име, фамилия', "В работни дни\n(часове и дата)", '', "В почивни дни\n(часове и дата)", '',
      'Причина, наложила извънреден труд', 'Извършена работа', 'Работа в минути', '']], `${sheetName}!A2`);
  await updateInRange(sheets, organization.spreadsheetId,
    [['№', '', 'ЧАСОВЕ', 'ДАТА', 'ЧАСОВЕ', 'ДАТА', '', '', 'Работни дни', 'Почивни дни']], `${sheetName}!A3`);
}

async function writeUserHeader(sheets, sheetId, organization, sheetName, dateString, user, row){
  const requests = [];
  requests.push({
    "repeatCell": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": row,
        "endRowIndex": row + 1,
        "startColumnIndex": 0,
        "endColumnIndex": 10
      },
      "cell": {
        "userEnteredFormat": {
          "backgroundColor": {
            "red": 239/255,
            "green": 239/255,
            "blue": 239/255
          },
          "textFormat": {
            "fontFamily": "Comfortaa",
            "fontSize": 14,
            "bold": true
          }
        }
      },
      "fields": "userEnteredFormat(backgroundColor,textFormat)"
    }
  });
  requests.push({
    "mergeCells": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": row,
        "endRowIndex": row + 1,
        "startColumnIndex": 0,
        "endColumnIndex": 10
      },
      "mergeType": "MERGE_ALL"
    }
  });
  requests.push({
    "updateDimensionProperties": {
      "range": {
        "sheetId": sheetId,
        "dimension": "ROWS",
        "startIndex": row,
        "endIndex": row + 1
      },
      "properties": {
        "pixelSize": 45
      },
      "fields": "pixelSize"
    }
  });
  const batchUpdateRequest = {requests};
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: organization.spreadsheetId,
    resource: batchUpdateRequest,
  });
  let name = user.email;
  if (user.firstName) {
    name = `${user.firstName} ${user.lastName}`.toUpperCase();
  }
  await updateInRange(sheets, organization.spreadsheetId, [[name]], `${sheetName}!A${row + 1}`);
}

function monthYearToText(monthKey) {
  const [year, month] = monthKey.split('-');
  switch (month) {
    case '01': return `Януари, ${year} г.`;
    case '02': return `Февруари, ${year} г.`;
    case '03': return `Март, ${year} г.`;
    case '04': return `Април, ${year} г.`;
    case '05': return `Май, ${year} г.`;
    case '06': return `Юни, ${year} г.`;
    case '07': return `Юли, ${year} г.`;
    case '08': return `Август, ${year} г.`;
    case '09': return `Септември, ${year} г.`;
    case '10': return `Октомври, ${year} г.`;
    case '11': return `Ноември, ${year} г.`;
    case '12': return `Декември, ${year} г.`;
    default: return `${year} г.`;
  }
}
