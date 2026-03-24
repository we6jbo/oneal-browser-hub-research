let world = null;
let state = null;

async function loadWorld() {
  const response = await fetch('world.json');
  world = await response.json();
  document.getElementById('game-title').textContent = world.gameTitle || 'Treasure Quest';
  startGame();
}

function startGame() {
  state = {
    currentRoom: world.startRoom,
    inventory: [],
    score: 0,
    lightTurns: world.lightTurns,
    gameOver: false
  };

  logMessage('Welcome to ' + world.gameTitle + '.');
  logMessage('Your light will last for ' + world.lightTurns + ' turns.');
  render();
}

function getCurrentRoom() {
  return world.rooms[state.currentRoom];
}

function getItemWeight(item) {
  return Number(item.weight || 0);
}

function getInventoryWeight() {
  return state.inventory.reduce((sum, item) => sum + getItemWeight(item), 0);
}

function hasKey(keyId) {
  return state.inventory.some(item => item.type === 'key' && item.keyId === keyId);
}

function useTurn() {
  if (state.gameOver) return;
  state.lightTurns -= 1;
  if (state.lightTurns <= 0) {
    state.lightTurns = 0;
    state.gameOver = true;
    logMessage('Your light has failed. The rooms are now too dark. Game over.');
  }
}

function logMessage(msg) {
  const log = document.getElementById('log');
  const time = new Date().toLocaleTimeString();
  log.textContent += '[' + time + '] ' + msg + '\n';
  log.scrollTop = log.scrollHeight;
}

function render() {
  const room = getCurrentRoom();

  document.getElementById('score').textContent = String(state.score);
  document.getElementById('light-turns').textContent = String(state.lightTurns);
  document.getElementById('carry-weight').textContent = String(getInventoryWeight());
  document.getElementById('max-carry').textContent = String(world.maxCarryWeight);
  document.getElementById('room-name').textContent = room.title;
  document.getElementById('room-title').textContent = room.title;
  document.getElementById('room-story').textContent = room.story;

  const extra = [];
  if (room.isTreasureRoom) {
    extra.push('This room banks treasure into score when you deposit it.');
  }
  if (state.gameOver) {
    extra.push('Game over. Restart to play again.');
  }
  document.getElementById('room-extra').textContent = extra.join(' ');

  renderMovement(room);
  renderRoomItems(room);
  renderInventory(room);

  document.getElementById('deposit-btn').disabled = state.gameOver;
  document.getElementById('restart-btn').onclick = restartGame;
}

function renderMovement(room) {
  const container = document.getElementById('movement-buttons');
  container.innerHTML = '';

  const directions = ['north', 'south', 'east', 'west'];

  directions.forEach(direction => {
    const exitDef = room.exits && room.exits[direction];
    if (!exitDef) return;

    const btn = document.createElement('button');
    btn.className = 'button';
    btn.textContent = 'Go ' + capitalize(direction);
    btn.disabled = state.gameOver;
    btn.onclick = () => move(direction);
    container.appendChild(btn);
  });

  if (!container.children.length) {
    container.innerHTML = '<p class="muted">No exits from this room.</p>';
  }
}

function normalizeExit(exitDef) {
  if (typeof exitDef === 'string') {
    return {
      room: exitDef,
      locked: false
    };
  }
  return exitDef;
}

function move(direction) {
  if (state.gameOver) return;

  const room = getCurrentRoom();
  const exitDefRaw = room.exits && room.exits[direction];
  if (!exitDefRaw) {
    logMessage('You cannot go ' + direction + ' from here.');
    return;
  }

  const exitDef = normalizeExit(exitDefRaw);

  if (exitDef.locked) {
    if (!hasKey(exitDef.keyId)) {
      logMessage(exitDef.message || ('The way ' + direction + ' is locked.'));
      return;
    }
    logMessage('You unlock the way ' + direction + ' using the correct key.');
  }

  if (!world.rooms[exitDef.room]) {
    logMessage('That exit points to a missing room.');
    return;
  }

  state.currentRoom = exitDef.room;
  useTurn();
  logMessage('You move ' + direction + ' to ' + world.rooms[state.currentRoom].title + '.');
  render();
}

function renderRoomItems(room) {
  const container = document.getElementById('room-items');
  container.innerHTML = '';

  if (!room.items || room.items.length === 0) {
    container.innerHTML = '<p class="muted">There are no items in this room.</p>';
    return;
  }

  room.items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    const typeLabel = item.type === 'treasure' ? 'Treasure' : (item.type === 'key' ? 'Key' : 'Item');
    const scoreText = item.type === 'treasure' ? ', score ' + Number(item.score || 0) : '';

    card.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <div class="item-meta">${typeLabel}, weight ${Number(item.weight || 0)}${scoreText}</div>
      <div>${escapeHtml(item.description || '')}</div>
    `;

    const btn = document.createElement('button');
    btn.className = 'button alt';
    btn.textContent = 'Pick Up';
    btn.disabled = state.gameOver;
    btn.onclick = () => pickUpItem(index);
    card.appendChild(document.createElement('br'));
    card.appendChild(btn);

    container.appendChild(card);
  });
}

function pickUpItem(index) {
  if (state.gameOver) return;

  const room = getCurrentRoom();
  const item = room.items[index];
  if (!item) return;

  const nextWeight = getInventoryWeight() + getItemWeight(item);
  if (nextWeight > Number(world.maxCarryWeight)) {
    logMessage('You cannot pick up ' + item.name + '. It would exceed your carry limit.');
    return;
  }

  state.inventory.push(item);
  room.items.splice(index, 1);
  useTurn();
  logMessage('You pick up ' + item.name + '.');
  render();
}

function renderInventory(room) {
  const container = document.getElementById('inventory-items');
  container.innerHTML = '';

  if (!state.inventory.length) {
    container.innerHTML = '<p class="muted">Your inventory is empty.</p>';
    return;
  }

  state.inventory.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    const typeLabel = item.type === 'treasure' ? 'Treasure' : (item.type === 'key' ? 'Key' : 'Item');
    const scoreText = item.type === 'treasure' ? ', score ' + Number(item.score || 0) : '';

    card.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <div class="item-meta">${typeLabel}, weight ${Number(item.weight || 0)}${scoreText}</div>
      <div>${escapeHtml(item.description || '')}</div>
    `;

    const dropBtn = document.createElement('button');
    dropBtn.className = 'button alt';
    dropBtn.textContent = 'Drop';
    dropBtn.disabled = state.gameOver;
    dropBtn.onclick = () => dropItem(index);

    card.appendChild(document.createElement('br'));
    card.appendChild(dropBtn);
    container.appendChild(card);
  });
}

function dropItem(index) {
  if (state.gameOver) return;

  const room = getCurrentRoom();
  const item = state.inventory[index];
  if (!item) return;

  room.items.push(item);
  state.inventory.splice(index, 1);
  useTurn();
  logMessage('You drop ' + item.name + '.');
  render();
}

function depositTreasure() {
  if (state.gameOver) return;

  const room = getCurrentRoom();
  if (!room.isTreasureRoom) {
    logMessage('You can only deposit treasure in the treasure room.');
    return;
  }

  const treasures = state.inventory.filter(item => item.type === 'treasure');
  if (!treasures.length) {
    logMessage('You have no treasure to deposit.');
    return;
  }

  let added = 0;
  state.inventory = state.inventory.filter(item => {
    if (item.type === 'treasure') {
      added += Number(item.score || 0);
      return false;
    }
    return true;
  });

  state.score += added;
  useTurn();
  logMessage('You deposit treasure and gain ' + added + ' points.');
  render();
}

function restartGame() {
  document.getElementById('log').textContent = '';
  startGame();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('deposit-btn').addEventListener('click', depositTreasure);
  loadWorld().catch(err => {
    const log = document.getElementById('log');
    log.textContent = 'Failed to load world.json\n' + String(err);
  });
});
