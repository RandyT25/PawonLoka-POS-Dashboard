const OpenLocationCode = require('open-location-code').OpenLocationCode;
// We might need to pass the reference location if it's a short code, 
// but "G25M+7M" is short. Usually it requires a city.
// Actually, I can just use Nominatim or the Google Maps link.
