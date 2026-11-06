// Encripta los datos con tu contraseña (AES-256-GCM). Así el proyecto puede ser público y gratis sin que nadie vea tus productos.
import crypto from 'node:crypto';
const ITER = 150000;
export function encriptar(obj, clave) {
  const sal = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const k = crypto.pbkdf2Sync(clave, sal, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const datos = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()]);
  return JSON.stringify({ v: 1, it: ITER, s: sal.toString('base64'), iv: iv.toString('base64'), d: datos.toString('base64') });
}
export function desencriptar(texto, clave) {
  const o = JSON.parse(texto), sal = Buffer.from(o.s, 'base64'), iv = Buffer.from(o.iv, 'base64'), d = Buffer.from(o.d, 'base64');
  const k = crypto.pbkdf2Sync(clave, sal, o.it || ITER, 32, 'sha256');
  const dc = crypto.createDecipheriv('aes-256-gcm', k, iv); dc.setAuthTag(d.subarray(d.length - 16));
  return JSON.parse(Buffer.concat([dc.update(d.subarray(0, d.length - 16)), dc.final()]).toString('utf8'));
}
