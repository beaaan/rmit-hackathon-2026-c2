// Offline rehearsal without TideCloak: writes dev/tidecloak.dev.json and dev/tokens.json
// with 12-hour tokens for the cast. Start the controller against it with
//   TIDECLOAK_CONFIG=dev/tidecloak.dev.json npm start
// Never use this for the real demo; use the tidecloak.json exported from your realm.
import { mkdirSync, writeFileSync } from "node:fs";
import { createLocalRealm } from "./local-realm.js";

const { config, mint } = await createLocalRealm();
const cast = [
  { sub: "00000000-0000-4000-8000-00000000000a", username: "jo", roles: ["plant-viewer"] },
  { sub: "00000000-0000-4000-8000-00000000000b", username: "kim", roles: ["plant-viewer", "plant-operator"] },
  { sub: "00000000-0000-4000-8000-00000000000c", username: "raj", roles: ["plant-viewer", "plant-operator"] },
];

const tokens = {};
for (const person of cast) tokens[person.username] = await mint({ ...person, expiresIn: "12h" });

mkdirSync("dev", { recursive: true });
writeFileSync("dev/tidecloak.dev.json", JSON.stringify(config, null, 2) + "\n");
writeFileSync("dev/tokens.json", JSON.stringify(tokens, null, 2) + "\n");
console.log("Wrote dev/tidecloak.dev.json and dev/tokens.json (jo, kim, raj).");
