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
// We create and append the three main DOM elements for our game.
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
const WIN_SCORE = 16; // Craft a token of this value to win

// ===
// MAP SETUP
// ===
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false, // Core mechanic: map is fixed
  doubleClickZoom: false,
  dragging: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player marker (visual only, logic is based on (0,0) cell)
leaflet.marker(CLASSROOM_LATLNG).addTo(map).bindTooltip("You are here!");

// ===
// GAME STATE
// ===
// We use Maps to store sparse data about the grid.
// The key is a simple string "i,j" for the cell coordinates.
let playerInventory: number | null = null;
let gameWon = false;
// Stores the token value for a given cell
const gridCells = new Map<string, number>();
// Stores the Leaflet layer (the rectangle visual) for a given cell
const cellVisuals = new Map<string, leaflet.Layer>();

// ===
// HELPER FUNCTIONS
// ===

/** Updates the status panel to reflect the player's inventory. */
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

/** Removes a cell's token and its visual from the map. */
function removeCell(key: string) {
  gridCells.delete(key);
  const visual = cellVisuals.get(key);
  if (visual) {
    visual.remove(); // Remove from map
    cellVisuals.delete(key);
  }
}

/**
 * Creates the visual rectangle for a cell and adds its click listener.
 * Assumes the token value is already in gridCells.
 */
function renderCell(key: string, i: number, j: number, value: number) {
  // 1. Calculate Leaflet bounds
  const bounds = leaflet.latLngBounds([
    [
      CLASSROOM_LATLNG.lat + i * TILE_DEGREES,
      CLASSROOM_LATLNG.lng + j * TILE_DEGREES,
    ],
    [
      CLASSROOM_LATLNG.lat + (i + 1) * TILE_DEGREES,
      CLASSROOM_LATLNG.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  // 2. Create rectangle
  const rect = leaflet.rectangle(bounds, {
    color: "#3388ff",
    weight: 1,
    fillOpacity: 0.1,
  });

  // 3. Bind tooltip (visible without click)
  rect.bindTooltip(value.toString(), {
    permanent: true,
    direction: "center",
    className: "cell-tooltip",
  });

  // 4. Bind click listener
  rect.on("click", () => onCellClick(key, i, j));

  // 5. Add to map and state
  rect.addTo(map);
  cellVisuals.set(key, rect);
}

// ===
// GAME LOGIC
// ===

/** Handles all logic when a player clicks a cell. */
function onCellClick(key: string, i: number, j: number) {
  if (gameWon) return; // Game is over

  // 1. Check for interaction radius
  const distance = Math.max(Math.abs(i), Math.abs(j));
  if (distance > INTERACTION_RADIUS) {
    alert("This cell is too far away to interact with.");
    return;
  }

  const cellValue = gridCells.get(key);

  // Case 1: Inventory is EMPTY
  if (playerInventory === null) {
    if (cellValue) {
      // Pick up the token
      playerInventory = cellValue;
      removeCell(key);
      console.log(`Picked up: ${cellValue}`);
    } else {
      // Clicked an empty cell with an empty inventory
      console.log("Clicked an empty cell.");
    }
  } // Case 2: Inventory has a token
  else {
    if (cellValue) {
      // Cell has a token: Try to CRAFT
      if (cellValue === playerInventory) {
        // Craft success!
        const newValue = cellValue * 2;
        gridCells.set(key, newValue); // Update state
        playerInventory = null; // Empty inventory

        // Update visual
        removeCell(key); // Remove old visual
        renderCell(key, i, j, newValue); // Render new one
        console.log(`Crafted: ${newValue}`);

        // Win check
        if (newValue >= WIN_SCORE) {
          gameWon = true;
          alert(`You crafted a ${newValue} token! You win!`);
        }
      } else {
        // Craft fail: different values
        alert("You must combine tokens of the same value.");
      }
    } else {
      // Cell is empty: PLACE token
      gridCells.set(key, playerInventory);
      renderCell(key, i, j, playerInventory);
      console.log(`Placed: ${playerInventory}`);
      playerInventory = null; // Empty inventory
    }
  }

  // Finally, update the UI
  updateStatusPanel();
}

/** Populates the map with deterministically spawned tokens. */
function populateMap() {
  const bounds = map.getBounds();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  // Calculate cell index range based on map bounds
  const iMin = Math.floor((south - CLASSROOM_LATLNG.lat) / TILE_DEGREES);
  const iMax = Math.ceil((north - CLASSROOM_LATLNG.lat) / TILE_DEGREES);
  const jMin = Math.floor((west - CLASSROOM_LATLNG.lng) / TILE_DEGREES);
  const jMax = Math.ceil((east - CLASSROOM_LATLNG.lng) / TILE_DEGREES);

  // Iterate over all visible cells
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i},${j}`;

      // Skip if this cell has already been processed (e.g., player placed a token)
      if (gridCells.has(key)) {
        continue;
      }

      // Use luck to determine if a token spawns here
      const spawnLuck = luck(key);
      if (spawnLuck < SPAWN_PROBABILITY) {
        // Token spawns!
        const value = 1; // All spawned tokens have value 1
        gridCells.set(key, value);
        renderCell(key, i, j, value);
      }
    }
  }
}

// ===
// INITIALIZATION
// ===
// The map's "moveend" event fires once on load because the map is fixed.
// This is the perfect time to draw the initial grid.
map.on("moveend", populateMap);
updateStatusPanel(); // Show initial "Empty" inventory
