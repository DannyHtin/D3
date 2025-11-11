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
const WIN_SCORE = 32; // Increased win score for D3.b

// ===
// MAP SETUP
// ===
// Map is now unlocked (no min/max zoom, scroll/drag enabled)
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
const gridCells = new Map<string, number>();
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

function removeCell(key: string) {
  gridCells.delete(key);
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
      removeCell(key);
    }
  } // Case 2: Inventory has a token
  else {
    if (cellValue) {
      // Cell has a token: Try to CRAFT
      if (cellValue === playerInventory) {
        const newValue = cellValue * 2;
        gridCells.set(key, newValue); // Update state
        playerInventory = null; // Empty inventory
        removeCell(key); // Remove old visual
        renderCell(key, i, j, newValue); // Render new one

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
 * Despawns off-screen cells and spawns new ones.
 */
function updateMap() {
  const bounds = map.getBounds();

  // 1. Despawn (Memoryless): Remove cells outside the new view
  for (const key of cellVisuals.keys()) {
    const [iStr, jStr] = key.split(",");
    const i = parseInt(iStr);
    const j = parseInt(jStr);
    const cellBounds = cellToBounds(i, j);

    if (!bounds.intersects(cellBounds)) {
      removeCell(key);
    }
  }

  // 2. Spawn: Add new cells inside the view
  const iMin = Math.floor(bounds.getSouth() / TILE_DEGREES);
  const iMax = Math.ceil(bounds.getNorth() / TILE_DEGREES);
  const jMin = Math.floor(bounds.getWest() / TILE_DEGREES);
  const jMax = Math.ceil(bounds.getEast() / TILE_DEGREES);

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i},${j}`;

      // Skip if this cell already exists (from spawn or player action)
      if (gridCells.has(key)) {
        continue;
      }

      // Use luck to determine if a token spawns here
      if (luck(key) < SPAWN_PROBABILITY) {
        gridCells.set(key, 1);
        renderCell(key, i, j, 1);
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

controlPanelDiv.append(northBtn, southBtn, eastBtn, westBtn);

// Listen for map moves (pan, scroll, zoom) to update cells
map.on("moveend", updateMap);

// Initial setup
updateStatusPanel();
updateMap(); // Draw the first set of cells
