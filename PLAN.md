# D3: Token Crafter

# Game Design Vision

A map game. You walk around (not really, the map is fixed) and see tokens. You can pick one up. If you find another token of the same value, you can put yours on it to craft a new token with double the value. The goal is to make a token worth 16.

# Technologies

- TypeScript (no HTML, just the `style.css`)
- Deno and Vite
- Leaflet for the map
- GitHub Actions + Pages for deploys

# Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Getting Leaflet to work with a grid of clickable cells and managing the state of all the tokens and the player's inventory.

### steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] lock the map (no zoom, no pan)
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] use luck() function to decide where tokens (value 1) spawn
- [x] show the token's value on the cell without clicking (use permanent tooltip)
- [x] create a variable for player inventory (can hold one token value or null)
- [x] create a Map to store the grid state (e.g., "i,j" -> token_value)
- [x] create a second Map to store cell visual layers (so they can be removed/updated)
- [x] add click handlers to the cell rectangles
- [x] implement click logic: check distance (no interaction if > 3 cells away)
- [x] implement click logic: if inventory empty and cell has token, pick it up
- [x] implement click logic: if inventory full and cell is empty, place token
- [x] implement click logic: if inventory full and cell has token (crafting)
- [x] craft logic: if values match, double cell value, update visual, empty inventory
- [x] craft logic: if values don'T match, show an alert
- [x] update the status panel to show current inventory
- [x] check for win condition (e.g., crafted token >= 16) and show alert
- [x] do a cleanup-only commit (remove console.logs, etc.)
- [x] push and check GitHub Pages deployment
- [ ] make final commit "(D3.a complete)"
