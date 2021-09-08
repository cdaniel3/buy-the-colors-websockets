'use strict';

const express = require('express');
const path = require('path')
const { Server } = require('ws');

const INDEX = 'index.html';
const PORT = process.env.PORT || 3000;

const server = express()
    .use(express.static(path.join(__dirname, "public")))
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server });


let activePlayers = [];
let inactivePlayers = [];
let gamestate = undefined;
let isStarted = false;

// TODO: move maxPlayers to be configured in the 'register' operation and use the first value (from the first player / socket connection)
const maxPlayers = 4;

function noop() {}
 
function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', function connection(ws) {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', function incoming(message) {
    const wsMessage = JSON.parse(message);
    if (wsMessage.op === 'register') {
      register(wsMessage.data, ws);

    } else if (wsMessage.op === 'start') {      
      startGameWithPlayers(wsMessage.data);

    } else if (wsMessage.op === 'ingame') {
      gamestate = wsMessage.data;
      sendToAll(activePlayers, wsMessage.data);

    } else if (wsMessage.op === 'reconnect') {
      reconnect(wsMessage.data, ws);

    } else if (wsMessage.op === 'quit') {
      console.log('TODO: handle quit msg');

    } else {
      // Unknown operation
      sendError(ws, 'nodejs error: ' + wsMessage.op);

    }
    console.log('---');
  });

  ws.on('close', () => {
    const disconnectedPlayers = findDisconnectedPlayers();
    disconnectedPlayers.forEach(disconnectedPlayer => {
      let disconnectMsg = {
        title: 'Disconnected',
        message: disconnectedPlayer.name + ' disconnected'
      };
      sendToAll(activePlayers, disconnectMsg);
      console.log('player(s) disconnected: ' + disconnectedPlayer.name);
    });

    updateActiveAndInactivePlayers(disconnectedPlayers);
    sendToAll(activePlayers, getRegisteredPlayersMsg());
    logPlayers();  
    console.log('---');  
  });
});

wss.on('close', function close() {
  clearInterval(interval);
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    console.log('keep alive');
    if (ws.isAlive === false) return ws.terminate();
 
    ws.isAlive = false;
    ws.ping(noop);
  });
}, 10000);

function findDisconnectedPlayers() {
  return activePlayers.filter(player => !wss.clients.has(player.ws));
}

function updateActiveAndInactivePlayers(disconnectedPlayers) {
    const disconnectedPlayerNames = disconnectedPlayers.map(player => player.name);
    activePlayers = activePlayers.filter(player => !disconnectedPlayerNames.includes(player.name));
    inactivePlayers = inactivePlayers.concat(disconnectedPlayers);  
}

function reconnect(playerName, playerWebsocket) {
  // TODO remove this duplicate check, move it to the on message function
  if (inactivePlayers.find(player => player.name === playerName) !== undefined) {
    makePlayerActive(playerName, playerWebsocket);
  }
  if (gamestate !== undefined) {
    const reconnectStateJSON = JSON.stringify(gamestate);
    console.log(playerName + " is rejoining. Sending state: " + reconnectStateJSON);
    playerWebsocket.send(reconnectStateJSON);    
  } else {
    sendToAll(activePlayers, getRegisteredPlayersMsg());
  }

  let reconnectMsg = {
    title: 'reconnect',
    message: playerName + ' rejoined'
  };
  sendToAll(activePlayers, reconnectMsg);
  logPlayers();
}

function register(playerName, playerWebsocket) {  
  const registeringPlayer = inactivePlayers.find(player => player.name === playerName);
  if (registeringPlayer != undefined) {
    // Player is rejoining
    reconnect(playerName, playerWebsocket);
  } else {
    // New player is registering
    if (isAcceptingPlayers()) {
      addPlayer(playerName, playerWebsocket);
      console.log('registered player: ', playerName);

      if (activePlayers.length < maxPlayers) {
        // Refresh list of active players
        sendToAll(activePlayers, getRegisteredPlayersMsg());        
      } else if (activePlayers.length === maxPlayers) {
        startGame();
      } else {
        // concurrency issue - error out
        sendToAll(activePlayers, 'Error with game state');
      }

    } else {
      sendError(playerWebsocket, 'Game already in progress');
    }
  }
}

function startGameWithPlayers(playerNames) {
  let newActivePlayers = activePlayers.filter(player => playerNames.includes(player.name));
  activePlayers = newActivePlayers;
  startGame();
}

function startGame() {
  // Send a msg to start the game
  sendToAll(activePlayers, getPlayerNames(activePlayers));
  inactivePlayers = [];
  isStarted = true;

  console.log("starting game");
  logPlayers();
}

function isAcceptingPlayers() {
  return !isStarted && activePlayers.length + inactivePlayers.length < maxPlayers;
}

function makePlayerActive(playerName, ws) {
  // Remove from inactive
  inactivePlayers = inactivePlayers.filter(player => player.name !== playerName);
  // Add to active
  addPlayer(playerName, ws);
}

function addPlayer(playerName, ws) {
  activePlayers.push({
    name: playerName,
    ws: ws
  });
}

function sendToAll(players, msg) {
  for (const player of players) {
    player.ws.send(JSON.stringify(msg));
  }
}

function getRegisteredPlayersMsg() {
  return {
    registeredPlayers: 
      activePlayers.map(player => player.name)
  }
}

function getPlayerNames(players) {
  let names = [];
  for (const player of players) {
    names.push(player.name);
  }
  return names;
}


function sendError(ws, errorMessage) {
  console.log(errorMessage);
  const error = {
    title: 'error',
    message: errorMessage
  };
  ws.send(JSON.stringify(error));
}

function logPlayers() {
  console.log("active: ", activePlayers.map(p => p.name));
  console.log("inactive: ", inactivePlayers.map(p => p.name));
}
