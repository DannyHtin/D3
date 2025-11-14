// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import our luck function
import luck from "./_luck.ts";

// ===
// DOM SETUP
// ===
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// ===
// CONSTANTS
// ===
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4; // Approx 10m x 10m
const INTERACTION_RADIUS = 3; // Can interact 3 cells away
const SPAWN_PROBABILITY = 0.2; // 20% chance for a cell to have a token
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
  .tileLayer(
    "[https://tile.openstreetmap.org/](https://tile.openstreetmap.org/){z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="[http://www.openstreetmap.org/copyright](http://www.openstreetmap.org/copyright)">OpenStreetMap</a>',
    },
  )
  .addTo(map);

// ===
// HELPER FUNCTIONS (COORDINATES)
// ===

/**
 * Converts a Leaflet LatLng object to its corresponding cell (i, j) coordinates.
 * Anchored at (0, 0) (Null Island).
 */
function latLngToCell(latLng: leaflet.LatLng) {
  const i = Math.floor(latLng.lat / TILE_DEGREES);
  const j = Math.floor(latLng.lng / TILE_DEGREES);
  return { i, j };
}

/**
 * Converts cell (i, j) coordinates to Leaflet LatLngBounds.
 */
function cellToBounds(i: number, j: number) {
  const south = i * TILE_DEGREES;
  const west = j * TILE_DEGREES;
  const north = south + TILE_DEGREES;
  const east = west + TILE_DEGREES;
  return leaflet.latLngBounds([south, west], [north, east]);
}

// ===
// GAME STATE
// ===
let playerInventory: number | null = null;
let gameWon = false;
// `gridCells` is our "Memento" and "Flyweight" store.
// It only stores cells that have tokens (spawned or crafted).
let gridCells = new Map<string, number>();
const cellVisuals = new Map<string, leaflet.Layer>();

// Player's cell coordinate (i, j)
const initialPlayerCell = latLngToCell(CLASSROOM_LATLNG);
let playerI = initialPlayerCell.i;
let playerJ = initialPlayerCell.j;

// Player marker (visual only)
const playerMarker = leaflet.marker(CLASSROOM_LATLNG).addTo(map).bindTooltip(
  "You are here!",
);

// ===
// HELPER FUNCTIONS (GAME)
// ===

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

// This function ONLY removes the visual layer
function removeCell(key: string) {
  const visual = cellVisuals.get(key);
  if (visual) {
    visual.remove();
    cellVisuals.delete(key);
  }
}

function renderCell(key: string, i: number, j: number, value: number) {
  // Use the global coordinate helper
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

// ===
// GAME LOGIC
// ===

/** Handles all logic when a player clicks a cell. */
function onCellClick(key: string, i: number, j: number) {
  if (gameWon) return;

  // 1. Check for interaction radius (relative to player's i,j)
  const distI = Math.abs(i - playerI);
  const distJ = Math.abs(j - playerJ);
  if (Math.max(distI, distJ) > INTERACTION_RADIUS) {
    alert("This cell is too far away to interact with.");
    return;
  }

  const cellValue = gridCells.get(key);

  // Case 1: Inventory is EMPTY
  if (playerInventory === null) {
    if (cellValue) {
      playerInventory = cellValue;
      gridCells.delete(key);
      removeCell(key);
    }
  } // Case 2: Inventory has a token
  else {
    if (cellValue) {
      // Cell has a token: Try to CRAFT
      if (cellValue === playerInventory) {
        const newValue = cellValue * 2;
        playerInventory = null; // Empty inventory

        removeCell(key); // Remove old visual
        gridCells.set(key, newValue); // Set new state
        renderCell(key, i, j, newValue); // Render new visual

        if (newValue >= WIN_SCORE) {
          gameWon = true;
          alert(`You crafted a ${newValue} token! You win!`);
        }
      } else {
        alert("You must combine tokens of the same value.");
      }
    } else {
      // Cell is empty: PLACE token
      gridCells.set(key, playerInventory);
      renderCell(key, i, j, playerInventory);
      playerInventory = null;
    }
  }
  updateStatusPanel();
}

/**
 * Main update loop.
 * Called on 'moveend' (pan or scroll).
 * Despawns off-screen visuals and spawns/restores cells in view.
 */
function updateMap() {
  const bounds = map.getBounds();

  // 1. Calculate the *exact* range of visible cells
  const iMin = Math.floor(bounds.getSouth() / TILE_DEGREES);
  const iMax = Math.ceil(bounds.getNorth() / TILE_DEGREES);
  const jMin = Math.floor(bounds.getWest() / TILE_DEGREES);
  const jMax = Math.ceil(bounds.getEast() / TILE_DEGREES);

  // 2. Despawn VISUALS (but not data)
  const keysToRemove: string[] = [];
  for (const key of cellVisuals.keys()) {
    const [iStr, jStr] = key.split(",");
    const i = parseInt(iStr);
    const j = parseInt(jStr);

    if (i < iMin || i > iMax || j < jMin || j > jMax) {
      keysToRemove.push(key);
    }
  }
  // Now, safely remove them (this just removes the visual layer)
  for (const key of keysToRemove) {
    removeCell(key);
  }

  // 3. Spawn / Re-render cells *inside* this exact range
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i},${j}`;

      // Skip if this cell's VISUAL is already drawn
      if (cellVisuals.has(key)) {
        continue;
      }

      // Check if this cell has saved state (Memento)
      let value = gridCells.get(key);

      if (value === undefined) {
        // No saved state. Check if it should spawn (Flyweight)
        // We run luck() once and store the result
        if (luck(key) < SPAWN_PROBABILITY) {
          value = 1;
          gridCells.set(key, 1); // Store its state
        }
      }

      // If we have a value (either from Memento or new spawn), render it
      if (value !== undefined) {
        renderCell(key, i, j, value);
      }
    }
  }
}

/**
 * Handles player movement, updating state and panning the map.
 */
function movePlayer(di: number, dj: number) {
  if (gameWon) return;

  playerI += di;
  playerJ += dj;

  const playerCenter = cellToBounds(playerI, playerJ).getCenter();
  playerMarker.setLatLng(playerCenter);
  map.panTo(playerCenter);
  // `updateMap()` will be called automatically by the 'moveend' event
}

// ===
// SAVE / LOAD LOGIC
// ===

interface SaveState {
  playerI: number;
  playerJ: number;
  playerInventory: number | null;
  gridCellEntries: [string, number][];
}

function saveGame() {
  const saveState: SaveState = {
    playerI: playerI,
    playerJ: playerJ,
    playerInventory: playerInventory,
    gridCellEntries: Array.from(gridCells.entries()),
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(saveState));
  alert("Game Saved!");
}

function loadGame(): boolean {
  const json = localStorage.getItem(SAVE_KEY);
  if (!json) {
    console.log("No save file found.");
    return false; // No save file
  }

  try {
    const saveState: SaveState = JSON.parse(json);
    playerI = saveState.playerI;
    playerJ = saveState.playerJ;
    playerInventory = saveState.playerInventory;
    gridCells = new Map(saveState.gridCellEntries);

    console.log("Game Loaded!");
    return true; // Load successful
  } catch (e) {
    console.error("Error loading save file:", e);
    return false; // Load failed
  }
}

function resetGame() {
  if (confirm("Are you sure you want to reset your progress?")) {
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  }
}

// ===
// UI & INITIALIZATION
// ===

// Add movement buttons
const northBtn = document.createElement("button");
northBtn.innerHTML = "North";
northBtn.onclick = () => movePlayer(1, 0);

const southBtn = document.createElement("button");
southBtn.innerHTML = "South";
southBtn.onclick = () => movePlayer(-1, 0);

const eastBtn = document.createElement("button");
eastBtn.innerHTML = "East";
eastBtn.onclick = () => movePlayer(0, 1);

const westBtn = document.createElement("button");
westBtn.innerHTML = "West";
westBtn.onclick = () => movePlayer(0, -1);

// Add Save/Reset buttons
const saveBtn = document.createElement("button");
saveBtn.innerHTML = "Save";
saveBtn.onclick = saveGame;

const resetBtn = document.createElement("button");
resetBtn.innerHTML = "Reset";
resetBtn.onclick = resetGame;

controlPanelDiv.append(northBtn, southBtn, eastBtn, westBtn, saveBtn, resetBtn);

// Listen for map moves (pan, scroll, zoom) to update cells
map.on("moveend", updateMap);

// --- Main Initialization ---

// Try to load game state
const loaded = loadGame();

if (loaded) {
  // If load successful, move map to player's saved position
  const playerCenter = cellToBounds(playerI, playerJ).getCenter();
  playerMarker.setLatLng(playerCenter);
  map.setView(playerCenter, GAMEPLAY_ZOOM_LEVEL); // Use setView for instant move
}
// If no save, map defaults to CLASSROOM_LATLNG (set during map creation)

updateStatusPanel(); // Show loaded (or new) inventory
updateMap(); // Draw cells (either loaded or new)
