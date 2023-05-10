const environment = require('./environment.js');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const functions = require('firebase-functions');
const { getFunctions } = require('firebase-admin/functions');

admin.initializeApp({
  projectId: environment.firebase.projectId,
  databaseURL: environment.firebase.databaseURL,
  serviceAccountId: environment.firebase.serviceAccountId,
});

exports.authorizeSheet = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 540
  })
  .https.onCall(async (data, context) => {
  try {
    const response = await checkUserAdmin(data, context);
    if (response.error) {
      return response;
    }
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

exports.scheduleEventsReport = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 540
  })
  .https.onCall(async (data, context) => {
  const response = await checkUserAdmin(data, context);
  if (response.error) {
    return response;
  }
  if (data.prod) {
    const queue = getFunctions().taskQueue('locations/europe-west1/functions/reportEvents');
    await queue.enqueue(data, {
      scheduleDelaySeconds: 5,
      dispatchDeadlineSeconds: 540,
      oidcToken: {
        serviceAccountEmail: "chibuzo-time-tracker-app@appspot.gserviceaccount.com",
      }
    });
  } else {
    await doReport(data.organization, data.date);
  }
  return {success: true}
});

exports.reportEvents = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 540
  })
  .tasks.taskQueue({
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
  const snapshot = await admin.database().ref(`/users_organizations/${uid}_${organization}`).once('value');
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
  if (!organizationSnapshot.exists()) {
    functions.logger.error(`Error in doReport: organization ${organizationKey} does not exist`, {structuredData: true});
    return {error: 'no organization'};
  }
  const organization = organizationSnapshot.val();
  if (!organization.spreadsheetId) {
    functions.logger.error(`Error in doReport: organization ${organizationKey} has no spreadsheetId`, {structuredData: true});
    return {error: 'no spreadsheet id'};
  }
  // let's first build information about the holidays in the organization
  organization.holidays = organization.holidays ? JSON.parse(organization.holidays) : {includes: [], excludes: []};
  const includes = [];
  for (const includeStr of organization.holidays.includes) {
    includes.push(new Date(includeStr));
  }
  organization.holidays.includes = includes;
  const excludes = [];
  for (const excludeStr of organization.holidays.excludes) {
    excludes.push(new Date(excludeStr));
  }
  organization.holidays.excludes = excludes;
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
    const usersWithoutEvents = [];
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
      const user = userSnapshot.val();
      const eventsSnapshot = await admin.database().ref(`events/${organizationKey}/${userOrganization.user}`)
        .orderByChild('date').startAt(date).endAt(nextDate).once('value');
      if (!eventsSnapshot.exists()) {
        usersWithoutEvents.push(user);
        continue;
      }
      let userName = user.email;
      if (user.firstName) {
        userName = `${user.firstName} ${user.lastName}`;
      }
      await writeUserHeader(sheets, reportSheetId, organization, reportSheetName, dateString, userName.toUpperCase()                    , writtenRows);
      writtenRows += 2;
      // our first job is to group the events on a day meaning max one event per day
      let events = {};
      let totalHoursHolidays = 0;
      let totalHoursWorkingDays = 0;
      for (const [_key, event] of Object.entries(eventsSnapshot.val())) {
        if (!events[event.date]) {
          events[event.date] = {
            date: new Date(event.date),
            hours: 0,
            reason: [],
            workDone: []
          }
          events[event.date].isHoliday = isHoliday(organization, events[event.date]);
        }
        events[event.date].hours += event.hours;
        events[event.date].reason.push(event.reason);
        events[event.date].workDone.push(event.workDone);
        if (events[event.date].isHoliday) {
          totalHoursHolidays += event.hours;
        } else {
          totalHoursWorkingDays += event.hours;
        }
      }
      events = Object.keys(events).sort().reduce(
        (obj, key) => {
          obj[key] = events[key];
          return obj;
        },
        {}
      );
      let i = 1;
      for (const event of Object.values(events)) {
        await writeEvent(sheets, organization, reportSheetId, reportSheetName, userName, event, writtenRows++, i++);
      }
      await writeTotal(sheets, organization, reportSheetId, reportSheetName, writtenRows++, totalHoursWorkingDays, totalHoursHolidays);
    }
    if (usersWithoutEvents.length > 0) {
      await writeHeaderUsersNoEvents(sheets, organization, reportSheetId, reportSheetName, writtenRows++);
      for (const userWithoutEvents of usersWithoutEvents) {
        let userName = userWithoutEvents.email;
        if (userWithoutEvents.firstName) {
          userName = `${userWithoutEvents.firstName} ${userWithoutEvents.lastName}`.toUpperCase();
        }
        await writeUserNoEvents(sheets, organization, reportSheetId, reportSheetName, userName, writtenRows++);
      }
    }
    // last thing - add border around each cell
    const requests = [];
    requests.push({
      "updateBorders": {
        "range": {
          "sheetId": reportSheetId,
          "startRowIndex": 0,
          "endRowIndex": writtenRows,
          "startColumnIndex": 0,
          "endColumnIndex": 10
        },
        "top": {
          "style": "SOLID",
          "width": 1
        },
        "bottom": {
          "style": "SOLID",
          "width": 1
        },
        "left": {
          "style": "SOLID",
          "width": 1
        },
        "right": {
          "style": "SOLID",
          "width": 1
        },
        "innerHorizontal": {
          "style": "SOLID",
          "width": 1
        },
        "innerVertical": {
          "style": "SOLID",
          "width": 1
        },
      }
    });
    const batchUpdateRequest = {requests};
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: organization.spreadsheetId,
      resource: batchUpdateRequest,
    });
  } catch (e) {
    functions.logger.error(`Error in doReport: ${e.message}`, {structuredData: true});
    return {error: e};
  }
  return {success: true};
}

async function clearSheet(sheets, spreadsheetId, sheetId, sheetName) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: spreadsheetId,
    range: sheetName,
  });
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
  requests.push({
    "autoResizeDimensions": {
      "dimensions": {
        "sheetId": sheetId,
        "dimension": "COLUMNS",
        "startIndex": 0,
        "endIndex": 10
      }
    }
  });
  requests.push({
    "autoResizeDimensions": {
      "dimensions": {
        "sheetId": sheetId,
        "dimension": "ROWS",
        "startIndex": 0,
        "endIndex": 10000
      }
    }
  });
  const batchUpdateRequest = {requests};
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    resource: batchUpdateRequest,
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
            "fontFamily": "Arial",
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
            "fontFamily": "Arial",
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

async function writeUserHeader(sheets, sheetId, organization, sheetName, dateString, userName, row){
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
  requests.push({
    "repeatCell": {
      "range": {
        "sheetId": sheetId,
        "startRowIndex": row + 1,
        "endRowIndex": row + 2,
        "startColumnIndex": 0,
        "endColumnIndex": 10
      },
      "cell": {
        "userEnteredFormat": {
          "backgroundColor": {
            "red": 207/255,
            "green": 226/255,
            "blue": 243/255
          },
          "textFormat": {
            "fontFamily": "Arial",
            "fontSize": 14,
            "bold": true,
            "foregroundColor": {
              "red": 11/255,
              "green": 83/255,
              "blue": 148/255
            },
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
        "startRowIndex": row +1,
        "endRowIndex": row + 2,
        "startColumnIndex": 0,
        "endColumnIndex": 10
      },
      "mergeType": "MERGE_ALL"
    }
  });
  const batchUpdateRequest = {requests};
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: organization.spreadsheetId,
    resource: batchUpdateRequest,
  });

  await updateInRange(sheets, organization.spreadsheetId, [[userName]], `${sheetName}!A${row + 1}`);
  await updateInRange(sheets, organization.spreadsheetId, [[dateString]], `${sheetName}!A${row + 2}`);
}

async function writeEvent(sheets, organization, sheetId, sheetName, userName, event, row, i) {
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
          "textFormat": {
            "fontFamily": "Comfortaa",
            "fontSize": 14
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

  const day = event.date.getUTCDate();
  const month = event.date.getUTCMonth();
  const year = event.date.getUTCFullYear();
  event.date = `${day > 9 ? day : `0${day}`}.${month > 9 ? month : `0${month}`}.${year}`;
  const vals = [i, userName];
  if (event.isHoliday) {
    vals.push('');
    vals.push('');
    vals.push(event.hours);
    vals.push(event.date);
  } else {
    vals.push(event.hours);
    vals.push(event.date);
    vals.push('');
    vals.push('');
  }
  vals.push(event.reason.join("\n"));
  vals.push(event.workDone.join("\n"));
  vals.push(event.isHoliday ? 0 : event.hours * 60);
  vals.push(event.isHoliday ? event.hours * 60 : 0);
  await updateInRange(sheets, organization.spreadsheetId, [vals], `${sheetName}!A${row + 1}`);
}

async function writeTotal(sheets, organization, sheetId, sheetName, row, totalHoursWorkingDays, totalHoursHolidays) {
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
          "textFormat": {
            "fontFamily": "Arial",
            "fontSize": 14,
            "bold": true
          }
        }
      },
      "fields": "userEnteredFormat(textFormat)"
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
  await updateInRange(sheets, organization.spreadsheetId,
    [['', 'ОБЩО:', totalHoursWorkingDays, '', totalHoursHolidays, '', '', '', totalHoursWorkingDays * 60, totalHoursHolidays * 60]],
    `${sheetName}!A${row + 1}`);
}

async function writeHeaderUsersNoEvents(sheets, organization, sheetId, sheetName, row) {
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
            "fontSize": 16,
            "bold": true
          }
        }
      },
      "fields": "userEnteredFormat(backgroundColor,textFormat)"
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
        "pixelSize": 50
      },
      "fields": "pixelSize"
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
  const batchUpdateRequest = {requests};
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: organization.spreadsheetId,
    resource: batchUpdateRequest,
  });
  await updateInRange(sheets, organization.spreadsheetId,
    [['БЕЗ извънреден труд за месеца']],
    `${sheetName}!A${row + 1}`);
}

async function writeUserNoEvents(sheets, organization, sheetId, sheetName, userName, row) {
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
  const batchUpdateRequest = {requests};
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: organization.spreadsheetId,
    resource: batchUpdateRequest,
  });
  await updateInRange(sheets, organization.spreadsheetId, [[userName]], `${sheetName}!A${row + 1}`);
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

function isHoliday(organization, event) {
  if (event.date.getDay() === 0 || event.date.getDay() === 6) {
    // ok. it is weekend but is it excluded?
    let excluded = false;
    for (const excludedDate of organization.holidays.excludes) {
      if (excludedDate.getUTCFullYear() === event.date.getUTCFullYear() &&
        excludedDate.getUTCMonth() === event.date.getUTCMonth() &&
        excludedDate.getUTCDate() === event.date.getUTCDate()) {
        excluded = true;
        break;
      }
    }
    if (excluded) {
      // consider it working day
      return false;
    } else {
      // it is a weekend day and it is not excluded so consider it holiday
      return true;
    }
  } else {
    // ok. it is a working day. check if it is not included in holidays
    let included = false;
    for (const includedDate of organization.holidays.includes) {
      if (includedDate.getUTCFullYear() === event.date.getUTCFullYear() &&
        includedDate.getUTCMonth() === event.date.getUTCMonth() &&
        includedDate.getUTCDate() === event.date.getUTCDate()) {
        included = true;
        break;
      }
    }
    if (included) {
      // it is a working day but it is marked as holiday
      return true;
    } else {
      // it is just a working day
      return false;
    }
  }
}
