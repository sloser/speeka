var
    sys = require('sys'),
    path = require('path'),
    http = require('http'),
    paperboy = require('paperboy'),
    nowjs = require('now'),
    uuid = require('uuid');

var webroot = path.join(path.dirname(__filename), 'web');

server = http.createServer(function (req, res) {
    paperboy .deliver(webroot, req, res);
});

var everyone = nowjs.initialize(server);
var chatrooms = {};

everyone.now.createRoom = function(cb) {
    var room_id = Buffer(uuid.generate('binary')).toString('base64').slice(0, 10);
    var group = nowjs.getGroup(room_id);

    chatrooms[room_id] = {
        group: group,
        members: {}
    };

    console.log('New room created: ' + room_id);
    cb(room_id);
}

everyone.now.joinRoom = function(room_id, nick, cb) {
    var r = chatrooms[room_id];
    if (!r) {
        console.log("Client " + this.user.clientId + " tried to open unexistent room " + room_id);
        cb(false);
        return;
    }

    var people = [];
    for (k in r.members)
        people.push(r.members[k]);

    cb(true);
    r.group.addUser(this.user.clientId);
    r.members[this.user.clientId] = nick;
    r.group.now.receiveJoin(this.user.clientId, nick);
    console.log('Client ' + this.user.clientId + ' joined the room ' + room_id);

    this.now.receiveNicknameList(people);
};

everyone.now.sendMessage = function(room_id, message) {
    var r = chatrooms[room_id];
    if (!r) return;

    var nick = r.members[this.user.clientId];
    if (nick == undefined) return;

    if (!message) return;

    r.group.now.receiveMessage(this.user.clientId, nick, message);
    console.log('Client ' + this.user.clientId + ' sent message in room ' + room_id);
}

everyone.now.changeNickname = function(room_id, nick) {
    var r = chatrooms[room_id];
    if (!r) return;

    var old_nick = r.members[this.user.clientId];
    if (old_nick == undefined) return;

    r.members[this.user.clientId] = nick;
    r.group.now.receiveNickChange(this.user.clientId, old_nick, nick);

    console.log('Client ' + this.user.clientId + ' changed nickname');
}

everyone.on('disconnect', function() {
    for (var room_id in chatrooms) {
        var r = chatrooms[room_id];
        var nick = r.members[this.user.clientId];

        if (nick == undefined)
            continue;

        delete r.members[this.user.clientId];
        console.log('Client ' + this.user.clientId + ' left room ' + room_id);

        if (Object.keys(r.members).length > 0) {
            r.group.now.receiveLeave(this.user.clientId, nick);
        } else{
            delete chatrooms[room_id];
            console.log('Deleted empty room ' + room_id);
        }
    }
});

server.listen(7070);

