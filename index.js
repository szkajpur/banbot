// NODE MODULES & CONFIG

const config = require("./config.json");
const plik = require(config.listPath);
const mody = require(config.modsPath);
const { ChatClient } = require("dank-twitch-irc");
const TwitchPS = require('@sammwy/twitch-ps');
const got = require('got');
const fs = require("fs");
const { time } = require("console");
const usernameRegex = new RegExp(/^@?([\w]{1,25}),?$/);


// CONNECT TO PUBSUB TOPICS

let init_topics = [{topic: `community-points-channel-v1.${config.pubsubID}`, token: config.oauth}];
var ps = new TwitchPS({reconnect: true, init_topics: init_topics, debug: true});

// TWITCH CHAT CONNECT

let client = new ChatClient({
    username: config.username,
    password: `oauth:${config.oauth}`,
    rateLimits: "default"
});

client.on("connecting", () => console.log("Connecting..."));
client.on("ready", () => {
    console.log(`Connected to chat #${config.channel}`);
    client.say(config.channel, `Connected to chat #${config.channel}!`);
});
client.on("close", (error) => {
  if (error != null) 
    console.error("Client closed due to error", error);
  else
    console.error("Error: NULL");
});

// DOWNLOADING LIST OF CHATTERS

function getViewers(){
  (async () => {
    try {
      const response = await got(`https://tmi.twitch.tv/group/user/${config.channel}/chatters`);
      const lista = JSON.parse(response.body);
      const listy = [...(lista.chatters.viewers), ...(lista.chatters.vips)];
      const modzi = [...(lista.chatters.moderators), ...(lista.chatters.broadcaster)];
      fs.writeFileSync(config.listPath, JSON.stringify(listy, null, 4));
      fs.writeFileSync(config.modsPath, JSON.stringify(modzi, null, 4));
      console.log(`#${config.channel} UPDATE! chatters: (${listy.length}) moderators: (${modzi.length})`);
    } catch (error) {
      console.log(error.response.body);
      return;
    }
  })();
}

getViewers();

setInterval(getViewers, 180000);

// PUBSUB

ps.on('reward-redeemed', (data) => {
  const banner = data.redemption.user.display_name;
  let args = data.redemption.user_input.trim().split(' ');
  let match = usernameRegex.exec(args[0].toLowerCase());
  if (match === null){
    client.say(config.channel, `@${banner}, nie podano poprawnie użytkownika do zbanowania!`)
    return;
  }
  let target = match[1];
  if (target == config.channel || mody.includes(target)){
    client.say(config.channel, `@${banner}, nie można wykluczyć moda/strimera!`);
    return;
  }
  if (plik.includes(target)){
    client.timeout(config.channel, target, 300, `Zostałeś wykluczony z czatu przez ${banner}`);
    client.say(config.channel, `Pomyślnie zbanowano na 5 minut użytkownika ${target}! Wykupione przez ${banner}`)
    console.log(`${banner} wykluczył ${target}`);
  }
  else {
    client.say(config.channel, `MODS Nie udało się znaleźć ${target}! Wykupione przez ${banner}`);
    console.log(`Nie udało się znaleźć ${target} wykluczonego przez ${banner}`);
  }
});

// TWITCH COMMANDS

client.on("PRIVMSG", async (msg) => {
  if (msg.senderUsername == client.configuration.username){
    return;
  }
  if (!msg.messageText.startsWith(config.prefix)) {
    return;
  }
  let args = msg.messageText.slice(config.prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();
  switch(command){
    case "help":
      if (!msg.isMod){
        return;
      }
      client.say(config.channel, `@${msg.senderUsername}, ${config.prefix}timeout [nick] [ilość timeoutów]`);
      break;
    case "timeout":
      if (!msg.isMod){
        return;
      }
      if (args.length < 2){
        client.say(config.channel, `@${msg.senderUsername}, Brak argumentów! ${config.prefix}timeout [nick] [ilość timeoutów]`);
        return;
      }
      let nick = usernameRegex.exec(args[0].toLowerCase());
      let timeout = parseInt(args[1]);
      timeout *= 300;
      client.timeout(config.channel, nick, timeout, `Zostałeś ręcznie wykluczony z czatu na ${timeout} sekund przez ${msg.senderUsername}!`);
      console.log(`${msg.senderUsername} ręcznie wykluczył ${nick} na ${timeout} sekund`);
      break;
  }
});

// CONNECT

client.connect();
client.join(config.channel);
