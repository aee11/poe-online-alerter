#! /usr/bin/env node

import request from 'request';
import yargs from 'yargs';
import notifier from 'node-notifier';
import moment from 'moment';

const argv = yargs
  .usage('Usage: $0 ( --charName [name] | --accountName [name] ) --rate [minutes] --timeout [minutes]')
  .default('rate', 10)
  .describe('rate', 'Check if the user is online every [rate] minutes.')
  .default('timeout', 12*60)
  .describe('timeout', 'How long to run the watcher in minutes.')
  .describe('charName', 'The name of the character you want to watch.')
  .string('charName')
  .describe('accountName', 'The name of the account you want to watch.')
  .string('accountName')
  .boolean('log')
  .describe('log', 'Enables more detailed logging.')
  .string('reason')
  .describe('Reason for watching to remind you later.')
  .help('help')
  .showHelpOnFail(false, 'Specify --help for available options')
  .argv;

let {
  charName,
  accountName,
  rate,
  timeout,
  log,
  reason
} = argv;

let nameType;
let name;
if (accountName) {
  nameType = 'accountName';
  name = accountName;
} else if (charName) {
  nameType = 'charName';
  name = charName;
} else {
  console.error('Missing arguments: Please specify either charName or accountName.');
  yargs.showHelp();
  process.exit();
}

const globalTimeout = setTimeout(() => {
  console.log(`Timeout expired: ${name} has not been online for the last `);
  process.exit();
}, timeout*60*1000);

let firstRequest = true;

function makeRequest() {
  const requestURL = `http://api.exiletools.com/ladder?league=allActive&${nameType}=${name}`;
  request(requestURL, (err, res, body) => {
    if (!err && res.statusCode == 200) {
      if (body.indexOf('ERROR / WARNING') == 0) {
        console.error(`Could not find ${nameType} ${name} on ladder.`);
        process.exit();
      }
      const characters = JSON.parse(body);

      if (firstRequest && nameType === 'accountName') {
        firstRequest = false;
        const lastOnline = Object.keys(characters)
          .map((character) => characters[character].lastOnline)
          .reduce((acc, curr) => {
            if (acc > curr) {
              return acc;
            } else {
              return curr;
            }
          });
        console.log(`User last seen online at ${moment(Number(lastOnline)*1000).format()}, ${moment(Number(lastOnline)*1000).fromNow()} (ladder only).`);
      }

      let message;
      let shouldRetryNow = false;
      const isOnline = Object.keys(characters).some((characterKey) => {
        const character = characters[characterKey];

        if (character.online === '1') {
          clearTimeout(globalTimeout);
          message = `${character.accountName} is online on character ${character.charName}.`;
          console.log(`[${moment().format('HH:mm:ss')}] - ${message}`);
          return true;
        } else if (nameType === 'charName') { // Widen search to accountName instead of charName
          nameType = 'accountName';
          name = character.accountName;
          shouldRetryNow = true;
        }
        return false;
      });
      if (shouldRetryNow) {
        makeRequest();
      } else if (!isOnline) {
        if (log) {
          console.log(`[${moment().format('HH:mm:ss')}] - ${name} is not online.`);
        }
        setTimeout(makeRequest, rate*60*1000);
      } else {
        if (reason) {
          message += `\n${reason}`;
        }
        notifier.notify({
          'title': 'PoE Online Alert!',
          message,
          sound: true
        });
      }
    }
  });
}

makeRequest();
