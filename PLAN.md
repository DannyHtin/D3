# D3: Token Crafter

# Game Design Vision
A map game. You walk around (not really, the map is fixed) and see tokens. You can pick one up. If you find another token of the *same* value, you can put yours on it to craft a new token with double the value. The goal is to make a token worth 16.

# Technologies
- TypeScript (no HTML, just the `style.css`)
- Deno and Vite
- Leaflet for the map
- GitHub Actions + Pages for deploys

# Assignments

## D3.a: Core mechanics (token collection and crafting)
Key technical challenge: Getting Leaflet to work with a grid of clickable cells and managing the state of all the tokens and the player's inventory.

### steps
- [x] **Project Setup:** Gut the `main.ts` starter code. Keep the Leaflet imports and DOM setup, but delete the old game logic.
- [x] **Get Map on Screen:** Initialize Leaflet. Lock the map view (no zoom, no pan) centered on the classroom.
- [x] **Draw *something*:** Figure out how to draw the grid. `leaflet.rectangle` seems right. Need to calculate the `i, j` cell coordinates from the map bounds.
- [x] **Deterministic Spawns:** Use the `luck()` function to make tokens (value 1) appear. This needs to be consistent, so `luck("i,j")` should work.
- [x] **Make Cells "Visible":** Show the value of a token *without* clicking. The rubric says `bindTooltip` with `permanent: true` could work.
- [x] **State Management:** Need a way to track what the player is holding.
    - `let playerInventory: number | null = null;`
- [x] **State Management (Grid):** Need to track what's in each cell. A `Map<string, number>` where the key is `"i,j"` seems best. This is sparse, which is good.
- [x] **Click Logic (The hard part):**
    - [x] Add `onClick` to all the cell rectangles.
    - [x] **Interaction Radius:** First, check if the cell is nearby (e.g., `i` or `j` > 3). If not, `alert()` and do nothing.
    - [x] **Case 1: Inventory Empty:**
        - [x] If cell has token: Pick it up (cell -> inventory), delete cell from map/state.
        - [x] If cell empty: Do nothing.
    - [x] **Case 2: Inventory Full:**
        - [x] If cell empty: Place token (inventory -> cell), draw new cell visual.
        - [x] If cell has token (e.g., `cellValue`):
            - [x] **Craft:** If `playerInventory === cellValue`, double the value (`newValue = cellValue * 2`), update the cell's value in the `Map`, and update its tooltip. Empty inventory.
            - [x] **Fail:** If `playerInventory !== cellValue`, `alert("values don't match")`.
- [x] **Update UI:** Make the `statusPanel` show what's in the inventory after every click.
- [x] **Win Condition:** After crafting, check if `newValue >= 16`. If so, show an alert.
- [x] **Visuals Map:** The rects need to be updated. I need another map, `Map<string, leaflet.Layer>`, to store the visual part (the rectangle) so I can delete it (`.remove()`) and redraw it easily.
- [x] **Cleanup:** Make a "cleanup-only" commit. Remove `console.log`s, check variable names.
- [x] **Deploy:** Check if GitHub Pages deployment works.
- [x] **Done:** Mark as complete.
- [x] (D3.a complete)