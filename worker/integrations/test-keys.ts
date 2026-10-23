/** Solo para pruebas: genera un par RSA efímero. No hay ninguna clave real en el repositorio. */
export async function generateTestKeys(): Promise<{ pem: string; publicKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const der = new Uint8Array((await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer)
  let binary = ''
  for (const b of der) binary += String.fromCharCode(b)
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(binary).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`
  return { pem, publicKey: pair.publicKey }
}
