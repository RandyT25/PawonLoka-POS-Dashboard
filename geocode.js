async function run() {
  const res = await fetch('https://nominatim.openstreetmap.org/search?q=Cibodas,+Bogor+Regency,+West+Java&format=json', {
    headers: { 'User-Agent': 'NodeJS/18.0 (PawonLoka)' }
  });
  const data = await res.json();
  console.log(data);
}
run();
