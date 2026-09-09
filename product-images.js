// Product-specific photographic queries. Every catalogue item gets its own image theme.
const productImageTags={
'Nova X5 Smartphone':'smartphone,phone','Aero Wireless Headphones':'wireless,headphones','Orbit Smart Watch':'smartwatch,watch','Pro Mechanical Keyboard':'mechanical,keyboard','Trail Running Shoes':'running,shoes','Everyday City Backpack':'backpack,bag','BrewCraft Coffee Maker':'coffee,maker','Glow Smart LED Bulb':'led,lightbulb','Classic Cotton T-Shirt':'cotton,tshirt','Nourish Skincare Set':'skincare,beauty','Pulse Bluetooth Speaker':'bluetooth,speaker','ChefPro Kitchen Mixer':'kitchen,mixer',
'ZenBook Air Laptop':'laptop,computer','Click Wireless Mouse':'wireless,mouse','ChargeMax Power Bank':'powerbank,charger','Link USB-C Hub':'usb,hub','ClearView Webcam':'webcam,camera','Beam Mini Projector':'mini,projector',
'Denim Slim Jeans':'denim,jeans','Cozy Fleece Hoodie':'fleece,hoodie','Linen Casual Shirt':'linen,shirt','Urban Sneakers':'sneakers,shoes','Classic Bomber Jacket':'bomber,jacket','Indigo Printed Kurti':'kurti,fashion','Evening Midi Dress':'midi,dress','Active Track Pants':'track,pants','Canvas Everyday Tote':'canvas,tote',
'Electric Kettle Pro':'electric,kettle','Ceramic Frying Pan':'ceramic,pan','FreshLock Storage Set':'food,containers','Crisp Air Fryer':'air,fryer','Porcelain Dinner Set':'porcelain,dinnerware','Steel Water Bottle':'steel,water-bottle','Breakfast Toaster':'kitchen,toaster','Modular Kitchen Organizer':'kitchen,organizer',
'Premium Basmati Rice 5kg':'basmati,rice','Whole Wheat Flour 5kg':'wheat,flour','Cold Pressed Cooking Oil':'cooking,oil','Pure Cane Sugar 1kg':'cane,sugar','Iodised Salt 1kg':'salt,food','Masala Chai 500g':'masala,tea','Instant Coffee 200g':'instant,coffee','Butter Biscuits Pack':'butter,biscuits','Durum Wheat Pasta':'pasta,food','Honey Almond Cereal':'almond,cereal',
'Gentle Face Wash':'face,wash','Daily Moisturizer':'moisturizer,skincare','SPF 50 Sunscreen':'sunscreen,skincare','Repair Shampoo':'shampoo,haircare','Smooth Conditioner':'conditioner,haircare','Shea Body Lotion':'body,lotion','Mint Lip Balm':'lip,balm','Vitamin C Serum':'vitamin,serum','Clay Face Mask':'clay,face-mask','Eau de Parfum':'perfume,bottle',
'Flex Yoga Mat':'yoga,mat','Adjustable Dumbbells':'dumbbells,fitness','English Willow Cricket Bat':'cricket,bat','Match Football':'football,soccer','Court Basketball':'basketball,sport','Speed Skipping Rope':'skipping,rope','Resistance Bands Set':'resistance,bands','Insulated Sports Bottle':'sports,bottle','Grip Gym Gloves':'gym,gloves',
'Leather Wallet':'leather,wallet','Polarized Sunglasses':'sunglasses,eyewear','Classic Analog Watch':'analog,watch','Formal Leather Belt':'leather,belt','Cotton Baseball Cap':'baseball,cap','Protective Phone Case':'phone,case','Metal Keychain':'metal,keychain','Travel Toiletry Pouch':'travel,pouch','Padded Laptop Sleeve':'laptop,sleeve','Minimal Card Holder':'card,holder'
};
products.forEach(product=>{const tags=productImageTags[product.name]||product.category.replace(/\s+/g,',');product.image=`https://loremflickr.com/900/700/${tags}?lock=${product.id}`});
loadRoute();

const reliableCategoryImages={Electronics:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85',Fashion:'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85','Home & Kitchen':'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85',Grocery:'https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=900&q=85',Beauty:'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=85',Sports:'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=85',Accessories:'https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?auto=format&fit=crop&w=900&q=85'};
document.querySelectorAll('.product-img img').forEach(image=>{const product=products.find(item=>item.name===image.alt);const fallback=reliableCategoryImages[product?.category]||reliableCategoryImages.Electronics;const useFallback=()=>{image.onerror=null;image.src=fallback;image.style.display='block'};image.onerror=useFallback;if(image.complete&&!image.naturalWidth)useFallback()});

products.forEach(product=>product.image=reliableCategoryImages[product.category]||reliableCategoryImages.Electronics);
loadRoute();


// Replace repeated category photos with matching product photos as each card enters view.
const productPhotoCards=[...document.querySelectorAll('.product-img img')];
productPhotoCards.forEach((image,index)=>{
  const product=products.find(item=>item.name===image.alt);
  const tags=productImageTags[product?.name]||product?.category?.replace(/\s+/g,',')||'product';
  const fallback=reliableCategoryImages[product?.category]||reliableCategoryImages.Electronics;
  const loadSpecificPhoto=()=>{
    image.onerror=()=>{image.onerror=null;image.src=fallback};
    image.src=`https://loremflickr.com/900/700/${tags}?lock=${product?.id||index+1}`;
  };
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){setTimeout(loadSpecificPhoto,index*250);observer.disconnect()}
  }),{rootMargin:'180px'});
  observer.observe(image);
});


// Stable, individual images for the featured catalogue items.
const verifiedProductPhotos={
  'Nova X5 Smartphone':'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85',
  'Aero Wireless Headphones':'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85',
  'Orbit Smart Watch':'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85',
  'Pro Mechanical Keyboard':'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85',
  'Trail Running Shoes':'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85',
  'Everyday City Backpack':'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85',
  'BrewCraft Coffee Maker':'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85',
  'Glow Smart LED Bulb':'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?auto=format&fit=crop&w=900&q=85',
  'Classic Cotton T-Shirt':'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85',
  'Nourish Skincare Set':'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=85',
  'Pulse Bluetooth Speaker':'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85',
  'ChefPro Kitchen Mixer':'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=85'
};
setTimeout(()=>document.querySelectorAll('.product-img img').forEach(image=>{
  const directPhoto=verifiedProductPhotos[image.alt];
  if(directPhoto){image.onerror=()=>{image.onerror=null;image.src=reliableCategoryImages[products.find(item=>item.name===image.alt)?.category]||reliableCategoryImages.Electronics};image.src=directPhoto}
}),3500);
