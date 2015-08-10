import request from 'request';
import yargs from 'yargs';
import notifier from 'node-notifier';

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
  .help('help')
  .showHelpOnFail(false, 'Specify --help for available options')
  .argv;

let {
  charName,
  accountName,
  rate,
  timeout
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
  console.log(`Timeout expired: ${name} has not been online for the last `)
}, timeout*60*1000);

function makeRequest() {
  const requestURL = `http://api.exiletools.com/ladder?league=allActive&${nameType}=${name}`;
  console.log('Making request: ', requestURL);
  request(requestURL, (err, res, body) => {
    if (!err && res.statusCode == 200) {
      if (body.indexOf('ERROR / WARNING') == 0) {
        console.error(`Could not find ${nameType} ${name} on ladder.`);
        process.exit();
      }
      let message;
      const characters = JSON.parse(body);
      console.log(characters);
      const isOnline = Object.keys(characters).some((characterKey) => {
        const character = characters[characterKey];
        if (character.online === '1') {
          message = `${character.accountName} is online on character ${character.charName}.`;
          console.log(message);
          return true;
        } else if (nameType === 'charName') { // Widen search to accountName instead of charName
          nameType = 'accountName';
          name = character.accountName;
          makeRequest();
          return true;
        }
      });
      if (!isOnline) {
        setTimeout(makeRequest, rate*60*1000);
      } else {
        notifier.notify({
          'title': 'POE Alerter!',
          message,
          sound: true
        });
        process.exit();
      }
    }
  });
}

makeRequest();
