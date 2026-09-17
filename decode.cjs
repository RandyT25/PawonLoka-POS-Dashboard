const olc = require('open-location-code');
console.log(Object.keys(olc.OpenLocationCode));
const code = olc.OpenLocationCode.recoverNearest("G25M+7M", -6.507, 107.014); // approximate lat,lng
console.log("Full code:", code);
const decoded = olc.OpenLocationCode.decode(code);
console.log(decoded.latitudeCenter, decoded.longitudeCenter);
