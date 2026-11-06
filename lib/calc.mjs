// Cálculos de RADAR (mismos que la versión de escritorio). No se modifica solo.
export let CFG;
const ars=n=>(n==null||!isFinite(n))?'—':'$'+Math.round(n).toLocaleString('es-AR');
const pct=n=>(n==null||!isFinite(n))?'—':Math.round(n)+'%';
export const DEF={dolar_oficial:1450,margen_minimo_pct:300,ml_ganancia_min_pct_costo:70,
 web:{margen_min_pct_precio:50,nombre:'Tienda propia (Tiendanube + Mercado Pago)',comision_plataforma_pct:2,pasarela_pct:6.29,iva_sobre_cargos_pct:21,publicidad_pct:12,impuestos_venta_pct:3.5,devoluciones_pct:2,packaging_ars:800,envio_paga:'cliente',envio_promedio_ars:7500,envio_gratis_desde_ars:0},
 whatsapp:{telefono:'+5493364008485',apikey:''},perfil:{reputacion_ml:'verde',tipo_publicacion:'clasica',notas:''},
 ml:{comision_clasica_pct:14,comision_premium_pct:18.5,costo_fijo_tramos:[[15000,1330],[25000,2740],[33000,3320]],umbral_envio_gratis:33000,
  envio_tramos_kg:[[0.3,12500],[0.5,14200],[1,16580],[2,19800],[5,27500],[10,38000],[20,56000],[30,72000]],
  descuento_envio_reputacion:{lider:50,verde:50,sin_reputacion:50,amarillo:40,naranja:0,rojo:0},
  iva_sobre_cargos_pct:21,publicidad_pct:6,impuestos_venta_pct:3.5,devoluciones_pct:2,packaging_ars:600},
 importacion:{tasa_estadistica_pct:3,iva_pct:21,iva_adicional_pct:20,ganancias_percepcion_pct:6,iibb_percepcion_pct:2.5,seguro_pct:1,derecho_importacion_default_pct:20,gastos_despachante_ars:180000,
  metodos_envio:{courier_express:{nombre:'Courier exprés (DHL/FedEx/UPS)',usd_kg:24,min_usd:45,dias:'5-12',seguridad:5,regimen:'courier'},
   courier_economico:{nombre:'Courier económico / AliExpress Standard',usd_kg:12,min_usd:5,dias:'15-35',seguridad:3,regimen:'courier'},
   aereo_consolidado:{nombre:'Aéreo consolidado',usd_kg:9,min_usd:250,dias:'10-20',seguridad:4,regimen:'formal'},
   maritimo_lcl:{nombre:'Marítimo LCL (contenedor compartido)',usd_kg:2.2,min_usd:600,dias:'45-70',seguridad:4,regimen:'formal'}}}};

export function mezclar(a,b){const o=JSON.parse(JSON.stringify(a));for(const k in (b||{})){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&typeof o[k]==='object')o[k]=mezclar(o[k],b[k]);else o[k]=b[k]}return o}

const tramo=(t,v)=>{for(const [l,c] of t)if(v<=l)return c;return t[t.length-1][1]};

function costoPuesto(e){
  const imp=CFG.importacion,tc=CFG.dolar_oficial,q=Math.max(1,e.cantidad|0);
  if(e.metodo==='local'){const u=e.costo_local??e.costo_usd*tc;const tot=u*q;return{metodo:e.nombre_local||'Proveedor nacional',clave:'local',cantidad:q,fob_usd:0,flete_usd:0,tributos:0,prov_unit:u,total:tot,unit:tot/q,dias:'1-5',seguridad:5,adv:[]}}
  const m=imp.metodos_envio[e.metodo]||imp.metodos_envio.courier_economico;
  const fob=e.costo_usd*q,peso=e.peso*q,flete=Math.max(m.min_usd,m.usd_kg*peso),seguro=fob*imp.seguro_pct/100,cif=fob+flete+seguro;
  const di=cif*(e.di??imp.derecho_importacion_default_pct)/100,te=cif*imp.tasa_estadistica_pct/100,base=cif+di+te;
  const trib=di+te+base*(imp.iva_pct+imp.iva_adicional_pct+imp.ganancias_percepcion_pct+imp.iibb_percepcion_pct)/100;
  const desp=m.regimen==='formal'?imp.gastos_despachante_ars:0;const total=(fob+flete+seguro+trib)*tc+desp;
  const adv=[];if(m.regimen==='courier'&&fob>3000)adv.push('El courier admite hasta USD 3.000 por envío: dividí la compra o usá importación formal.');
  return{metodo:m.nombre,clave:e.metodo,cantidad:q,fob_usd:fob,flete_usd:flete,tributos:trib*tc,prov_unit:e.costo_usd*tc,total,unit:total/q,dias:m.dias,seguridad:m.seguridad,adv};
}
function costosML(precio,peso,tipo){
  const ml=CFG.ml,rep=CFG.perfil.reputacion_ml||'verde';tipo=tipo||CFG.perfil.tipo_publicacion||'clasica';
  const cp=tipo==='premium'?ml.comision_premium_pct:ml.comision_clasica_pct,com=precio*cp/100;
  let fijo=0,envio=0;if(precio<ml.umbral_envio_gratis)fijo=tramo(ml.costo_fijo_tramos,precio);else envio=tramo(ml.envio_tramos_kg,peso)*(1-(ml.descuento_envio_reputacion[rep]??0)/100);
  const iva=(com+fijo)*ml.iva_sobre_cargos_pct/100,pub=precio*ml.publicidad_pct/100,impv=precio*ml.impuestos_venta_pct/100,dev=precio*ml.devoluciones_pct/100,pack=ml.packaging_ars;
  const total=com+fijo+iva+envio+pub+impv+dev+pack;
  return{tipo,comision_pct:cp,comision:com,fijo,envio,iva,pub,impv,dev,pack,total,neto:precio-total};
}
export function rentab(precio,e,tipo){
  const cp=costoPuesto(e),cv=costosML(precio,e.peso,tipo),g=cv.neto-cp.unit;
  const markup=cp.prov_unit?(precio-cp.prov_unit)/cp.prov_unit*100:0,roi=cp.unit?g/cp.unit*100:0;
  const min=CFG.margen_minimo_pct,minB=CFG.ml_ganancia_min_pct_costo||70;
  const reglaA=markup>=min&&g>0,reglaB=g>=cp.unit*minB/100,cumple=reglaA||reglaB;
  const buscar=f=>{let lo=1,hi=Math.max(1e5,cp.unit*60);for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(f(mid))hi=mid;else lo=mid}return Math.round(hi)};
  const equilibrio=buscar(x=>costosML(x,e.peso,tipo).neto-cp.unit>=0);
  const precioB=buscar(x=>costosML(x,e.peso,tipo).neto-cp.unit>=cp.unit*minB/100);
  const minimo=Math.min(Math.max(Math.round(cp.prov_unit*(1+min/100)),equilibrio+1),precioB);
  let aviso='';if(!cumple)aviso=`En Mercado Libre no cumple: necesita ${min}% sobre el proveedor con ganancia, o ganar el ${minB}% del costo. Precio mínimo: ${ars(minimo)}.`;
  return{precio,cp,cv,ganancia:g,ganancia_lote:g*cp.cantidad,markup,roi,reglaA,reglaB,ganancia_pct_costo:cp.unit?g/cp.unit*100:0,margen_neto:precio?g/precio*100:0,mult:cp.prov_unit?precio/cp.prov_unit:null,cumple,minimo,equilibrio,aviso,
    recupero:cv.neto>0?Math.ceil(cp.total/cv.neto):null};
}
function costosWeb(precio){
  const w=CFG.web,plat=precio*w.comision_plataforma_pct/100,pas=precio*w.pasarela_pct/100,iva=(plat+pas)*w.iva_sobre_cargos_pct/100;
  const pub=precio*w.publicidad_pct/100,impv=precio*w.impuestos_venta_pct/100,dev=precio*w.devoluciones_pct/100,pack=w.packaging_ars;
  const envio=w.envio_paga==='vendedor'||(w.envio_gratis_desde_ars>0&&precio>=w.envio_gratis_desde_ars)?w.envio_promedio_ars:0;
  const total=plat+pas+iva+pub+impv+dev+pack+envio;return{plat,pas,iva,pub,impv,dev,pack,envio,total,neto:precio-total};
}
export function rentabWeb(precio,e){
  const cp=costoPuesto(e),cv=costosWeb(precio),g=cv.neto-cp.unit,minp=CFG.web.margen_min_pct_precio||50;
  let lo=1,hi=Math.max(1e5,cp.unit*60);for(let i=0;i<70;i++){const mid=(lo+hi)/2;const c=costosWeb(mid);if(c.neto-cp.unit>=mid*minp/100)hi=mid;else lo=mid}
  return{precio,cp,cv,ganancia:g,margen_precio:precio?g/precio*100:0,cumple:precio>0&&g>=precio*minp/100,minimo:Math.round(hi),ganancia_en_minimo:Math.round(costosWeb(hi).neto-cp.unit)};
}
function metodos(e){
  const r=Object.keys(CFG.importacion.metodos_envio).map(k=>costoPuesto({...e,metodo:k})).sort((a,b)=>a.unit-b.unit);
  const min=r[0].unit;r.forEach(x=>{const d=+String(x.dias).split('-').pop();x.puntaje=Math.round(60*min/x.unit+25*x.seguridad/5+15*Math.min(1,10/d))});
  const m=r.reduce((a,b)=>b.puntaje>a.puntaje?b:a);m.rec=true;return r;
}


export const num=v=>{const n=parseFloat(String(v??'').replace(/[^\d.,-]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.'));return isNaN(n)?0:n};

export function evaluar(p){
  const d=p.demanda||{},costo=num(p.costo_proveedor_usd)||Math.min(...(p.proveedores||[]).map(x=>num(x.precio_usd)).filter(Boolean),Infinity);
  const precio=num(p.precio_venta_sugerido_ars)||num((p.precios_mercados||[]).find(x=>/argentin/i.test(x.mercado||''))?.precio);
  const ventas=!!d.ventas_comprobadas;
  if(!isFinite(costo)||!costo||!precio)return{veredicto:'DATOS INSUFICIENTES',puntaje:0,ventas,costo:isFinite(costo)?costo:null,precio};
  const esp=num(p.ventas_estimadas_mes?.esperado);const e={costo_usd:costo,cantidad:esp?Math.max(20,Math.min(500,esp)):50,peso:num(p.peso_kg)||0.3,di:p.derecho_importacion_pct!=null?num(p.derecho_importacion_pct):null};
  const ms=metodos(e);const loc=(p.proveedores||[]).filter(x=>/local|nacional|argentin/i.test(x.tipo||'')&&num(x.precio_ars)).sort((a,b)=>num(a.precio_ars)-num(b.precio_ars))[0];
  if(loc){const l=costoPuesto({...e,metodo:'local',costo_local:num(loc.precio_ars)});l.metodo='Proveedor local: '+(loc.proveedor||'Argentina');ms.push(l)}
  ms.forEach(m=>m.rec=false);const mejor=ms.reduce((a,b)=>b.unit<a.unit*0.9||(b.unit<=a.unit&&b.seguridad>=a.seguridad)?b:a);mejor.rec=true;
  e.metodo=mejor.clave;if(mejor.clave==='local'){e.costo_local=num(loc.precio_ars);e.nombre_local='Proveedor local: '+(loc.proveedor||'Argentina')}const r=rentab(precio,e);
  const precioWeb=num(p.precio_venta_web_ars)||precio;const w=rentabWeb(precioWeb,e);
  let dem=num(d.puntaje)||({alta:85,media:55,baja:25}[d.nivel]??50);if(!ventas)dem=Math.min(dem,40);
  const comp=num(p.competencia?.puntaje)||({alta:70,media:45,baja:20}[p.competencia?.nivel]??50);
  const marg=r.cumple||w.cumple?100:Math.max(0,Math.min(100,Math.max(r.ganancia_pct_costo,w.margen_precio*1.4))),riesgos=(p.riesgos_regulatorios||[]).filter(x=>x&&!/ningun/i.test(x)),riesgo=Math.max(0,100-30*riesgos.length);
  const puntaje=Math.round(.55*dem+.25*marg+.12*(100-comp)+.08*riesgo);
  const canales=[r.cumple&&'Mercado Libre',w.cumple&&'Tu web'].filter(Boolean);const veredicto=canales.length&&ventas&&puntaje>=55?'VENDER':(r.ganancia>0||w.ganancia>0)&&puntaje>=45?'EVALUAR':'NO VENDER';
  const alertas=[];if(!ventas)alertas.push('Ventas NO comprobadas: no hay evidencia firme de que se venda bien. No lo compres hasta verificarlo.');if(r.aviso)alertas.push(r.aviso);
  return{veredicto,puntaje,ventas,costo,precio,r,w,canales,ms,e,det:{demanda:dem,margen:Math.round(marg),competencia_baja:100-comp,riesgo_bajo:riesgo},alertas};
}

export function usarConfig(c){CFG=mezclar(DEF,c||{});return CFG}
export {ars,pct};
