#!/usr/bin/env node
(async () => {
// Read-only BillCart product-image audit. Writes CSV and HTML reports beside this script.
// No app files are modified by running this audit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const appText = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const imageText = fs.readFileSync(path.join(root, 'product-images.js'), 'utf8');
const appEnd = appText.indexOf('let state;');
const mapEnd = imageText.indexOf('function productFallback');
if (appEnd < 0 || mapEnd < 0) throw new Error('Could not find catalogue or image-map boundary.');

const context = vm.createContext({});
vm.runInContext(`${appText.slice(0, appEnd)}\nglobalThis.auditProducts = products;`, context, { timeout: 5000 });
vm.runInContext(`${imageText.slice(0, mapEnd)}\nglobalThis.auditPhotos = productPhotos; globalThis.auditPhotoSources = productPhotoSources || {};`, context, { timeout: 5000 });
const products = Array.from(context.auditProducts, p => ({
  id: Number(p.id), name: String(p.name || p.n || ''), category: String(p.category || p.c || ''),
}));
const photos = { ...context.auditPhotos };
const sourceNotes = { ...context.auditPhotoSources };
const browserEvidencePath = path.join(root, 'image-audit-browser.csv');
const browserEvidence = new Map();
if (fs.existsSync(browserEvidencePath)) {
  const records = fs.readFileSync(browserEvidencePath, 'utf8').trim().split(/\r?\n/);
  const parseCsvLine = line => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(m => {
    const value = m[1] || '';
    return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
  });
  const header = parseCsvLine(records.shift());
  const column = name => header.indexOf(name);
  if (column('product_id') < 0 || column('image_url') < 0 || column('browser_load_status') < 0) throw new Error('Browser QA CSV is missing required columns.');
  for (const line of records) {
    const values = parseCsvLine(line);
    const id = Number(values[column('product_id')]);
    const status = values[column('browser_load_status')];
    if (!Number.isInteger(id) || !['LOADED', 'FAILED', 'NOT_APPLICABLE_MISSING_MAPPING'].includes(status)) throw new Error(`Invalid browser QA record for product ${id}.`);
    browserEvidence.set(id, { url: values[column('image_url')], status });
  }
  if (browserEvidence.size !== products.length) throw new Error(`Browser QA CSV expected ${products.length} unique products, found ${browserEvidence.size}.`);
}
const applicationImageHosts = new Set(['images.unsplash.com','images.pexels.com','upload.wikimedia.org']);
function applicationImageSourceAllowed(value) { try { const url = new URL(value); return url.protocol === 'https:' && applicationImageHosts.has(url.hostname); } catch { return false; } }
if (products.length !== 159) throw new Error(`Expected 159 products; found ${products.length}.`);

const csvPath = path.join(root, 'image-audit.csv');
const htmlPath = path.join(root, 'image-audit.html');
const timeoutMs = Number(process.env.IMAGE_AUDIT_TIMEOUT_MS || 15000);
const concurrency = Math.max(1, Math.min(12, Number(process.env.IMAGE_AUDIT_CONCURRENCY || 6)));

function csv(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function neutralPlaceholder(name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700"><rect width="900" height="700" fill="#f4f5f7"/><rect x="1" y="1" width="898" height="698" rx="24" fill="none" stroke="#d9dde4" stroke-width="2"/><g fill="none" stroke="#a5adba" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><rect x="365" y="185" width="170" height="142" rx="12"/><circle cx="415" cy="232" r="14"/><path d="m382 303 48-48 34 31 26-23 28 40"/></g><text x="450" y="398" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#596273">IMAGE UNAVAILABLE</text><text x="450" y="445" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#727b89">${html(name)}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function validImageBytes(bytes, contentType) {
  const b = Buffer.from(bytes);
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  const signature = (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    (b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii'))) ||
    (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') ||
    (b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp' && /^(avif|avis|mif1|msf1)$/.test(b.subarray(8, 12).toString('ascii'))) ||
    ((type === 'image/svg+xml' || /^<\?xml|^\s*<svg/i.test(b.subarray(0, 256).toString('utf8'))) && /<svg\b/i.test(b.subarray(0, 4096).toString('utf8')));
  return { valid: signature && type.startsWith('image/'), signature, contentTypeIsImage: type.startsWith('image/') };
}
async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'BillCart-image-audit/1.0' } });
    const contentType = response.headers.get('content-type') || '';
    const body = await response.arrayBuffer();
    const image = validImageBytes(body, contentType);
    let result = 'HTTP_ERROR';
    if (response.ok && image.valid) result = 'HTTP_OK_VISUAL_UNVERIFIED';
    else if (response.ok) result = 'INVALID_IMAGE_RESPONSE';
    return {
      status: response.status, finalUrl: response.url, redirected: response.redirected,
      contentType, bytes: body.byteLength, signatureValid: image.signature,
      imageContentType: image.contentTypeIsImage, validImage: image.valid, result, error: '',
    };
  } catch (error) {
    return {
      status: 'NETWORK_ERROR', finalUrl: '', redirected: false, contentType: '', bytes: 0,
      signatureValid: false, imageContentType: false, validImage: false,
      result: 'REQUEST_FAILED', error: `${error.name}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}${error.cause?.message ? ` — ${error.cause.message}` : ''}`,
    };
  } finally { clearTimeout(timer); }
}
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) return; results[i] = await fn(items[i], i); }
  }));
  return results;
}

const seen = new Map();
const rows = products.map(product => {
  const mappedUrl = photos[product.name] || '';
  const duplicateOf = mappedUrl && seen.has(mappedUrl) ? seen.get(mappedUrl) : '';
  if (mappedUrl && !seen.has(mappedUrl)) seen.set(mappedUrl, product.name);
  const duplicate = !!duplicateOf;
  const fallback = !mappedUrl || duplicate;
  const source = sourceNotes[product.name] || {};
  return { ...product, mappedUrl, duplicate, duplicateOf, fallback, runtimeUrl: fallback ? '' : mappedUrl, source };
});
const uniqueUrls = [...new Set(rows.map(r => r.mappedUrl).filter(Boolean))];
console.log(`Checking ${uniqueUrls.length} unique remote URLs for ${rows.length} products (concurrency ${concurrency}, timeout ${timeoutMs} ms)…`);
const skipNetwork = process.env.IMAGE_AUDIT_SKIP_NETWORK === '1';
const checked = skipNetwork
  ? uniqueUrls.map(() => ({ status: 'NOT_REQUESTED', finalUrl: '', redirected: false, contentType: '', bytes: 0, signatureValid: false, imageContentType: false, validImage: false, result: 'NOT_CHECKED', error: '' }))
  : await mapLimit(uniqueUrls, concurrency, checkUrl);
const byUrl = new Map(uniqueUrls.map((url, i) => [url, checked[i]]));

for (const row of rows) {
  const check = row.mappedUrl ? byUrl.get(row.mappedUrl) : null;
  if (!row.mappedUrl) row.verification = 'MISSING_MAPPING_FALLBACK';
  else if (row.duplicate) row.verification = `DUPLICATE_MAPPING_FALLBACK (first used by ${row.duplicateOf})`;
  else if (!check) row.verification = 'NOT_CHECKED';
  else row.verification = check.result;
  row.sourceStatus = row.source.status || (row.mappedUrl ? 'SOURCE_NOT_RECORDED' : 'MISSING_MAPPING');
  row.visualMatch = row.source.status === 'USER_SCREENSHOT_VISUALLY_CONFIRMED' ? row.source.status : 'NOT_VISUALLY_VERIFIED';
  row.mappingStatus = row.fallback ? (row.duplicate ? 'DUPLICATE' : 'MISSING') : 'MAPPED';
  const browserRecord = browserEvidence.get(row.id);
  if (browserRecord && browserRecord.url !== row.mappedUrl) throw new Error(`Browser QA image URL is stale for product #${row.id} ${row.name}.`);
  row.browserLoadStatus = browserRecord?.status || (row.mappedUrl ? 'NOT_TESTED_IN_BROWSER' : 'NOT_APPLICABLE_MISSING_MAPPING');
  row.applicationImageStatus = !row.mappedUrl ? 'NEUTRAL_FALLBACK' : applicationImageSourceAllowed(row.mappedUrl) ? 'SOURCE_ALLOWED' : 'UNSUPPORTED_SOURCE_FALLBACK';
  row.check = check;
}

const headers = ['product_id','product_name','category','image_url','mapping_status','application_image_status','http_status','content_type','final_url','redirected','valid_image_response','duplicate_status','runtime_fallback','verification_result','browser_load_status','source_status','source_page','source_description','source_license','visual_match_status','request_error'];
const lines = [headers.map(csv).join(',')];
for (const r of rows) {
  const c = r.check || {};
  lines.push([
    r.id, r.name, r.category, r.mappedUrl, r.mappingStatus, r.applicationImageStatus, c.status ?? 'NOT_REQUESTED', c.contentType || '', c.finalUrl || '',
    c.redirected ?? false, c.validImage ?? false, r.duplicate ? `YES (duplicates ${r.duplicateOf})` : 'NO',
    r.fallback ? 'YES' : 'NO', r.verification, r.browserLoadStatus, r.sourceStatus, r.source.page || '', r.source.description || '', r.source.license || '', r.visualMatch, c.error || '',
  ].map(csv).join(','));
}
fs.writeFileSync(csvPath, `${lines.join('\r\n')}\r\n`, 'utf8');

const counts = {
  products: rows.length,
  uniqueRemoteUrls: uniqueUrls.length,
  httpOkValidImageUrls: checked.filter(c => c.result === 'HTTP_OK_VISUAL_UNVERIFIED').length,
  confirmedHttpErrors: checked.filter(c => c.result === 'HTTP_ERROR').length,
  invalidImageResponses: checked.filter(c => c.result === 'INVALID_IMAGE_RESPONSE').length,
  requestFailures: checked.filter(c => c.result === 'REQUEST_FAILED').length,
  unverifiedRemoteUrls: checked.filter(c => c.result === 'REQUEST_FAILED').length,
  duplicateProductMappings: rows.filter(r => r.duplicate).length,
  missingMappings: rows.filter(r => !r.mappedUrl).length,
  runtimeFallbackProducts: rows.filter(r => r.fallback).length,
  applicationSourceBlockedMappings: rows.filter(r => r.applicationImageStatus === 'UNSUPPORTED_SOURCE_FALLBACK').length,
  sourceDescribedMappings: rows.filter(r => r.sourceStatus === 'SOURCE_DESCRIBED').length,
  sourceNotRecordedMappings: rows.filter(r => r.sourceStatus === 'SOURCE_NOT_RECORDED').length,
  priorScreenshotNotes: rows.filter(r => r.sourceStatus === 'USER_PRIOR_SCREENSHOT_ONLY').length,
  visualMatchesVerified: rows.filter(r => r.visualMatch === 'USER_SCREENSHOT_VISUALLY_CONFIRMED').length,
  browserLoaded: rows.filter(r => r.browserLoadStatus === 'LOADED').length,
  browserFailed: rows.filter(r => r.browserLoadStatus === 'FAILED').length,
  browserNotTested: rows.filter(r => r.browserLoadStatus === 'NOT_TESTED_IN_BROWSER').length,
};
const byCategory = [...new Set(rows.map(r => r.category))].sort().map(category => {
  const items = rows.filter(r => r.category === category);
  return { category, products: items.length, fallbacks: items.filter(r => r.fallback).length,
    broken: items.filter(r => r.check && ['HTTP_ERROR','INVALID_IMAGE_RESPONSE'].includes(r.check.result)).length,
    unverifiedRemote: items.filter(r => r.mappedUrl && r.check?.result === 'REQUEST_FAILED').length,
    needsReplacement: items.filter(r => r.fallback || ['HTTP_ERROR','INVALID_IMAGE_RESPONSE'].includes(r.check?.result)).map(r => r.name) };
});
const cards = rows.map(r => `<article class="card" data-product-id="${r.id}" data-category="${html(r.category)}" data-map-status="${r.mappingStatus}" data-app-image-status="${r.applicationImageStatus}" data-duplicate="${r.duplicate}" data-source-described="${r.sourceStatus === 'SOURCE_DESCRIBED'}" data-visually-verified="${r.visualMatch === 'USER_SCREENSHOT_VISUALLY_CONFIRMED'}" data-browser-status="${r.browserLoadStatus}"><div class="image-wrap"><img loading="eager" src="${html(r.runtimeUrl || neutralPlaceholder(r.name))}" data-fallback-src="${html(neutralPlaceholder(r.name))}" data-product-image="${r.mappedUrl ? 'true' : 'false'}" alt="${html(r.name)}${r.mappedUrl ? '' : ' — neutral placeholder, no image mapping'}"><span class="image-state">${r.mappedUrl ? 'Browser check pending' : 'Neutral fallback · no mapping'}</span></div><div class="info"><strong>#${r.id} ${html(r.name)}</strong><span class="category">${html(r.category)}</span><span class="badge mapping">Mapping: ${html(r.mappingStatus)}</span><span class="badge browser">App image source: ${html(r.applicationImageStatus)}</span><span class="badge source">Source: ${html(r.sourceStatus)}</span><span class="badge visual">Visual match: ${html(r.visualMatch)}</span><span class="badge browser">Browser: ${html(r.browserLoadStatus)}</span>${r.duplicate ? `<small>Duplicate of: ${html(r.duplicateOf)}</small>` : ''}${r.source.page ? `<small><a href="${html(r.source.page)}" target="_blank" rel="noreferrer">Source page</a></small>` : '<small>No source page recorded</small>'}${r.source.description ? `<small>${html(r.source.description)}</small>` : ''}${r.source.license ? `<small>License: ${html(r.source.license)}</small>` : ''}<small>HTTP audit: ${html(r.verification)}${r.check?.status === 'NETWORK_ERROR' ? ' (network failure is unverified, not confirmed broken)' : ''}</small><small>Mapped URL: ${r.mappedUrl ? `<a href="${html(r.mappedUrl)}" target="_blank" rel="noreferrer">open image</a>` : 'none'}</small></div></article>`).join('\n');
const categoryOptions = [...new Set(rows.map(r => r.category))].sort().map(c => `<option>${html(c)}</option>`).join('');
const browserRows = rows.map(r => ({ id: r.id, name: r.name, category: r.category, imageUrl: r.mappedUrl, mappingStatus: r.mappingStatus, applicationImageStatus: r.applicationImageStatus, sourceStatus: r.sourceStatus, visualStatus: r.visualMatch, browserStatus: r.browserLoadStatus }));
const htmlReport = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BillCart product image audit</title><style>
:root{font:14px system-ui,sans-serif;color:#1c2638;background:#f3f5f8}*{box-sizing:border-box}body{margin:0}.top{position:sticky;top:0;background:#fff;border-bottom:1px solid #dfe4ec;padding:14px 3vw;z-index:2}.top h1{font-size:21px;margin:0 0 8px}.counts{display:flex;flex-wrap:wrap;gap:8px}.counts span{background:#eef2f8;border-radius:8px;padding:7px 10px}.filters{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}.filters input,.filters select,.filters button{padding:9px;border:1px solid #ccd4e0;border-radius:7px;background:#fff}.filters button[aria-pressed=true]{background:#243c5a;color:#fff;border-color:#243c5a}.browser-summary{margin:10px 0 0;padding:9px;background:#f3f5f8;border-radius:7px}.grid{padding:16px 3vw 36px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:#fff;border:1px solid #dfe4ec;border-radius:10px;overflow:hidden;min-width:0}.image-wrap{position:relative;background:#f4f5f7}.card img{display:block;width:100%;height:220px;object-fit:contain;object-position:center}.image-state{display:block;padding:4px 8px;font-size:11px;background:#eef2f8;color:#374151}.info{padding:10px;display:grid;gap:6px;overflow-wrap:anywhere}.info .category{color:#5b6575}.badge{font-size:11px;border-radius:99px;padding:4px 8px;width:max-content;max-width:100%;overflow-wrap:anywhere;background:#eef2f8}.badge.mapping{background:#e8eefb}.badge.source{background:#eef2f8}.badge.visual{background:#f4edff}.badge.browser{background:#fff4d9}.card[data-map-status=MISSING]{border-color:#d79b48}.card[data-browser-status=FAILED]{border:2px solid #c54949}.card[data-browser-status=LOADED]{border:2px solid #39a36b}.card[data-browser-status=NOT_TESTED_IN_BROWSER] .image-state{color:#795b16;background:#fff4d9}.card[data-browser-status=FAILED] .image-state{color:#8b1d1d;background:#fde8e8}.card[data-browser-status=LOADED] .image-state{color:#17643b;background:#e4f5eb}small{color:#5b6575}.empty{padding:28px;text-align:center;color:#5b6575;grid-column:1/-1}@media(max-width:1100px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.card img{height:165px}.info{padding:8px}.top{padding:11px}}@media(max-width:420px){.grid{grid-template-columns:1fr}.card img{height:220px}}
</style></head><body><header class="top"><h1>BillCart · Product image audit</h1><div class="counts">${Object.entries(counts).map(([k,v])=>`<span><b>${html(v)}</b> ${html(k)}</span>`).join('')}</div><p>HTTP request failures caused by local network restrictions remain unverified. Browser loading status and visual match status are recorded separately.</p><div class="filters"><input id="q" placeholder="Find product by ID, name or category"><select id="category"><option value="">All categories</option>${categoryOptions}</select><button type="button" data-filter="ALL" aria-pressed="true">All products</button><button type="button" data-filter="MAPPED" aria-pressed="false">Mapped</button><button type="button" data-filter="MISSING" aria-pressed="false">Missing</button><button type="button" data-filter="SOURCE_DESCRIBED" aria-pressed="false">Source-described</button><button type="button" data-filter="VISUALLY_VERIFIED" aria-pressed="false">Visually verified</button><button type="button" data-filter="BROWSER_FAILED" aria-pressed="false">Failed in browser</button><button type="button" id="download-browser-csv">Download browser QA CSV</button></div><p class="browser-summary" id="browser-summary">Browser image requests: waiting for this gallery to load.</p><p>${byCategory.map(c=>`<b>${html(c.category)}:</b> ${c.products} products, ${c.fallbacks} missing, ${c.broken} confirmed broken in HTTP audit, ${c.unverifiedRemote} remote HTTP requests unverified`).join(' · ')}</p></header><main class="grid">${cards}<p class="empty" id="empty" hidden>No products match these filters.</p></main><script>
const auditRows=${JSON.stringify(browserRows)};const cards=[...document.querySelectorAll('.card')];let activeFilter='ALL';const browserState=new Map(auditRows.map(row=>[row.id,row.browserStatus]));function updateSummary(){const pending=[...browserState.values()].filter(s=>s==='NOT_TESTED_IN_BROWSER').length,loaded=[...browserState.values()].filter(s=>s==='LOADED').length,failed=[...browserState.values()].filter(s=>s==='FAILED').length,missing=[...browserState.values()].filter(s=>s==='NOT_APPLICABLE_MISSING_MAPPING').length;document.querySelector('#browser-summary').textContent='Browser image requests: '+loaded+' loaded (not visually verified), '+failed+' failed, '+pending+' pending, '+missing+' missing mappings (neutral fallback).'}document.querySelectorAll('img[data-product-image="true"]').forEach(img=>{const card=img.closest('.card'),row=auditRows.find(item=>String(item.id)===card.dataset.productId);img.addEventListener('load',()=>{if(browserState.get(row.id)!=='FAILED'){browserState.set(row.id,'LOADED');card.dataset.browserStatus='LOADED';card.querySelector('.image-state').textContent='Image loaded · visual match not verified';card.querySelector('.badge.browser').textContent='Browser: LOADED'}updateSummary()});img.addEventListener('error',()=>{browserState.set(row.id,'FAILED');card.dataset.browserStatus='FAILED';card.querySelector('.image-state').textContent='Image request failed in this browser';card.querySelector('.badge.browser').textContent='Browser: FAILED';if(!img.dataset.didFallback){img.dataset.didFallback='true';img.src=img.dataset.fallbackSrc}updateSummary()});if(img.complete){img.dispatchEvent(new Event(img.naturalWidth?'load':'error'))}});function applyFilters(){const q=document.querySelector('#q').value.trim().toLowerCase(),category=document.querySelector('#category').value;let visible=0;cards.forEach(card=>{const name=card.querySelector('strong').textContent.toLowerCase(),matchesText=!q||name.includes(q)||card.dataset.category.toLowerCase().includes(q),matchesCategory=!category||card.dataset.category===category;let matchesState=true;if(activeFilter==='MAPPED')matchesState=card.dataset.mapStatus==='MAPPED';if(activeFilter==='MISSING')matchesState=card.dataset.mapStatus==='MISSING';if(activeFilter==='SOURCE_DESCRIBED')matchesState=card.dataset.sourceDescribed==='true';if(activeFilter==='VISUALLY_VERIFIED')matchesState=card.dataset.visuallyVerified==='true';if(activeFilter==='BROWSER_FAILED')matchesState=card.dataset.browserStatus==='FAILED';card.hidden=!(matchesText&&matchesCategory&&matchesState);if(!card.hidden)visible++});document.querySelector('#empty').hidden=visible!==0}document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));applyFilters()}));document.querySelector('#q').addEventListener('input',applyFilters);document.querySelector('#category').addEventListener('change',applyFilters);function csvCell(value){return '"'+String(value??'').replaceAll('"','""')+'"'}document.querySelector('#download-browser-csv').addEventListener('click',()=>{const headers=['product_id','product_name','category','image_url','mapping_status','application_image_status','browser_load_status','source_status','visual_match_status'];const lines=[headers.map(csvCell).join(',')];auditRows.forEach(row=>lines.push([row.id,row.name,row.category,row.imageUrl,row.mappingStatus,row.applicationImageStatus,browserState.get(row.id),row.sourceStatus,row.visualStatus].map(csvCell).join(',')));const blob=new Blob([lines.join('\\r\\n')+'\\r\\n'],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='image-audit-browser.csv';link.click();URL.revokeObjectURL(url)});updateSummary();applyFilters();
</script></body></html>`;
fs.writeFileSync(htmlPath, htmlReport, 'utf8');

console.log(JSON.stringify({ ...counts, networkErrors: [...new Set(checked.filter(c => c.error).map(c => c.error))], categories: byCategory.map(({ category, products, fallbacks, broken, unverifiedRemote, needsReplacement }) => ({ category, products, fallbacks, broken, unverifiedRemote, needsReplacement })), csv: csvPath, gallery: htmlPath }, null, 2));

})().catch(error => { console.error(error); process.exitCode = 1; });
