var builder = require('botbuilder');
var equals = require('deep-equal');
var restify = require('restify');
var deepcopy = require("deepcopy");

var server = restify.createServer();
server.listen(process.env.PORT, function () {
   console.log('%s listening to %s', server.name, server.url);
});

var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

var intents = new builder.IntentDialog();
bot.dialog('/', intents);

var roomRegex = /^connect to (\w+)$/i;
var rooms = {};

intents.matches(roomRegex, [
    function (session, args, next) {
        var roomName = roomRegex.exec(session.message.text)[1]; // TODO
        rooms[roomName] = rooms[roomName] || [];
        rooms[roomName].push(session.message);
        session.privateConversationData.roomName = roomName;

        session.send('Connected to room ' + roomName);
    }
]);

function shouldSend(targetAddress, currentAddress) {
    return !equals(targetAddress.channelId, currentAddress.channelId) ||
           !equals(targetAddress.conversation, currentAddress.conversation);
}

function reset(session) {
    var roomName = session.privateConversationData.roomName;
    delete session.privateConversationData.roomName;
    delete rooms[roomName];
}

function constructName(message)
{
    return (message.user.name || message.user.id) + " @ " + message.address.channelId;
}

intents.onDefault([
    function (session, args, next) {
        if (session.message.text === 'reset') {
            reset(session);
            session.send('Reset successful');
            return;
        }

        if (!session.privateConversationData.roomName) {
            session.send('For connecting to a room, write "connect to [roomname]"');
        } else {
            var roomName = session.privateConversationData.roomName;

            if (roomName in rooms)
            {
                rooms[roomName].forEach(function (message) {
                    if (shouldSend(message.address, session.message.address)) {
                        var newMessage = deepcopy(message);
                        newMessage.text = constructName(session.message) + ": " + session.message.text;
                        bot.send(newMessage);
                    }
                });
            }
            session.endDialog();
        }
    }
]);
