const KEY = "products";
const DEFAULT_PRODUCTS = [
  {id:"ambrane-360",name:"Ambrane Twistand-360 Mobile Stand",store:"Amazon",cat:"Gadgets",icon:"📱",price:"",old:"",offer:"360° rotating mobile stand",image:"",link:"https://link.amazon/B0gGWznsX",featured:true},
  {id:"earbuds",name:"Wireless Earbuds",store:"Amazon",cat:"Gadgets",icon:"🎧",price:"",old:"",offer:"Popular audio pick",image:"",link:"https://www.amazon.in/",featured:true},
  {id:"watch",name:"Smart Watch",store:"Flipkart",cat:"Gadgets",icon:"⌚",price:"",old:"",offer:"Everyday smart pick",image:"",link:"https://www.flipkart.com/",featured:true},
  {id:"sneakers",name:"Casual Sneakers",store:"Myntra",cat:"Fashion",icon:"👟",price:"",old:"",offer:"Trending style",image:"",link:"https://www.myntra.com/",featured:false},
  {id:"backpack",name:"Everyday Backpack",store:"Amazon",cat:"Fashion",icon:"🎒",price:"",old:"",offer:"Daily-use pick",image:"",link:"https://www.amazon.in/",featured:false},
  {id:"beauty",name:"Beauty Care Pick",store:"AJIO",cat:"Beauty",icon:"✨",price:"",old:"",offer:"Beauty favourite",image:"",link:"https://www.ajio.com/",featured:false},
  {id:"bands",name:"Resistance Bands",store:"Amazon",cat:"Fitness",icon:"💪",price:"",old:"",offer:"Home workout pick",image:"",link:"https://www.amazon.in/",featured:false},
  {id:"bottle",name:"Fitness Bottle",store:"Flipkart",cat:"Fitness",icon:"🥤",price:"",old:"",offer:"Everyday fitness",image:"",link:"https://www.flipkart.com/",featured:false},
  {id:"lamp",name:"LED Desk Lamp",store:"Amazon",cat:"Home",icon:"💡",price:"",old:"",offer:"Desk setup pick",image:"",link:"https://www.amazon.in/",featured:false}
];

async function getProducts(env){
  let raw = await env.DEALKART_KV.get(KEY);
  if(!raw){ await env.DEALKART_KV.put(KEY, JSON.stringify(DEFAULT_PRODUCTS)); return DEFAULT_PRODUCTS; }
  try{return JSON.parse(raw)}catch{return DEFAULT_PRODUCTS}
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}})}
async function auth(request,env){
  const c=request.headers.get("Cookie")||"";
  const m=c.match(/dk_admin=([^;]+)/);
  if(!m||!env.ADMIN_PASSWORD)return false;
  const enc=new TextEncoder();
  const hash=await crypto.subtle.digest("SHA-256",enc.encode(env.ADMIN_PASSWORD));
  const hex=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
  return m[1]===hex;
}
async function hashPassword(p){
 const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(p));
 return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function clean(p){
 return {id:String(p.id||crypto.randomUUID()),name:String(p.name||"").trim(),store:String(p.store||"Amazon"),cat:String(p.cat||"Gadgets"),icon:String(p.icon||"🛍️"),price:String(p.price||""),old:String(p.old||""),offer:String(p.offer||""),image:String(p.image||""),link:String(p.link||""),featured:!!p.featured};
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  try{
   if(url.pathname==="/api/products" && request.method==="GET") return json({products:await getProducts(env)});
   if(url.pathname==="/api/login" && request.method==="POST"){
     const {password}=await request.json();
     if(!env.ADMIN_PASSWORD || password!==env.ADMIN_PASSWORD)return json({ok:false,error:"Invalid password"},401);
     const token=await hashPassword(env.ADMIN_PASSWORD);
     return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":`dk_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`}});
   }
   if(url.pathname==="/api/logout" && request.method==="POST") return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":"dk_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}});
   if(url.pathname==="/api/products" && ["POST","PUT","DELETE"].includes(request.method)){
     if(!(await auth(request,env)))return json({error:"Unauthorized"},401);
     let products=await getProducts(env);
     if(request.method==="POST"){products.unshift(clean(await request.json()))}
     if(request.method==="PUT"){
       const body=await request.json(); const i=products.findIndex(x=>x.id===body.id);
       if(i<0)return json({error:"Not found"},404); products[i]=clean(body);
     }
     if(request.method==="DELETE"){
       const body=await request.json(); products=products.filter(x=>x.id!==body.id);
     }
     await env.DEALKART_KV.put(KEY,JSON.stringify(products));
     return json({ok:true,products});
   }
   if(url.pathname==="/api/track" && request.method==="POST"){
     const {id}=await request.json(); const k=`click:${id}`;
     const old=Number(await env.DEALKART_KV.get(k)||0);
     await env.DEALKART_KV.put(k,String(old+1));
     return json({ok:true});
   }
   if(url.pathname==="/api/stats" && request.method==="GET"){
     if(!(await auth(request,env)))return json({error:"Unauthorized"},401);
     const products=await getProducts(env); let clicks=0;
     for(const p of products) clicks+=Number(await env.DEALKART_KV.get(`click:${p.id}`)||0);
     return json({products:products.length,clicks});
   }
   return env.ASSETS.fetch(request);
  }catch(e){return json({error:"Server error"},500)}
 }
};
