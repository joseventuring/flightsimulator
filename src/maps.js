/* ---------- real-location maps and their airspace ----------
   Terrain: public elevation data (SRTM / NASADEM / Copernicus via AWS Terrain Tiles), baked by tools/build_map.py.
   Heights are metres relative to the strip; x east, z south. The strip and field sit on the flattest open ground near
   each site and are levelled across about 250 m, then blend into the real terrain.
   Airspace follows the Drone Rules 2021 airspace map (Ministry of Civil Aviation, September 2021):
     green  up to 400 ft (120 m) where not red or yellow; up to 200 ft (60 m) between 8 and 12 km of an operational airport perimeter
     yellow above those heights, and from the ground up between 5 and 8 km of an operational airport perimeter
     red    no-drone zones (airport surroundings and notified vital installations), Central Government permission only
   Airport perimeters here are estimated from runway coordinates (OurAirports) plus a land buffer, so distances are
   approximate. Police orders add temporary or standing bans (Cyberabad: 5 km around RGIA, Hakimpet, Kanha Shanti Vanam). */
const MAPS_META={
  kurianad:{name:'Kurianad, Kottayam',short:'Kurianad',region:'Kerala',theme:'kerala',wdir:240,
    note:'Midland Kerala: rubber hills and valley paddy. The strip sits on the flattest valley floor near Kurianad.'},
  moinabad:{name:'Moinabad, Hyderabad',short:'Moinabad',region:'Telangana',theme:'deccan',wdir:290,
    note:'Deccan plateau west of the city near Chilkur, Osman Sagar (Gandipet) to the north and Himayat Sagar to the south-east.'},
};
/* operational aerodromes near the two regions: runway end coordinates (OurAirports) and an estimated land buffer around the runways */
const AIRPORTS=[
  {id:'VOHS',name:'Rajiv Gandhi International (Shamshabad)',rwy:[[17.2306,78.4123,17.2311,78.4533],[17.2286,78.4128,17.2291,78.4529]],buf:2.0},
  {id:'VOHY',name:'Begumpet',rwy:[[17.4530,78.4539,17.4536,78.4843]],buf:0.8},
  {id:'VOHK',name:'Hakimpet Air Force Station',rwy:[[17.5525,78.5127,17.5541,78.5324]],buf:0.8},
  {id:'VODG',name:'Dundigal Air Force Academy',rwy:[[17.6314,78.3902,17.6277,78.4135],[17.6264,78.3953,17.6233,78.4145]],buf:0.8},
  {id:'IN-0013',name:'Nadirgul (flying school)',rwy:[[17.3061,78.5560,17.3061,78.5660]],buf:0.4},
  {id:'VOCI',name:'Cochin International',rwy:[[10.1514,76.3864,10.1526,76.4174]],buf:1.0},
  {id:'VOCC',name:'INS Garuda (Kochi naval air station)',rwy:[[9.9489,76.2712,9.9408,76.2813],[9.9554,76.2712,9.9394,76.2749]],buf:0.6},
];
/* standing or recurring police and central bans near the maps (5 km radius unless stated) */
const NOFLY=[
  {name:'RGIA (Cyberabad Police order)',lat:17.2403,lon:78.4294,r:5},
  {name:'Kanha Shanti Vanam, Chegur (Cyberabad Police order)',lat:17.1750,lon:78.2160,r:5},
  {name:'Hakimpet Air Force Station (Cyberabad Police order)',lat:17.5533,lon:78.5226,r:5},
];
function kmBetween(a,b,c,d){const R=6371,p=Math.PI/180;return 2*R*Math.asin(Math.sqrt(Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2));}
/* distance from a point to a runway segment, in km (flat-earth over a few km is fine) */
function kmToSegment(lat,lon,s){const k=111.32,kx=111.32*Math.cos(lat*Math.PI/180);const ax=(s[1]-lon)*kx,az=(s[0]-lat)*k,bx=(s[3]-lon)*kx,bz=(s[2]-lat)*k;
  const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,-(ax*dx+az*dz)/(dx*dx+dz*dz||1)));return Math.hypot(ax+dx*t,az+dz*t);}
/* zone verdict for a point: the Drone Rules 2021 bands against every airport's estimated perimeter, then police no-fly circles */
function airspaceAt(lat,lon){const near=AIRPORTS.map(A=>{const d=Math.min(...A.rwy.map(s=>kmToSegment(lat,lon,s)))-A.buf;return {id:A.id,name:A.name,km:Math.max(0,d)};}).filter(a=>a.km<150).sort((a,b)=>a.km-b.km);
  const bans=NOFLY.map(N=>({name:N.name,km:kmBetween(lat,lon,N.lat,N.lon),r:N.r})).filter(N=>N.km<N.r+3);
  const a=near[0];let zone='green',ceil=120,why='More than 12 km from every operational airport perimeter.';
  if(a.km<5){zone='red';ceil=0;why='Inside 5 km of '+a.name+'.';}
  else if(a.km<8){zone='yellow';ceil=0;why='Between 5 and 8 km of '+a.name+': air traffic control permission needed from the ground up.';}
  else if(a.km<12){zone='green';ceil=60;why='Between 8 and 12 km of '+a.name+': green only up to 200 ft (60 m).';}
  /* the perimeter is an estimate, so within about 1 km of the 12 km line the safer 200 ft band applies */
  else if(a.km<13){zone='green';ceil=60;why='About '+a.km.toFixed(1)+' km from the estimated perimeter of '+a.name+', within 1 km of the 12 km line, so the 200 ft (60 m) band is used to be safe. Confirm on Digital Sky.';}
  const inBan=bans.find(N=>N.km<N.r);if(inBan){zone='red';ceil=0;why='Inside the '+N_r(inBan)+' ban: '+inBan.name+'.';}
  return {zone,ceil,why,near:near.slice(0,4),bans};}
function N_r(N){return N.r+' km';}
/* the selected map, decoded */
const MAP_ID=MAP_DATA[settings.map]?settings.map:'kurianad';
const MAP=(()=>{const D=MAP_DATA[MAP_ID];const n=D.n;const bin=atob(D.h);const H=new Float32Array(n*n);
  for(let i=0;i<n*n;i++){let v=bin.charCodeAt(i*2)|(bin.charCodeAt(i*2+1)<<8);if(v>32767)v-=65536;H[i]=v/10;}
  const wb=atob(D.w);const W=new Uint8Array(n*n);for(let i=0;i<n*n;i++)W[i]=(wb.charCodeAt(i>>3)>>(7-(i&7)))&1;
  /* each water cell takes the level of the lake it belongs to (nearest listed level) */
  const lev=D.water||[];const L=new Float32Array(n*n);for(let i=0;i<n*n;i++)if(W[i]){let b=lev[0],bd=1e9;lev.forEach(l=>{const d=Math.abs(H[i]-l);if(d<bd){bd=d;b=l;}});L[i]=b;}
  return Object.assign({},D,MAPS_META[MAP_ID],{H,W,L,air:airspaceAt(D.lat,D.lon)});})();
function demH(x,z){const n=MAP.n,s=MAP.size;let fi=(x+s/2)/s*(n-1),fj=(z+s/2)/s*(n-1);fi=Math.max(0,Math.min(n-1.001,fi));fj=Math.max(0,Math.min(n-1.001,fj));
  const i=fi|0,j=fj|0,u=fi-i,v=fj-j,H=MAP.H;return H[j*n+i]*(1-u)*(1-v)+H[j*n+i+1]*u*(1-v)+H[(j+1)*n+i]*(1-u)*v+H[(j+1)*n+i+1]*u*v;}
function waterCell(x,z){const n=MAP.n,s=MAP.size;const i=Math.round((x+s/2)/s*(n-1)),j=Math.round((z+s/2)/s*(n-1));if(i<0||j<0||i>=n||j>=n)return -1;return MAP.W[j*n+i]?j*n+i:-1;}
