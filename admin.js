const {supabaseUrl,supabaseAnonKey,adminEmail}=window.TD_CONFIG;
const client=window.supabase.createClient(supabaseUrl,supabaseAnonKey);
const login=document.querySelector('#login'),dashboard=document.querySelector('#dashboard'),logout=document.querySelector('#logout'),list=document.querySelector('#productList'),editor=document.querySelector('#editor'),form=document.querySelector('#productForm');
let products=[],pickupHolds=[],pickupFilter='active';
const $=id=>document.querySelector(`#${id}`);
function message(id,text,error=false){const el=$(id);el.textContent=text;el.classList.toggle('error',error)}
async function showSession(session){const allowed=session?.user?.email?.toLowerCase()===adminEmail.toLowerCase();login.hidden=allowed;dashboard.hidden=!allowed;logout.hidden=!allowed;if(allowed)await Promise.all([loadProducts(),loadPickupHolds()]);else if(session)message('loginMessage','这个邮箱没有管理员权限。',true)}
$('loginForm').onsubmit=async e=>{e.preventDefault();const email=$('email').value.trim().toLowerCase();if(email!==adminEmail.toLowerCase())return message('loginMessage','请使用 Treasure Depot 管理员邮箱。',true);message('loginMessage','正在登录…');const {error}=await client.auth.signInWithPassword({email,password:$('password').value});if(error)return message('loginMessage',`登录失败：${error.message}`,true);message('loginMessage','登录成功。')};
logout.onclick=async()=>{await client.auth.signOut();location.reload()};
async function loadProducts(){const {data,error}=await client.from('products').select('*').order('created_at',{ascending:false});if(error)return alert(`读取商品失败：${error.message}`);products=data;renderProducts()}
function esc(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderProducts(){$('totalCount').textContent=products.length;$('publishedCount').textContent=products.filter(p=>p.is_published).length;$('lowCount').textContent=products.filter(p=>p.status!=='in_stock').length;list.innerHTML=products.map(p=>`<article class="product-row"><img src="${esc(p.image_url||'')}" alt=""><div><h3>${esc(p.name_zh||p.name_en)}</h3><p>${esc(p.sku)} · $${Number(p.price).toFixed(2)} · 库存 ${p.stock_quantity} · ${p.is_published?'网站展示':'已隐藏'}</p></div><div class="row-actions"><button data-edit="${p.id}">修改</button><button class="delete" data-delete="${p.id}">删除</button></div></article>`).join('')||'<div class="panel">还没有商品，请点击“新增商品”。</div>';list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(products.find(p=>p.id===b.dataset.edit)));list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delete))}
function openEditor(p=null){form.reset();$('productId').value=p?.id||'';$('formTitle').textContent=p?'修改商品':'新增商品';$('published').checked=p?p.is_published:true;$('aiMessage').textContent='';$('aiResult').hidden=true;$('aiSimilar').hidden=true;$('aiPreview').hidden=!p?.image_url;if(p?.image_url)$('aiPreview').src=p.image_url;if(p){$('sku').value=p.sku;$('category').value=p.category;$('nameEn').value=p.name_en;$('nameZh').value=p.name_zh||'';$('nameEs').value=p.name_es||'';$('descriptionEn').value=p.description_en||'';$('descriptionZh').value=p.description_zh||'';$('descriptionEs').value=p.description_es||'';$('price').value=p.price;$('comparePrice').value=p.compare_at_price||'';$('stock').value=p.stock_quantity;$('status').value=p.status;$('imageUrl').value=p.image_url||'';$('popular').checked=p.is_popular;$('isNew').checked=p.is_new}message('formMessage','');editor.showModal()}
$('newProduct').onclick=()=>openEditor();$('closeEditor').onclick=()=>editor.close();$('cancelEditor').onclick=()=>editor.close();

$('image').onchange=()=>{
  const file=$('image').files[0];
  if(!file)return;
  $('aiPreview').src=URL.createObjectURL(file);$('aiPreview').hidden=false;
};

function compressedImageDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('无法读取照片'));
    reader.onload=()=>{
      const image=new Image();
      image.onerror=()=>reject(new Error('照片格式不支持'));
      image.onload=()=>{
        const max=1600,scale=Math.min(1,max/Math.max(image.width,image.height));
        const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',.82));
      };
      image.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function uniqueSku(suggestion='ITEM'){
  const base=String(suggestion).toUpperCase().replace(/[^A-Z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,24)||'ITEM';
  if(!products.some(p=>p.sku?.toUpperCase()===base))return base;
  let suffix=2;while(products.some(p=>p.sku?.toUpperCase()===`${base}-${suffix}`))suffix++;
  return `${base}-${suffix}`;
}

function reuseSimilarProduct(id){
  const product=products.find(item=>String(item.id)===String(id));if(!product)return;
  $('category').value=product.category||'';$('nameEn').value=product.name_en||'';$('nameZh').value=product.name_zh||'';$('nameEs').value=product.name_es||'';
  $('descriptionEn').value=product.description_en||'';$('descriptionZh').value=product.description_zh||'';$('descriptionEs').value=product.description_es||'';
  if(!$('comparePrice').value&&product.compare_at_price)$('comparePrice').value=product.compare_at_price;
  $('aiMessage').textContent='已复用相似商品文案，请检查后保存。';
}

function applyAIResult(result){
  $('sku').value=$('sku').value||uniqueSku(result.suggested_sku);$('category').value=result.category;$('nameEn').value=result.name_en;$('nameZh').value=result.name_zh;$('nameEs').value=result.name_es;
  $('descriptionEn').value=result.description_en;$('descriptionZh').value=result.description_zh;$('descriptionEs').value=result.description_es;
  if(!$('comparePrice').value&&result.suggested_compare_price)$('comparePrice').value=Number(result.suggested_compare_price).toFixed(2);
  if(!$('stock').value)$('stock').value=1;
  const notes=[result.brand?`品牌：${esc(result.brand)}`:'品牌：未确认',`识别置信度：${Math.round(Number(result.confidence||0)*100)}%`,...(result.warnings||[]).map(item=>esc(item))];
  $('aiResult').innerHTML=notes.join(' · ');$('aiResult').classList.toggle('warning',(result.warnings||[]).length>0);$('aiResult').hidden=false;
  const matches=(result.similar_products||[]).filter(match=>products.some(p=>String(p.id)===String(match.id)));
  $('aiSimilar').hidden=!matches.length;
  $('aiSimilar').innerHTML=matches.length?`<h4>可能相似或重复的库存商品</h4>${matches.map(match=>`<div class="ai-match"><div><strong>${esc(match.name)}</strong>${esc(match.reason)} · ${Math.round(Number(match.confidence||0)*100)}%</div><button type="button" data-ai-reuse="${esc(match.id)}">复用文案</button></div>`).join('')}`:'';
  $('aiSimilar').querySelectorAll('[data-ai-reuse]').forEach(button=>button.onclick=()=>reuseSimilarProduct(button.dataset.aiReuse));
}

$('aiAnalyze').onclick=async()=>{
  const button=$('aiAnalyze'),file=$('image').files[0],remoteUrl=$('imageUrl').value.trim();
  if(!file&&!remoteUrl)return message('aiMessage','请先上传商品照片或填写图片网址。',true);
  button.disabled=true;message('aiMessage','AI 正在识别照片并检查重复商品…');$('aiResult').hidden=true;$('aiSimilar').hidden=true;
  try{
    const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('管理员登录已失效，请重新登录。');
    const image=file?await compressedImageDataUrl(file):remoteUrl;
    const inventory=products.map(({id,sku,category,name_en,name_zh,description_en})=>({id,sku,category,name_en,name_zh,description_en}));
    const response=await fetch('/api/analyze-product',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({image,price:$('price').value||null,inventory})});
    const body=await response.json();if(!response.ok)throw new Error(body.error||'AI 分析失败');
    applyAIResult(body.result);message('aiMessage','AI 已填写完成。请检查内容和售价后再保存。');
  }catch(error){message('aiMessage',error.message||'AI 分析失败，你仍可继续手动填写。',true)}finally{button.disabled=false}
};

async function uploadImage(file){if(!file)return $('imageUrl').value.trim()||null;const ext=file.name.split('.').pop().toLowerCase();const path=`${crypto.randomUUID()}.${ext}`;const {error}=await client.storage.from('product-images').upload(path,file,{contentType:file.type});if(error)throw error;return client.storage.from('product-images').getPublicUrl(path).data.publicUrl}
form.onsubmit=async e=>{e.preventDefault();message('formMessage','正在保存…');try{const imageUrl=await uploadImage($('image').files[0]);const payload={sku:$('sku').value.trim(),category:$('category').value.trim(),name_en:$('nameEn').value.trim(),name_zh:$('nameZh').value.trim()||null,name_es:$('nameEs').value.trim()||null,description_en:$('descriptionEn').value.trim()||null,description_zh:$('descriptionZh').value.trim()||null,description_es:$('descriptionEs').value.trim()||null,price:Number($('price').value),compare_at_price:$('comparePrice').value?Number($('comparePrice').value):null,stock_quantity:Number($('stock').value),status:$('status').value,image_url:imageUrl,is_popular:$('popular').checked,is_new:$('isNew').checked,is_published:$('published').checked};const id=$('productId').value;const result=id?await client.from('products').update(payload).eq('id',id):await client.from('products').insert(payload);if(result.error)throw result.error;editor.close();await loadProducts()}catch(error){message('formMessage',`保存失败：${error.message}`,true)}};
async function deleteProduct(id){const p=products.find(item=>item.id===id);if(!confirm(`确定删除“${p.name_zh||p.name_en}”吗？`))return;const {error}=await client.from('products').delete().eq('id',id);if(error)return alert(`删除失败：${error.message}`);await loadProducts()}

document.querySelectorAll('.admin-tabs [data-tab]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('.admin-tabs [data-tab]').forEach(item=>item.classList.toggle('active',item===button));
  document.querySelectorAll('.admin-panel').forEach(panel=>panel.hidden=panel.id!==button.dataset.tab);
});

function localInputValue(date=new Date()){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date-offset).toISOString().slice(0,16);
}
function formatDate(value){return new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
function displayStatus(hold){
  if(hold.status==='waiting'&&new Date(hold.expires_at)<new Date())return ['expired','已到期'];
  return {waiting:['waiting','等待提货'],picked_up:['picked_up','已提货'],expired:['expired','已过期'],cancelled:['cancelled','已取消']}[hold.status];
}
async function loadPickupHolds(){
  const {data,error}=await client.from('pickup_holds').select('*').order('created_at',{ascending:false});
  if(error){console.warn('Pickup holds unavailable:',error.message);return}
  pickupHolds=data||[];
  renderPickupHolds();
}
function renderPickupHolds(){
  const now=new Date(),today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const waiting=pickupHolds.filter(h=>h.status==='waiting'&&new Date(h.expires_at)>=now);
  const overdue=pickupHolds.filter(h=>h.status==='waiting'&&new Date(h.expires_at)<now);
  $('waitingCount').textContent=waiting.length;
  $('todayCount').textContent=waiting.filter(h=>new Date(h.pickup_at)>=today&&new Date(h.pickup_at)<tomorrow).length;
  $('expiredCount').textContent=overdue.length+pickupHolds.filter(h=>h.status==='expired').length;
  $('pickupBadge').textContent=waiting.length+overdue.length;
  const rows=pickupFilter==='active'?pickupHolds.filter(h=>h.status==='waiting'):pickupHolds;
  $('pickupList').innerHTML=rows.map(hold=>{
    const [statusClass,statusText]=displayStatus(hold),isOverdue=statusClass==='expired'&&hold.status==='waiting';
    return `<article class="pickup-row ${isOverdue?'expired':''}"><img src="${esc(hold.product_image_url||'')}" alt=""><div><div class="pickup-meta"><strong>${esc(hold.hold_number)}</strong><span class="status-pill ${statusClass}">${statusText}</span></div><h3>${esc(hold.product_name)} × ${hold.quantity}</h3><p>${esc(hold.customer_name)} · ${esc(hold.customer_phone)}<br>提货：${formatDate(hold.pickup_at)} · 截止：${formatDate(hold.expires_at)}${hold.warehouse_location?`<br>位置：${esc(hold.warehouse_location)}`:''}</p></div><div class="row-actions"><button data-print="${hold.id}">打印标签</button>${hold.status==='waiting'?`<button data-complete="${hold.id}">确认提货</button>${isOverdue?`<button data-expire="${hold.id}">标记过期</button>`:''}<button class="delete" data-cancel="${hold.id}">取消并退回库存</button>`:''}${hold.status==='expired'?`<button class="delete" data-cancel="${hold.id}">退回可售库存</button>`:''}</div></article>`;
  }).join('')||'<div class="panel">目前没有提货保留单。</div>';
  document.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>printHold(pickupHolds.find(h=>h.id===b.dataset.print)));
  document.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>changeHoldStatus(b.dataset.complete,'picked_up','确认客人已经取走商品吗？'));
  document.querySelectorAll('[data-expire]').forEach(b=>b.onclick=()=>changeHoldStatus(b.dataset.expire,'expired','确认把这张保留单标记为已过期吗？商品不会自动重新上架。'));
  document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>changeHoldStatus(b.dataset.cancel,'cancelled','确认取消保留并把商品数量退回可售库存吗？'));
}
document.querySelectorAll('[data-pickup-filter]').forEach(button=>button.onclick=()=>{
  pickupFilter=button.dataset.pickupFilter;
  document.querySelectorAll('[data-pickup-filter]').forEach(item=>item.classList.toggle('active',item===button));
  renderPickupHolds();
});

function openPickupEditor(){
  $('pickupForm').reset();message('pickupMessage','');
  $('pickupProduct').innerHTML=products.filter(p=>p.stock_quantity>0).map(p=>`<option value="${p.id}">${esc(p.name_zh||p.name_en)} · ${esc(p.sku)} · 库存 ${p.stock_quantity}</option>`).join('');
  const selected=products.find(p=>p.id===$('pickupProduct').value);if(selected)$('amountPaid').value=Number(selected.price).toFixed(2);
  const now=new Date();$('paidAt').value=localInputValue(now);const pickup=new Date(now);pickup.setDate(pickup.getDate()+1);$('pickupAt').value=localInputValue(pickup);
  $('pickupEditor').showModal();
}
$('newPickup').onclick=openPickupEditor;
$('closePickup').onclick=()=>$('pickupEditor').close();
$('cancelPickup').onclick=()=>$('pickupEditor').close();
$('pickupProduct').onchange=()=>{const p=products.find(item=>item.id===$('pickupProduct').value);if(p)$('amountPaid').value=Number(p.price).toFixed(2)};

$('pickupForm').onsubmit=async event=>{
  event.preventDefault();message('pickupMessage','正在创建保留单并扣减库存…');
  const paidAt=new Date($('paidAt').value),pickupAt=new Date($('pickupAt').value),limit=new Date(paidAt);limit.setDate(limit.getDate()+7);
  if(pickupAt>limit)return message('pickupMessage','提货时间不能超过付款后的 7 天。',true);
  const {data,error}=await client.rpc('create_pickup_hold',{
    p_product_id:$('pickupProduct').value,p_quantity:Number($('pickupQuantity').value),p_amount_paid:Number($('amountPaid').value),
    p_customer_name:$('customerName').value.trim(),p_customer_phone:$('customerPhone').value.trim(),
    p_paid_at:paidAt.toISOString(),p_pickup_at:pickupAt.toISOString(),
    p_warehouse_location:$('warehouseLocation').value.trim()||null,p_notes:$('pickupNotes').value.trim()||null
  });
  if(error)return message('pickupMessage',`创建失败：${error.message}`,true);
  $('pickupEditor').close();await Promise.all([loadProducts(),loadPickupHolds()]);printHold(data);
};

async function changeHoldStatus(id,status,question){
  if(!confirm(question))return;
  const {error}=await client.rpc('update_pickup_hold_status',{p_hold_id:id,p_status:status});
  if(error)return alert(`操作失败：${error.message}`);
  await Promise.all([loadProducts(),loadPickupHolds()]);
}
function printHold(hold){
  const safe=value=>esc(value||'');
  const printWindow=window.open('','_blank','width=520,height=760');
  if(!printWindow)return alert('浏览器阻止了打印窗口，请允许弹出窗口后重试。');
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(hold.hold_number)}</title><style>@page{size:4in 6in;margin:.18in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#111}.label{border:4px solid #111;width:3.64in;height:5.64in;padding:.2in;display:flex;flex-direction:column}.brand{text-align:center;font-size:22px;font-weight:900;border-bottom:3px solid #111;padding-bottom:10px}.paid{text-align:center;font-size:30px;font-weight:900;margin:12px 0}.number{text-align:center;font:700 18px monospace;border:2px solid #111;padding:8px}.row{border-bottom:1px solid #999;padding:9px 0;font-size:15px}.row b{display:block;font-size:10px;text-transform:uppercase;margin-bottom:3px}.product{font-size:21px;font-weight:800}.deadline{background:#111;color:white;padding:10px;text-align:center;font-weight:800;margin-top:10px}.footer{margin-top:auto;text-align:center;font-size:11px}.phone{font-size:18px;font-weight:700}</style></head><body><div class="label"><div class="brand">TREASURE DEPOT</div><div class="paid">PAID · HOLD</div><div class="number">${safe(hold.hold_number)}</div><div class="row"><b>Customer / 客人</b>${safe(hold.customer_name)}</div><div class="row phone"><b>Phone / 电话</b>${safe(hold.customer_phone)}</div><div class="row product"><b>Item / 商品</b>${safe(hold.product_name)} × ${hold.quantity}</div><div class="row"><b>Pickup / 提货时间</b>${formatDate(hold.pickup_at)}</div><div class="row"><b>Warehouse / 仓库位置</b>${safe(hold.warehouse_location)||'—'}</div><div class="deadline">HOLD UNTIL ${formatDate(hold.expires_at)}</div><div class="footer">Paid $${Number(hold.amount_paid).toFixed(2)} · Verify ID/order number at pickup</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
  printWindow.document.close();
}
client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>showSession(session),0));client.auth.getSession().then(({data})=>showSession(data.session));
