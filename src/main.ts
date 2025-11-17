// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import our luck function
import luck from "./_luck.ts";

// DOM SETUP

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// CONSTANTS

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const INTERACTION_RADIUS = 3;
const SPAWN_PROBABILITY = 0.2;
const WIN_SCORE = 32;
const SAVE_KEY = "tokenCrafterSave";

// ===
// MAP SETUP
// ===
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// HELPER FUNCTIONS (COORDINATES)

function latLngToCell(latLng: leaflet.LatLng) {
  const i = Math.floor(latLng.lat / TILE_DEGREES);
  const j = Math.floor(latLng.lng / TILE_DEGREES);
  return { i, j };
}

function cellToBounds(i: number, j: number) {
  const south = i * TILE_DEGREES;
  const west = j * TILE_DEGREES;
  const north = south + TILE_DEGREES;
  const east = west + TILE_DEGREES;
  return leaflet.latLngBounds([south, west], [north, east]);
}

// GAME STATE

let playerInventory: number | null = null;
let gameWon = false;
let gridCells = new Map<string, number>();
const cellVisuals = new Map<string, leaflet.Layer>();

const initialPlayerCell = latLngToCell(CLASSROOM_LATLNG);
let playerI = initialPlayerCell.i;
let playerJ = initialPlayerCell.j;

const playerMarker = leaflet.marker(CLASSROOM_LATLNG).addTo(map).bindTooltip(
  "You are here!",
);

// HELPER FUNCTIONS (GAME)

function updateStatusPanel() {
  if (gameWon) {
    statusPanelDiv.innerHTML = `Inventory: ${
      playerInventory ?? "Empty"
    } | **You crafted a ${WIN_SCORE} token! You win!**`;
    return;
  }
  statusPanelDiv.innerHTML = `Inventory: <strong>${
    playerInventory === null ? "Empty" : playerInventory
  }</strong>`;
}

function removeCell(key: string) {
  const visual = cellVisuals.get(key);
  if (visual) {
    visual.remove();
    cellVisuals.delete(key);
  }
}

function renderCell(key: string, i: number, j: number, value: number) {
  const bounds = cellToBounds(i, j);
  const rect = leaflet.rectangle(bounds, {
    color: "#3388ff",
    weight: 1,
    fillOpacity: 0.1,
  });

  rect.bindTooltip(value.toString(), {
    permanent: true,
    direction: "center",
    className: "cell-tooltip",
  });

  rect.on("click", () => onCellClick(key, i, j));
  rect.addTo(map);
  cellVisuals.set(key, rect);
}

// GAME LOGIC

function onCellClick(key: string, i: number, j: number) {
  if (gameWon) return;

  const distI = Math.abs(i - playerI);
  const distJ = Math.abs(j - playerJ);
  if (Math.max(distI, distJ) > INTERACTION_RADIUS) {
    alert("This cell is too far away to interact with.");
    return;
  }

  const cellValue = gridCells.get(key);

  if (playerInventory === null) {
    if (cellValue) {
      playerInventory = cellValue;
      gridCells.delete(key);
      removeCell(key);
    }
  } else {
    if (cellValue) {
      if (cellValue === playerInventory) {
        const newValue = cellValue * 2;
        playerInventory = null;
        removeCell(key);
        gridCells.set(key, newValue);
        renderCell(key, i, j, newValue);
        if (newValue >= WIN_SCORE) {
          gameWon = true;
          alert(`You crafted a ${newValue} token! You win!`);
        }
      } else {
        alert("You must combine tokens of the same value.");
      }
    } else {
      gridCells.set(key, playerInventory);
      renderCell(key, i, j, playerInventory);
      playerInventory = null;
    }
  }
  updateStatusPanel();
}

function updateMap() {
  const bounds = map.getBounds();
  const iMin = Math.floor(bounds.getSouth() / TILE_DEGREES);
  const iMax = Math.ceil(bounds.getNorth() / TILE_DEGREES);
  const jMin = Math.floor(bounds.getWest() / TILE_DEGREES);
  const jMax = Math.ceil(bounds.getEast() / TILE_DEGREES);

  const keysToRemove: string[] = [];
  for (const key of cellVisuals.keys()) {
    const [iStr, jStr] = key.split(",");
    const i = parseInt(iStr);
    const j = parseInt(jStr);
    if (i < iMin || i > iMax || j < jMin || j > jMax) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    removeCell(key);
  }

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i},${j}`;
      if (cellVisuals.has(key)) continue;

      let value = gridCells.get(key);
      if (value === undefined) {
        if (luck(key) < SPAWN_PROBABILITY) {
          value = 1;
          gridCells.set(key, 1);
        }
      }
      if (value !== undefined) {
        renderCell(key, i, j, value);
      }
    }
  }
}

function updatePlayerPosition(lat: number, lng: number) {
  if (gameWon) return;

  const newCell = latLngToCell(leaflet.latLng(lat, lng));
  playerI = newCell.i;
  playerJ = newCell.j;

  const playerCenter = cellToBounds(playerI, playerJ).getCenter();
  playerMarker.setLatLng(playerCenter);
  map.panTo(playerCenter); // updateMap will be triggered by the move event
}

function movePlayerManual(di: number, dj: number) {
  const playerCenter = cellToBounds(playerI, playerJ).getCenter();
  const newLat = playerCenter.lat + di * TILE_DEGREES;
  const newLng = playerCenter.lng + dj * TILE_DEGREES;
  updatePlayerPosition(newLat, newLng);
}

// GEOLOCATION FACADE

const locationService = {
  watchId: null as number | null,

  start(onUpdate: (lat: number, lng: number) => void) {
    if ("geolocation" in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          onUpdate(position.coords.latitude, position.coords.longitude);
        },
        (error) => console.error("GPS Error:", error),
        { enableHighAccuracy: true },
      );
    } else {
      alert("Geolocation is not available in this browser.");
    }
  },

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  },
};

let isGeolocationActive = false;

function toggleGeolocation() {
  if (isGeolocationActive) {
    // Turn GPS OFF
    locationService.stop();
    isGeolocationActive = false;
    sensorBtn.innerHTML = "📍 GPS: OFF";
    sensorBtn.classList.remove("active");
    // Re-enable manual buttons
    northBtn.disabled = false;
    southBtn.disabled = false;
    eastBtn.disabled = false;
    westBtn.disabled = false;
  } else {
    // Turn GPS ON
    isGeolocationActive = true;
    sensorBtn.innerHTML = "📍 GPS: ON";
    sensorBtn.classList.add("active");
    // Disable manual buttons
    northBtn.disabled = true;
    southBtn.disabled = true;
    eastBtn.disabled = true;
    westBtn.disabled = true;

    locationService.start((lat, lng) => {
      updatePlayerPosition(lat, lng);
    });
  }
}

// ===
// SAVE / LOAD LOGIC
// ===

interface SaveState {
  playerI: number;
  playerJ: number;
  playerInventory: number | null;
  gridCellEntries: [string, number][];
  isGeolocationActive: boolean; // Added GPS state to save
}

function saveGame() {
  const saveState: SaveState = {
    playerI: playerI,
    playerJ: playerJ,
    playerInventory: playerInventory,
    gridCellEntries: Array.from(gridCells.entries()),
    isGeolocationActive: isGeolocationActive,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveState));
  alert("Game Saved!");
}

function loadGame(): boolean {
  const json = localStorage.getItem(SAVE_KEY);
  if (!json) return false;

  try {
    const saveState: SaveState = JSON.parse(json);
    playerI = saveState.playerI;
    playerJ = saveState.playerJ;
    playerInventory = saveState.playerInventory;
    gridCells = new Map(saveState.gridCellEntries);

    // Restore geolocation state if it was active
    if (saveState.isGeolocationActive) {
      toggleGeolocation();
    }

    console.log("Game Loaded!");
    return true;
  } catch (e) {
    console.error("Error loading save file:", e);
    return false;
  }
}

function resetGame() {
  if (confirm("Are you sure you want to reset your progress?")) {
    localStorage.removeItem(SAVE_KEY);
    globalThis.location.reload();
  }
}

// ===
// UI & INITIALIZATION
// ===

// Add movement buttons
const northBtn = document.createElement("button");
northBtn.innerHTML = "North";
northBtn.onclick = () => movePlayerManual(1, 0);

const southBtn = document.createElement("button");
southBtn.innerHTML = "South";
southBtn.onclick = () => movePlayerManual(-1, 0);

const eastBtn = document.createElement("button");
eastBtn.innerHTML = "East";
eastBtn.onclick = () => movePlayerManual(0, 1);

const westBtn = document.createElement("button");
westBtn.innerHTML = "West";
westBtn.onclick = () => movePlayerManual(0, -1);

// GPS Toggle Button
const sensorBtn = document.createElement("button");
sensorBtn.innerHTML = "📍 GPS: OFF";
sensorBtn.onclick = toggleGeolocation;
// Simple style for active button
const style = document.createElement("style");
style.innerHTML = `
  .active { background-color: #4CAF50; color: white; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
`;
document.head.appendChild(style);

// Add Save/Reset buttons
const saveBtn = document.createElement("button");
saveBtn.innerHTML = "Save";
saveBtn.onclick = saveGame;

const resetBtn = document.createElement("button");
resetBtn.innerHTML = "Reset";
resetBtn.onclick = resetGame;

controlPanelDiv.append(
  northBtn,
  southBtn,
  eastBtn,
  westBtn,
  sensorBtn,
  saveBtn,
  resetBtn,
);

// Listen for map moves
map.on("moveend", updateMap);

// Check URL param to auto-enable GPS (Assignment req)
const urlParams = new URLSearchParams(globalThis.location.search);
if (urlParams.get("movement") === "geolocation") {
  toggleGeolocation();
}

const loaded = loadGame();

if (loaded) {
  const playerCenter = cellToBounds(playerI, playerJ).getCenter();
  playerMarker.setLatLng(playerCenter);
  map.setView(playerCenter, GAMEPLAY_ZOOM_LEVEL);
}

updateStatusPanel();
updateMap();
