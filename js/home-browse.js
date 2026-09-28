/* home-browse.js -> paste as /js/home-browse.js  (homepage: hero, categories, rails) */
(function () {
  'use strict';
  var root = document.getElementById('home-browse');
  if (!root) return;
  var ORDER = ['Electronics','Fashion','Home & Kitchen','Beauty & Personal Care','Accessories','Sports & Outdoors','Toys & Games','Office & Stationery','Automotive','Essentials'];
  var all = [];

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function money(n){try{if(typeof formatCurrency==='function')return formatCurrency(n);}catch(e){}return '\u20A6'+Number(n||0).toLocaleString();}
  function shopUrl(cat,sub){var p=new URLSearchParams();if(cat)p.set('category',cat);if(sub)p.set('subcategory',sub);var q=p.toString();return '/pages/shop.html'+(q?'?'+q:'');}

  function group(rows){
    var g={};
    rows.forEach(function(r){var k=String(r.supplier_product_id||r.id);(g[k]=g[k]||[]).push(r);});
    return Object.keys(g).map(function(k){
      var l=g[k],ins=l.filter(function(r){return Number(r.stock_quantity||0)>0;}),pool=ins.length?ins:l;
      var rep=pool.slice().sort(function(a,b){return a.price-b.price;})[0];
      var pr=l.map(function(r){return Number(r.price||0);}).filter(Boolean);
      return {key:k,id:rep.id,name:rep.title||rep.name||'Product',category:(rep.category||'Essentials').trim(),
        subcategory:(rep.subcategory||'').trim(),price:pr.length?Math.min.apply(null,pr):0,maxPrice:pr.length?Math.max.apply(null,pr):0,
        image:rep.image_url||(rep.images&&rep.images[0])||'',inStock:ins.length>0,variants:l.length,supplier:rep.supplier,
        spid:rep.supplier_product_id||'',svid:rep.supplier_variant_id||'',sku:rep.supplier_sku||'',
        created:l.reduce(function(m,r){return r.created_at>m?r.created_at:m;},'')};
    });
  }
  function card(p){
    var href='/pages/product.html?id='+encodeURIComponent(p.id);
    var add=p.variants>1?'<a class="sb-add" href="'+href+'" aria-label="Choose options">+</a>':'<button type="button" class="sb-add" data-add="'+esc(p.key)+'" aria-label="Add to cart">+</button>';
    return '<article class="sb-card"><a class="sb-card-img" href="'+href+'">'+(p.image?'<img src="'+esc(p.image)+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">':'')+'</a>'+
      '<div class="sb-card-body"><a class="sb-card-title" href="'+href+'">'+esc(p.name)+'</a><div class="sb-price-row"><span class="sb-price">'+(p.maxPrice>p.price?'<small>from</small> ':'')+money(p.price)+'</span>'+add+'</div></div></article>';
  }
  function head(title,sub,link){return '<div class="hm-head"><div><h2>'+esc(title)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div><a href="'+link+'">See all \u2192</a></div>';}

  function render(){
    var live=all.filter(function(p){return p.inStock;});
    if(!live.length){root.innerHTML='<div class="sb-empty"><p>Products are on the way.</p><a class="sb-btn" href="/pages/shop.html">Open the shop</a></div>';return;}
    var fresh=live.slice().sort(function(a,b){return a.created<b.created?1:-1;});
    var cats={};
    live.forEach(function(p){var c=cats[p.category]=cats[p.category]||{n:p.category,list:[],subs:{}};c.list.push(p);if(p.subcategory)c.subs[p.subcategory]=(c.subs[p.subcategory]||0)+1;});
    var names=Object.keys(cats).sort(function(a,b){var x=ORDER.indexOf(a),y=ORDER.indexOf(b);return(x<0?99:x)-(y<0?99:y);});
    var byCount=names.slice().sort(function(a,b){return cats[b].list.length-cats[a].list.length;});
    var pics=fresh.slice(0,3);

    var html='<section class="hm-hero"><div class="hm-hero-copy"><span class="hm-tag">New drops daily</span>'+
      '<h1>Everything you need,<br>one cart away.</h1><p>Fresh finds in electronics, fashion, home and more \u2014 secure checkout and order tracking.</p>'+
      '<div class="hm-cta"><a class="sb-btn hm-btn" href="/pages/shop.html">Shop now</a><a class="hm-link" href="#hm-new">See new arrivals \u2193</a></div></div>'+
      '<div class="hm-hero-art">'+pics.map(function(p,i){return '<a class="hm-art hm-art'+i+'" href="/pages/product.html?id='+encodeURIComponent(p.id)+'"><img src="'+esc(p.image)+'" alt="'+esc(p.name)+'"></a>';}).join('')+'</div></section>';

    html+='<div class="sb-tiles-wrap"><div class="sb-tiles">'+names.map(function(n){
      var c=cats[n];return '<a class="sb-tile" href="'+shopUrl(n)+'"><span class="sb-tile-img">'+(c.list[0].image?'<img src="'+esc(c.list[0].image)+'" alt="" loading="lazy">':'')+'</span><span class="sb-tile-label">'+esc(n)+'</span><span class="sb-tile-count">'+c.list.length+'</span></a>';}).join('')+'</div></div>';

    html+='<section id="hm-new" class="hm-sec">'+head('New arrivals','Just added to the store','/pages/shop.html?sort=newest')+'<div class="hm-rail">'+fresh.slice(0,12).map(card).join('')+'</div></section>';

    byCount.slice(0,4).forEach(function(n){
      var c=cats[n];
      var subs=Object.keys(c.subs).sort(function(a,b){return c.subs[b]-c.subs[a];}).slice(0,6);
      var items=c.list.slice().sort(function(a,b){return a.created<b.created?1:-1;}).slice(0,5);
      html+='<section class="hm-sec hm-block">'+head(n,'',shopUrl(n))+
        (subs.length?'<div class="hm-chips">'+subs.map(function(s){return '<a href="'+shopUrl(n,s)+'">'+esc(s)+'</a>';}).join('')+'</div>':'')+
        '<div class="sb-grid">'+items.map(card).join('')+'</div></section>';
    });
    root.innerHTML=html;
  }

  root.addEventListener('click',function(e){
    var t=e.target.closest('[data-add]');if(!t)return;e.preventDefault();
    var p=all.filter(function(x){return x.key===t.getAttribute('data-add');})[0];
    if(p&&typeof addToCart==='function')addToCart(p.id,1,{id:p.id,name:p.name,price:p.price,image:p.image,supplier:p.supplier,supplierProductId:p.spid,supplierVariantId:p.svid,supplierSku:p.sku});
  });

  (async function boot(){
    root.innerHTML='<div class="sb-grid">'+new Array(11).join('<div class="sb-card sb-skel"><div class="sb-card-img"></div><div class="sb-card-body"><i></i><i></i></div></div>')+'</div>';
    try{
      if(window._appReady){try{await window._appReady;}catch(e){}}
      var rows=[],page=0,res;
      do{res=await supabaseService.getProducts({limit:1000,offset:page*1000,sortBy:'newest'});
        if(!res||!res.success)throw new Error('load failed');rows=rows.concat(res.products||[]);page++;}
      while((res.products||[]).length===1000&&page<10);
      all=group(rows);render();
    }catch(err){console.error('home-browse:',err);root.innerHTML='<div class="sb-empty"><p>We couldn\u2019t load products right now.</p><a class="sb-btn" href="/pages/shop.html">Open the shop</a></div>';}
  })();
})();