// Reliable individual catalogue photos.
const productPhotos={
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
  'ChefPro Kitchen Mixer':'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=85',
  'ZenBook Air Laptop':'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85',
  'Click Wireless Mouse':'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=85',
  'Urban Sneakers':'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85',
  'Flex Yoga Mat':'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=85',
  'Adjustable Dumbbells':'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85',
  'Match Football':'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?auto=format&fit=crop&w=900&q=85',
  'Court Basketball':'https://images.unsplash.com/photo-1518065896235-a4c93e088e7a?auto=format&fit=crop&w=900&q=85',
  'Polarized Sunglasses':'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=85',
  'Classic Analog Watch':'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=85',
  'Cotton Baseball Cap':'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=900&q=85',
  'Leather Wallet':'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=85'
};
const categoryPhotos={Electronics:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85',Fashion:'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85','Home & Kitchen':'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85',Grocery:'https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=900&q=85',Beauty:'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=85',Sports:'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=85',Accessories:'https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?auto=format&fit=crop&w=900&q=85'};
products.forEach(product=>{product.image=productPhotos[product.name]||categoryPhotos[product.category]||categoryPhotos.Electronics});
loadRoute();
document.querySelectorAll('.product-img img').forEach(image=>{image.onerror=()=>{const product=products.find(item=>item.name===image.alt);image.onerror=null;image.src=categoryPhotos[product?.category]||categoryPhotos.Electronics}});
